from __future__ import annotations

import json
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from .config import PipelineConfig
from .contracts import ActionItem, AtaExtraction, AuditResult, Decision, EmailPayload, Kaizen, PipelineEvent, PipelineState, RiskItem, ValidationResult


class ArtifactLockRegistry:
    def __init__(self) -> None:
        self._locks: set[str] = set()

    def acquire(self, key: str) -> None:
        if key in self._locks:
            raise RuntimeError(f"artifact_locked:{key}")
        self._locks.add(key)

    def release(self, key: str) -> None:
        self._locks.discard(key)


class OpenAIJsonClient:
    def __init__(self, config: PipelineConfig) -> None:
        self.config = config

    def generate(self, system_prompt: str, user_prompt: str) -> dict | None:
        if not self.config.openai_api_key:
            return None

        payload = {
            "model": self.config.openai_model,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        request = urllib.request.Request(
            url="https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {self.config.openai_api_key}",
                "Content-Type": "application/json",
            },
            data=json.dumps(payload).encode("utf-8"),
            method="POST",
        )
        try:  # pragma: no cover
            with urllib.request.urlopen(request, timeout=90) as response:
                body = json.loads(response.read().decode("utf-8"))
                content = body["choices"][0]["message"]["content"]
                return json.loads(content)
        except Exception:
            return None


@dataclass(slots=True)
class BaseAgent:
    name: str


class AtaAgent(BaseAgent):
    def build_seed(self, event: PipelineEvent, transcript_text: str) -> dict:
        title = event.meeting_title or Path(event.arquivo_fonte).stem.replace("_", " ").replace("-", " ").strip()
        return {
            "titulo": title or "Reunião sem título",
            "data": event.meeting_date or date.today().isoformat(),
            "transcricao": transcript_text.strip(),
        }


