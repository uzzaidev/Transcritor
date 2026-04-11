from __future__ import annotations

import logging
from pathlib import Path

from ata_agent.config import Settings
from ata_agent.contracts import PipelineState
from ata_agent.email import (
    AudioEmailJob,
    fetch_audio_jobs,
    mark_uid_seen,
    send_ata_email,
)
from ata_agent import gemini_client
from ata_agent.store import load_processed_ids, remember_message_id

log = logging.getLogger(__name__)


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
    if "decis" not in lowered and "tópic" not in lowered and "topic" not in lowered:
        return False, "ata sem secções reconhecíveis"
    return True, "ok"


def process_job(settings: Settings, job: AudioEmailJob) -> PipelineState:
    state = PipelineState(
        tipo_evento="email_audio",
        arquivo_fonte=str(job.audio_path),
        meta={"message_id": job.message_id, "uid": job.uid.decode()},
    )
    processed = load_processed_ids(settings.processed_store)
    if job.message_id in processed:
        log.info("Mensagem já processada, a ignorar: %s", job.message_id)
        state.status_validacao = "skipped_duplicate"
        return state

    tpl = _load_template_excerpt(settings)

    log.info("A transcrever: %s", job.audio_path)
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

    log.info("A gerar ata (Gemini)...")
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
        log.warning("Validação falhou: %s", reason)
        return state

    state.status_validacao = "ok"

    state.ata_resumo_executivo = gemini_client.executive_summary_from_ata(
        settings.gemini_api_key, settings.gemini_model, state.ata_markdown_final
    )

    state.email_subject = f"Ata gerada — {job.subject}"
    parts_txt = [
        state.ata_resumo_executivo,
        "",
        "---",
        "",
        state.ata_markdown_final,
    ]
    if settings.include_raw_transcript_in_email:
        parts_txt.extend(["", "---", "", "## Transcrição (bruta)", "", state.transcricao_bruta])

    state.email_body_text = "\n".join(parts_txt)
    state.email_body_html = None
    state.destinatarios = list(settings.ata_recipients)

    log.info("A enviar e-mail...")
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
        log.info("Concluído e marcado como lido.")
    else:
        log.error("Falha SMTP: %s", result.error)

    return state


def run_once(settings: Settings) -> list[PipelineState]:
    errs = settings.validate()
    if errs:
        raise RuntimeError("Config inválida: " + "; ".join(errs))

    settings.temp_dir.mkdir(parents=True, exist_ok=True)
    settings.processed_store.parent.mkdir(parents=True, exist_ok=True)

    jobs = fetch_audio_jobs(settings)
    log.info("Encontrados %d e-mail(is) com áudio.", len(jobs))
    out: list[PipelineState] = []
    for job in jobs:
        out.append(process_job(settings, job))
    return out
