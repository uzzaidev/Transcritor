from __future__ import annotations

import unicodedata
from pathlib import Path

from ata_agent import gemini_client
from ata_agent.config import Settings
from ata_agent.contracts import PipelineState
from ata_agent.email import AudioEmailJob, fetch_audio_jobs, mark_uid_seen, send_ata_email
from ata_agent.event_store import persist_pipeline_event
from ata_agent.logging_utils import (
    get_logger,
    new_correlation_id,
    reset_correlation_id,
    set_correlation_id,
)
from ata_agent.store import load_processed_ids, remember_message_id

log = get_logger(__name__, "orchestrator")


def _load_template_excerpt(settings: Settings) -> str:
    if not settings.ata_template_path or not settings.ata_template_path.is_file():
        p = Path(__file__).resolve().parent / "prompts" / "template_default.md"
        if p.is_file():
            return p.read_text(encoding="utf-8")[:20000]
        return ""
    return settings.ata_template_path.read_text(encoding="utf-8")[:20000]


def _validate_ata(markdown: str) -> tuple[bool, str]:
    if len(markdown.strip()) < 120:
        return False, "ata muito curta"
    lowered = markdown.lower()
    normalized = unicodedata.normalize("NFKD", lowered).encode("ascii", "ignore").decode("ascii")
    if "decis" not in normalized and "topic" not in normalized and "topico" not in normalized:
        return False, "ata sem secoes reconheciveis"
    return True, "ok"


def _base_payload(job: AudioEmailJob) -> dict[str, str]:
    return {
        "message_id": job.message_id,
        "uid": job.uid.decode(errors="ignore"),
        "subject": job.subject,
        "audio_path": str(job.audio_path),
    }


def _state_payload(state: PipelineState) -> dict[str, object]:
    return {
        "correlation_id": str(state.meta.get("correlation_id") or ""),
        "status_validacao": state.status_validacao,
        "delivery_success": state.delivery_success,
        "delivery_error": state.delivery_error,
        "delivery_message_id": state.delivery_message_id,
        "projeto": state.projeto,
        "sprint": state.sprint,
        "participantes_count": len(state.participantes),
        "decisoes_count": len(state.decisoes),
        "acoes_count": len(state.acoes),
        "kaizens_count": len(state.kaizens),
        "riscos_count": len(state.riscos),
    }


def process_job(settings: Settings, job: AudioEmailJob) -> PipelineState:
    correlation_id = new_correlation_id()
    correlation_token = set_correlation_id(correlation_id)
    state = PipelineState(
        tipo_evento="email_audio",
        arquivo_fonte=str(job.audio_path),
        meta={
            "message_id": job.message_id,
            "uid": job.uid.decode(errors="ignore"),
            "correlation_id": correlation_id,
        },
    )
    try:
        processed = load_processed_ids(settings.processed_store)
        if job.message_id in processed:
            log.info("Mensagem ja processada; ignorando: %s", job.message_id)
            state.status_validacao = "skipped_duplicate"
            persist_pipeline_event(
                settings,
                event_type="ata_agent.job.skipped_duplicate",
                success=True,
                payload={**_base_payload(job), **_state_payload(state)},
            )
            return state

        tpl = _load_template_excerpt(settings)

        log.info("Transcrevendo audio: %s", job.audio_path)
        state.transcricao_bruta = gemini_client.transcribe_audio(
            settings.gemini_api_key, settings.gemini_model, job.audio_path
        )

        ext = gemini_client.parse_structured_extractions(
            settings.gemini_api_key, settings.gemini_model, state.transcricao_bruta
        )
        state.participantes = list(ext.get("participantes") or [])
        state.decisoes = list(ext.get("decisoes") or [])
        state.acoes = list(ext.get("acoes") or [])
        state.kaizens = list(ext.get("kaizens") or [])
        state.riscos = list(ext.get("riscos") or [])
        state.projeto = str(ext.get("projeto") or "")
        state.sprint = str(ext.get("sprint") or "")

        log.info("Gerando ata com Gemini...")
        state.ata_markdown_final = gemini_client.build_ata_markdown(
            settings.gemini_api_key,
            settings.gemini_model,
            state.transcricao_bruta,
            tpl,
            job.subject,
        )

        ok, reason = _validate_ata(state.ata_markdown_final)
        if not ok:
            state.status_validacao = f"failed:{reason}"
            log.warning("Validacao da ata falhou: %s", reason)
            persist_pipeline_event(
                settings,
                event_type="ata_agent.job.validation_failed",
                success=False,
                payload={**_base_payload(job), "validation_reason": reason, **_state_payload(state)},
            )
            return state

        state.status_validacao = "ok"
        state.ata_resumo_executivo = gemini_client.executive_summary_from_ata(
            settings.gemini_api_key, settings.gemini_model, state.ata_markdown_final
        )

        state.email_subject = f"Ata gerada - {job.subject}"
        parts_txt = [state.ata_resumo_executivo, "", "---", "", state.ata_markdown_final]
        if settings.include_raw_transcript_in_email:
            parts_txt.extend(["", "---", "", "## Transcricao (bruta)", "", state.transcricao_bruta])

        state.email_body_text = "\n".join(parts_txt)
        state.email_body_html = None
        state.destinatarios = list(settings.ata_recipients)

        log.info("Enviando e-mail de ATA...")
        result = send_ata_email(
            settings,
            subject=state.email_subject,
            body_text=state.email_body_text,
            body_html=None,
            to=state.destinatarios,
        )
        state.delivery_success = result.success
        state.delivery_message_id = result.message_id
        state.delivery_error = result.error

        if result.success:
            remember_message_id(settings.processed_store, job.message_id)
            mark_uid_seen(settings, job.uid)
            try:
                job.audio_path.unlink(missing_ok=True)
            except OSError:
                pass
            log.info("Entrega concluida e e-mail marcado como lido.")
        else:
            log.error("Falha SMTP apos retries: %s", result.error)

        persist_pipeline_event(
            settings,
            event_type="ata_agent.job.delivery",
            success=result.success,
            payload={**_base_payload(job), **_state_payload(state)},
        )
        return state
    finally:
        reset_correlation_id(correlation_token)


def run_once(settings: Settings) -> list[PipelineState]:
    errs = settings.validate()
    if errs:
        raise RuntimeError("Config invalida: " + "; ".join(errs))

    settings.temp_dir.mkdir(parents=True, exist_ok=True)
    settings.processed_store.parent.mkdir(parents=True, exist_ok=True)

    jobs = fetch_audio_jobs(settings)
    log.info("Encontrados %d e-mail(s) com audio.", len(jobs))
    out: list[PipelineState] = []
    for job in jobs:
        try:
            out.append(process_job(settings, job))
        except Exception as exc:
            log.exception("Falha no processamento da mensagem %s", job.message_id)
            failed_state = PipelineState(
                tipo_evento="email_audio",
                arquivo_fonte=str(job.audio_path),
                status_validacao="failed:exception",
                delivery_error=str(exc),
                meta={"message_id": job.message_id, "uid": job.uid.decode(errors="ignore")},
            )
            persist_pipeline_event(
                settings,
                event_type="ata_agent.job.exception",
                success=False,
                payload={**_base_payload(job), "error": str(exc), **_state_payload(failed_state)},
            )
            out.append(failed_state)
    return out