class ExtractorAgent(BaseAgent):
    def __init__(self, name: str, llm_client: OpenAIJsonClient) -> None:
        super().__init__(name)
        self.llm_client = llm_client

    def extract(self, event: PipelineEvent, seed: dict) -> AtaExtraction:
        system_prompt = "Você extrai atas empresariais em JSON. Retorne resumo_executivo, topicos, decisoes, acoes, kaizens e riscos."
        user_prompt = (
            f"Título: {seed['titulo']}\nProjeto: {event.projeto}\nSprint: {event.sprint}\n"
            f"Participantes: {', '.join(event.participantes)}\nTranscrição:\n{seed['transcricao']}\n"
            "Regras: use português, gere decisões numeráveis e ações com responsável quando possível."
        )
        structured = self.llm_client.generate(system_prompt, user_prompt)
        if structured:
            return self._from_llm(event, seed["titulo"], structured)
        return self._fallback(event, seed)

    def _from_llm(self, event: PipelineEvent, titulo: str, payload: dict) -> AtaExtraction:
        decisions = [
            Decision(
                id=f"D-{index:03d}",
                titulo=item.get("titulo", f"Decisão {index}"),
                contexto=item.get("contexto", ""),
                decisao=item.get("decisao", ""),
                alternativas=item.get("alternativas", []),
                impacto=item.get("impacto", ""),
            )
            for index, item in enumerate(payload.get("decisoes", []), start=1)
        ]
        actions = [
            ActionItem(
                id=f"A-{index:03d}",
                titulo=item.get("titulo", f"Ação {index}"),
                responsavel=item.get("responsavel", "Responsável a definir"),
                prazo=item.get("prazo", ""),
                prioridade=item.get("prioridade", "media"),
                tags=item.get("tags", []),
            )
            for index, item in enumerate(payload.get("acoes", []), start=1)
        ]
        kaizens = [
            Kaizen(
                id=f"K-{index:03d}",
                categoria=item.get("categoria", "processual"),
                descricao=item.get("descricao", ""),
            )
            for index, item in enumerate(payload.get("kaizens", []), start=1)
        ]
        risks = [
            RiskItem(
                id=f"R-{index:03d}",
                descricao=item.get("descricao", ""),
                probabilidade=int(item.get("probabilidade", 1)),
                impacto=int(item.get("impacto", 1)),
                mitigacao=item.get("mitigacao", ""),
            )
            for index, item in enumerate(payload.get("riscos", []), start=1)
        ]
        return AtaExtraction(
            titulo=titulo,
            resumo_executivo=payload.get("resumo_executivo", ""),
            topicos=payload.get("topicos", []),
            decisoes=decisions,
            acoes=actions,
            kaizens=kaizens,
            riscos=risks,
            participantes=event.participantes,
            projeto=event.projeto,
            sprint=event.sprint,
        )

    def _fallback(self, event: PipelineEvent, seed: dict) -> AtaExtraction:
        transcript = seed["transcricao"]
        sentences = [item.strip() for item in re.split(r"(?<=[.!?])\s+", transcript) if item.strip()]
        summary = " ".join(sentences[:3])[:500] if sentences else "Resumo pendente a partir da transcrição."
        topicos = sentences[:5] if sentences else ["Discussão geral"]
        decisions = []
        actions = []
        if sentences:
            decisions.append(Decision(id="D-001", titulo="Direcionamento técnico inicial", contexto=sentences[0], decisao=sentences[0]))
            responsavel = event.participantes[0] if event.participantes else "Responsável a definir"
            actions.append(ActionItem(id="A-001", titulo="Consolidar requisitos da reunião", responsavel=responsavel, tags=["encaminhamento", f"project:{event.projeto}"]))
        kaizens = [Kaizen(id="K-001", categoria="processual", descricao="Manter ata estruturada e rastreável.")]
        risks = [RiskItem(id="R-001", descricao="Metadados ausentes podem quebrar derivados.", probabilidade=2, impacto=4, mitigacao="Validar schema antes de publicar.")]
        return AtaExtraction(
            titulo=seed["titulo"],
            resumo_executivo=summary,
            topicos=topicos,
            decisoes=decisions,
            acoes=actions,
            kaizens=kaizens,
            riscos=risks,
            participantes=event.participantes,
            projeto=event.projeto,
            sprint=event.sprint,
        )


class NormalizerAgent(BaseAgent):
    def normalize(self, state: PipelineState) -> str:
        extraction = state.ata_extraction
        if extraction is None:
            raise ValueError("ata_extraction_missing")

        participants = ", ".join(f"[[{name}]]" for name in extraction.participantes) or "[[A definir]]"
        lines = [
            "---",
            "tipo: ata",
            f"data: {state.event.meeting_date or date.today().isoformat()}",
            f"projeto: {extraction.projeto}",
            f"sprint: {extraction.sprint}",
            f"participantes: [{participants}]",
            f"decisoes_count: {len(extraction.decisoes)}",
            f"acoes_count: {len(extraction.acoes)}",
            f"kaizens_count: {len(extraction.kaizens)}",
            f"bloqueios_count: {len(extraction.riscos)}",
            "versao: 2.0",
            "---",
            "",
            f"# ATA — {extraction.titulo}",
            "",
            "## Resumo Executivo",
            extraction.resumo_executivo or "Resumo pendente.",
            "",
            "## Tópicos Discutidos",
        ]
        lines.extend(f"- {item}" for item in extraction.topicos or ["Sem tópicos identificados."])
        lines.extend(["", "## Decisões"])
        if extraction.decisoes:
            for decision in extraction.decisoes:
                lines.extend([
                    f"### {decision.id} — {decision.titulo}",
                    f"**Contexto:** {decision.contexto or 'Não informado.'}",
                    f"**Decisão:** {decision.decisao or 'Não informada.'}",
                    f"**Alternativas:** {', '.join(decision.alternativas) if decision.alternativas else 'Não registradas.'}",
                    f"**Impacto:** {decision.impacto or 'A avaliar.'}",
                    "",
                ])
        else:
            lines.append("- Nenhuma decisão estruturada identificada.")

        lines.extend(["## Encaminhamentos"])
        if extraction.acoes:
            for action in extraction.acoes:
                responsible = f"[[{action.responsavel}]]" if not action.responsavel.startswith("[[") else action.responsavel
                tags = " ".join(f"#{tag}" if not tag.startswith("#") else tag for tag in (action.tags or ["encaminhamento"]))
                due = f" 📅 {action.prazo}" if action.prazo else ""
                lines.append(f"- [ ] **{action.id}: {action.titulo}** {responsible}{due} 🏷️ project:{extraction.projeto} {tags} priority:{action.prioridade.lower()} #sprint/{extraction.sprint}")
        else:
            lines.append("- [ ] **A-001: Revisar ata e definir próximos passos** [[Responsável a definir]] 🏷️ project:GERAL #encaminhamento")

        lines.extend(["", "## Kaizens"])
        lines.extend(f"- **{item.id} ({item.categoria})**: {item.descricao}" for item in extraction.kaizens)
        lines.extend(["", "## Riscos e Bloqueios"])
        lines.extend(f"- **{item.id}**: {item.descricao} | severidade={item.severidade} | mitigação={item.mitigacao or 'A definir'}" for item in extraction.riscos)
        return "\n".join(lines).strip() + "\n"


