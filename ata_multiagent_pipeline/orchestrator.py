from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from .agents import ArtifactLockRegistry, AtaAgent, AuditorAgent, DashboardAgent, DeliveryIntegratorAgent, ExtractorAgent, NormalizerAgent, OpenAIJsonClient, SprintAgent, ValidatorAgent, run_parallel_derivations
from .config import PipelineConfig
from .contracts import PipelineEvent, PipelineResult, PipelineState
from .emailing import SmtpEmailProvider
from .gitops import GitIntegrator
from .logging_utils import StructuredLogger
from .scriptops import ScriptOps


class PipelineOrchestrator:
    def __init__(self, config: PipelineConfig) -> None:
        self.config = config
        self.locks = ArtifactLockRegistry()
        self.llm_client = OpenAIJsonClient(config)
        self.ata_agent = AtaAgent("orquestrador_ata")
        self.extractor = ExtractorAgent("extrator", self.llm_client)
        self.normalizer = NormalizerAgent("normalizador")
        self.validator = ValidatorAgent("validador")
        self.sprint_agent = SprintAgent("sprint")
        self.dashboard_agents = [
            DashboardAgent("dashboard_encaminhamentos", "encaminhamentos"),
            DashboardAgent("dashboard_kaizens", "kaizens"),
            DashboardAgent("dashboard_bloqueios", "bloqueios"),
            DashboardAgent("dashboard_metricas", "metricas"),
        ]
        self.delivery_integrator = DeliveryIntegratorAgent("integrador_entrega")
        self.auditor = AuditorAgent("auditor")
        self.git_integrator = GitIntegrator(config)
        self.scriptops = ScriptOps(config, self.git_integrator)

    def run(self, event: PipelineEvent) -> PipelineResult:
        self.config.output_root.mkdir(parents=True, exist_ok=True)
        logger = StructuredLogger(self.config.output_root / "logs" / "pipeline.log")
        source_path = self._resolve_source_path(event.arquivo_fonte)
        transcript_text = event.transcript_text or source_path.read_text(encoding="utf-8")
        state = PipelineState(event=event, arquivo_fonte=source_path, transcript_text=transcript_text)
        self._log(state, logger, "orchestrator", "started", {"source": str(source_path)})

        lock_key = str(source_path)
        self.locks.acquire(lock_key)
        try:
            seed = self.ata_agent.build_seed(event, transcript_text)
            self._log(state, logger, "ata_agent", "seed_built", {"title": seed["titulo"]})

            state.ata_extraction = self.extractor.extract(event, seed)
            state.ata_resumo_executivo = state.ata_extraction.resumo_executivo
            self._log(state, logger, "extractor", "completed", {"decisions": len(state.ata_extraction.decisoes), "actions": len(state.ata_extraction.acoes)})

            state.ata_markdown_final = self.normalizer.normalize(state)
            ata_output = self.config.output_root / "atas"
            ata_output.mkdir(parents=True, exist_ok=True)
            ata_filename = f"{self._meeting_date(event)}-{_safe_name(state.ata_extraction.titulo)}.md"
            ata_path = ata_output / ata_filename
            ata_path.write_text(state.ata_markdown_final, encoding="utf-8")
            state.arquivos_derivados.append(str(ata_path))
            self._log(state, logger, "normalizer", "completed", {"ata_path": str(ata_path)})

            validation = self.validator.validate(state, self.config.min_validation_score)
            state.validation_result = validation
            state.status_validacao = "validado" if validation.valid else "reprovado"
            self._log(state, logger, "validator", "completed", {"score": validation.score, "errors": validation.errors, "warnings": validation.warnings})

            if not validation.valid:
                state.audit_result = self.auditor.audit(state)
                self._write_result_snapshot(state, success=False)
                return PipelineResult(success=False, state=state)

            state.arquivos_derivados.extend(run_parallel_derivations(state, self.config.output_root, self.sprint_agent, self.dashboard_agents))
            self._log(state, logger, "derivations", "completed", {"artifacts": len(state.arquivos_derivados)})

            state.email_payload = self.delivery_integrator.build_email(state)
            self._log(state, logger, "delivery_integrator", "completed", {"to": state.email_payload.to})
            self._write_email_artifacts(state)

            provider = SmtpEmailProvider(self.config, self.config.output_root / "email" / "sent_registry.json")
            state.delivery_result = provider.send(state.email_payload)
            self._log(state, logger, "email_dispatcher", "completed", {"success": state.delivery_result.success, "error": state.delivery_result.error})

            state.audit_result = self.auditor.audit(state)
            self._log(state, logger, "auditor", "completed", {"passed": state.audit_result.passed, "issues": state.audit_result.issues})

            if state.audit_result.passed:
                git_result = self.git_integrator.publish(
                    self._files_relative_to_workspace(state.arquivos_derivados),
                    f"feat: gera ata pipeline {self._meeting_date(event)}",
                )
                self._log(state, logger, "git_integrator", "completed", git_result)

            email_ok = state.delivery_result.success if state.delivery_result else False
            email_skipped = state.delivery_result and state.delivery_result.error == "smtp_not_configured"
            final_success = state.audit_result.passed and (email_ok or email_skipped)
            self._write_result_snapshot(state, success=final_success)
            return PipelineResult(success=final_success, state=state)
        finally:
            self.locks.release(lock_key)

    def _resolve_source_path(self, raw_path: str) -> Path:
        path = Path(raw_path)
        if not path.is_absolute():
            path = self.config.workspace_root / path
        return path.resolve()

    def _files_relative_to_workspace(self, files: list[str]) -> list[str]:
        relative = []
        for file_path in files:
            try:
                relative.append(str(Path(file_path).resolve().relative_to(self.config.workspace_root)))
            except ValueError:
                relative.append(file_path)
        return relative

    def _log(self, state: PipelineState, logger: StructuredLogger, step: str, status: str, details: dict) -> None:
        state.logs.append({"step": step, "status": status, "details": details})
        logger.log(step, status, details)

    def _write_email_artifacts(self, state: PipelineState) -> None:
        if state.email_payload is None or state.ata_extraction is None:
            return
        email_root = self.config.output_root / "email"
        email_root.mkdir(parents=True, exist_ok=True)
        base_name = f"{self._meeting_date(state.event)}-{_safe_name(state.ata_extraction.titulo)}"
        (email_root / f"{base_name}.txt").write_text(state.email_payload.body_text, encoding="utf-8")
        (email_root / f"{base_name}.html").write_text(state.email_payload.body_html, encoding="utf-8")

    def _write_result_snapshot(self, state: PipelineState, success: bool) -> None:
        result_path = self.config.output_root / "logs" / f"result_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        result_path.parent.mkdir(parents=True, exist_ok=True)
        result_path.write_text(json.dumps(PipelineResult(success=success, state=state).to_dict(), indent=2, ensure_ascii=False), encoding="utf-8")

    def _meeting_date(self, event: PipelineEvent) -> str:
        return event.meeting_date or datetime.today().strftime("%Y-%m-%d")


def _safe_name(value: str) -> str:
    return "".join(char if char.isalnum() or char in {"-", "_"} else "-" for char in value.lower()).strip("-")