class ValidatorAgent(BaseAgent):
    def validate(self, state: PipelineState, min_score: int) -> ValidationResult:
        extraction = state.ata_extraction
        errors = []
        warnings = []
        score = 100
        if extraction is None:
            return ValidationResult(valid=False, score=0, errors=["ata_extraction_missing"])
        if not extraction.projeto:
            errors.append("missing_projeto")
            score -= 20
        if not extraction.sprint:
            errors.append("missing_sprint")
            score -= 20
        if not extraction.participantes:
            errors.append("missing_participantes")
            score -= 10
        if not extraction.resumo_executivo:
            errors.append("missing_resumo_executivo")
            score -= 10
        if not state.ata_markdown_final.startswith("---"):
            errors.append("missing_frontmatter")
            score -= 25
        if "#encaminhamento" not in state.ata_markdown_final:
            errors.append("missing_encaminhamento_tag")
            score -= 15
        if f"#sprint/{extraction.sprint}" not in state.ata_markdown_final:
            errors.append("missing_sprint_tag")
            score -= 15
        if "[[" not in state.ata_markdown_final:
            warnings.append("missing_wikilinks")
            score -= 5
        if not extraction.decisoes:
            warnings.append("no_decisions_detected")
            score -= 5
        return ValidationResult(valid=score >= min_score and not errors, score=max(score, 0), errors=errors, warnings=warnings)


class SprintAgent(BaseAgent):
    def build_artifact(self, state: PipelineState) -> tuple[str, str]:
        extraction = state.ata_extraction
        assert extraction is not None
        content = "\n".join([
            f"# {extraction.sprint}",
            "",
            f"- Projeto: {extraction.projeto}",
            f"- Participantes: {', '.join(extraction.participantes)}",
            f"- Atas vinculadas: {Path(state.event.arquivo_fonte).name}",
            f"- Ações planejadas: {len(extraction.acoes)}",
            f"- Decisões registradas: {len(extraction.decisoes)}",
        ])
        return f"{extraction.sprint}.md", content


class DashboardAgent(BaseAgent):
    def __init__(self, name: str, dashboard_type: str) -> None:
        super().__init__(name)
        self.dashboard_type = dashboard_type

    def build_artifact(self, state: PipelineState) -> tuple[str, str]:
        extraction = state.ata_extraction
        assert extraction is not None
        if self.dashboard_type == "encaminhamentos":
            rows = [f"- {action.id}: {action.titulo} -> {action.responsavel}" for action in extraction.acoes]
        elif self.dashboard_type == "kaizens":
            rows = [f"- {item.id}: {item.descricao}" for item in extraction.kaizens]
        elif self.dashboard_type == "bloqueios":
            rows = [f"- {item.id}: {item.descricao} (sev={item.severidade})" for item in extraction.riscos]
        else:
            rows = [
                f"- decisoes={len(extraction.decisoes)}",
                f"- acoes={len(extraction.acoes)}",
                f"- kaizens={len(extraction.kaizens)}",
                f"- riscos={len(extraction.riscos)}",
            ]
        file_name = f"{self.dashboard_type}_{_safe_slug(extraction.titulo)}.md"
        return file_name, "\n".join([f"# Dashboard {self.dashboard_type.title()}", "", *rows])


class DeliveryIntegratorAgent(BaseAgent):
    def build_email(self, state: PipelineState) -> EmailPayload:
        extraction = state.ata_extraction
        assert extraction is not None
        decisions = "\n".join(f"- {item.id}: {item.titulo}" for item in extraction.decisoes) or "- Nenhuma decisão registrada"
        actions = "\n".join(f"- {item.id}: {item.titulo} ({item.responsavel})" for item in extraction.acoes) or "- Nenhum encaminhamento registrado"
        return EmailPayload(
            subject=f"[ATA] {extraction.projeto} - {extraction.titulo}",
            body_text=(
                f"{extraction.titulo}\n\nResumo executivo:\n{extraction.resumo_executivo}\n\n"
                f"Decisões principais:\n{decisions}\n\nEncaminhamentos:\n{actions}\n\n"
                "Ata completa disponível no artefato markdown gerado pelo pipeline."
            ),
            body_html=(
                f"<h1>{extraction.titulo}</h1>"
                f"<h2>Resumo Executivo</h2><p>{_html_escape(extraction.resumo_executivo)}</p>"
                f"<h2>Decisões Principais</h2><pre>{_html_escape(decisions)}</pre>"
                f"<h2>Encaminhamentos</h2><pre>{_html_escape(actions)}</pre>"
                "<p>Ata completa disponível no artefato markdown gerado pelo pipeline.</p>"
            ),
            to=state.event.destinatarios,
        )


class AuditorAgent(BaseAgent):
    def audit(self, state: PipelineState) -> AuditResult:
        extraction = state.ata_extraction
        validation = state.validation_result
        if extraction is None or validation is None:
            return AuditResult(passed=False, issues=["missing_state_for_audit"])
        issues = list(validation.errors)
        if extraction.acoes and not any("encaminhamentos" in item for item in state.arquivos_derivados):
            issues.append("missing_encaminhamentos_artifact")
        if extraction.kaizens and not any("kaizens" in item for item in state.arquivos_derivados):
            issues.append("missing_kaizens_artifact")
        if extraction.riscos and not any("bloqueios" in item for item in state.arquivos_derivados):
            issues.append("missing_bloqueios_artifact")
        return AuditResult(passed=not issues, issues=issues)


def run_parallel_derivations(state: PipelineState, output_root: Path, sprint_agent: SprintAgent, dashboard_agents: list[DashboardAgent]) -> list[str]:
    generated_files = []

    def write_artifact(target_dir: Path, builder) -> str:
        file_name, content = builder(state)
        target_dir.mkdir(parents=True, exist_ok=True)
        path = target_dir / file_name
        path.write_text(content, encoding="utf-8")
        return str(path)

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(write_artifact, output_root / "sprints", sprint_agent.build_artifact)]
        for agent in dashboard_agents:
            futures.append(executor.submit(write_artifact, output_root / "dashboards", agent.build_artifact))
        for future in futures:
            generated_files.append(future.result())
    return generated_files


def _safe_slug(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return cleaned or "ata"


def _html_escape(value: str) -> str:
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
