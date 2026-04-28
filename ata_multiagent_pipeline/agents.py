from __future__ import annotations

import json
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from .config import PipelineConfig
from .contracts import ActionItem, AtaExtraction, AuditResult, Decision, EmailPayload, Kaizen, PipelineEvent, PipelineState, RiskItem, ValidationResult, normalize_participant_name, sanitize_text, slugify_filename, text_looks_degraded


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
        title = self._resolve_title(event, transcript_text)
        return {
            "titulo": title or "Reunião sem título",
            "data": event.meeting_date or date.today().isoformat(),
            "transcricao": transcript_text.strip(),
        }

    def _resolve_title(self, event: PipelineEvent, transcript_text: str) -> str:
        provided_title = sanitize_text(event.meeting_title)
        if provided_title and not text_looks_degraded(provided_title):
            return provided_title

        inferred_title = _infer_title_from_transcript(transcript_text)
        if inferred_title:
            return inferred_title

        source_title = sanitize_text(Path(event.arquivo_fonte).stem.replace("_", " ").replace("-", " ").strip())
        if source_title and not source_title.lower().startswith(("transcricao voz", "transcricao", "voz ")):
            return source_title
        return provided_title or source_title or "Reunião sem título"


class ExtractorAgent(BaseAgent):
    def __init__(self, name: str, llm_client: OpenAIJsonClient) -> None:
        super().__init__(name)
        self.llm_client = llm_client

    def extract(self, event: PipelineEvent, seed: dict) -> AtaExtraction:
        system_prompt = (
            "Você extrai atas empresariais em JSON. "
            "Retorne resumo_executivo, topicos, decisoes, acoes, kaizens e riscos. "
            "Não use placeholders como 'Acao 1', 'Decisao 1', 'Item 1' ou textos genéricos. "
            "Cada ação precisa ter verbo claro e objetivo específico. "
            "Se não houver responsável explícito, escolha o participante mais provável ou use 'Responsável a definir'."
        )
        user_prompt = (
            f"Titulo: {seed['titulo']}\nProjeto: {event.projeto}\nSprint: {event.sprint}\n"
            f"Participantes: {', '.join(event.participantes)}\nTranscricao:\n{seed['transcricao']}\n"
            "Regras: use português, gere decisões numeráveis e ações com responsável quando possível. "
            "Evite repetir frases vagas e não devolva nomes genéricos para ações ou decisões."
        )
        structured = self.llm_client.generate(system_prompt, user_prompt)
        if structured and _is_structured_payload_usable(structured):
            try:
                return self._merge_with_fallback(event, seed, self._from_llm(event, seed["titulo"], structured))
            except Exception:
                pass
        return self._fallback(event, seed)

    def _from_llm(self, event: PipelineEvent, titulo: str, payload: dict) -> AtaExtraction:
        decisions = [
            Decision(
                id=f"D-{index:03d}",
                titulo=sanitize_text(item.get("titulo") or item.get("descricao") or f"Decisao {index}"),
                contexto=sanitize_text(item.get("contexto", "")),
                decisao=sanitize_text(item.get("decisao") or item.get("descricao", "")),
                alternativas=[sanitize_text(option) for option in item.get("alternativas", []) if sanitize_text(option)],
                impacto=sanitize_text(item.get("impacto", "")),
            )
            for index, item in enumerate(payload.get("decisoes", []), start=1)
        ]
        default_owner = _default_owner_from_participants(event.participantes)
        actions = [
            ActionItem(
                id=f"A-{index:03d}",
                titulo=sanitize_text(item.get("titulo") or item.get("descricao") or f"Acao {index}"),
                responsavel=_normalize_action_owner(
                    sanitize_text(item.get("responsavel", "Responsável a definir")),
                    default_owner,
                ),
                prazo=_normalize_due_date(sanitize_text(item.get("prazo", "")), event.meeting_date),
                prioridade=sanitize_text(item.get("prioridade", "media")) or "media",
                tags=[sanitize_text(tag) for tag in item.get("tags", []) if sanitize_text(tag)],
            )
            for index, item in enumerate(payload.get("acoes", []), start=1)
        ]
        kaizens = [
            Kaizen(
                id=f"K-{index:03d}",
                categoria=sanitize_text(item.get("categoria", "processual")) or "processual",
                descricao=sanitize_text(item.get("descricao", "")),
            )
            for index, item in enumerate(payload.get("kaizens", []), start=1)
        ]
        risks = []
        for index, item in enumerate(payload.get("riscos", []), start=1):
            if isinstance(item, str):
                risks.append(
                    RiskItem(
                        id=f"R-{index:03d}",
                        descricao=sanitize_text(item),
                        probabilidade=1,
                        impacto=2,
                        mitigacao="Acompanhar evolução do projeto e revisar o risco periodicamente.",
                    )
                )
                continue
            risks.append(
                    RiskItem(
                        id=f"R-{index:03d}",
                        descricao=sanitize_text(item.get("descricao", "")),
                        probabilidade=_coerce_risk_level(item.get("probabilidade", 1)),
                        impacto=_coerce_risk_level(item.get("impacto", 1)),
                        mitigacao=sanitize_text(item.get("mitigacao", "")),
                    )
                )
        return AtaExtraction(
            titulo=sanitize_text(titulo),
            resumo_executivo=sanitize_text(payload.get("resumo_executivo", "")),
            topicos=[sanitize_text(topic) for topic in payload.get("topicos", []) if sanitize_text(topic)],
            decisoes=decisions,
            acoes=actions,
            kaizens=kaizens,
            riscos=risks,
            participantes=[normalize_participant_name(sanitize_text(name)) for name in event.participantes if sanitize_text(name)],
            projeto=sanitize_text(event.projeto),
            sprint=sanitize_text(event.sprint),
        )

    def _fallback(self, event: PipelineEvent, seed: dict) -> AtaExtraction:
        transcript = seed["transcricao"]
        sentences = _split_sentences(transcript)
        topicos = _extract_topics(sentences)
        decisions = _extract_decisions(sentences)
        actions = _extract_actions(sentences, event.participantes, event.meeting_date)
        kaizens = _extract_kaizens(sentences)
        risks = _extract_risks(sentences, decisions)

        if not decisions and sentences:
            decisions.append(
                Decision(
                    id="D-001",
                    titulo="Direcionamento técnico inicial",
                    contexto=sentences[0],
                    decisao=sentences[0],
                    impacto="Define o rumo inicial da implementação.",
                )
            )

        if not actions and sentences:
            responsavel = event.participantes[0] if event.participantes else "Responsável a definir"
            actions.append(
                ActionItem(
                    id="A-001",
                    titulo="Consolidar requisitos da reunião",
                    responsavel=responsavel,
                    tags=["encaminhamento"],
                )
            )

        if not kaizens:
            kaizens = [Kaizen(id="K-001", categoria="processual", descricao="Manter ata estruturada e rastreável.")]

        if not risks:
            risks = [RiskItem(id="R-001", descricao="Metadados ausentes podem quebrar derivados.", probabilidade=2, impacto=4, mitigacao="Validar schema antes de publicar.")]

        summary = _build_summary(seed["titulo"], decisions, actions, topicos, event.projeto)
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

    def _merge_with_fallback(self, event: PipelineEvent, seed: dict, structured: AtaExtraction) -> AtaExtraction:
        fallback = self._fallback(event, seed)

        decisions = structured.decisoes
        if _collection_is_generic(structured.decisoes, "decision"):
            decisions = fallback.decisoes
        else:
            decisions = _merge_decisions(structured.decisoes, fallback.decisoes)

        actions = structured.acoes
        if _collection_is_generic(structured.acoes, "action"):
            actions = fallback.acoes
        else:
            actions = _merge_actions(structured.acoes, fallback.acoes)

        kaizens = structured.kaizens or fallback.kaizens
        risks = structured.riscos or fallback.riscos
        topicos = structured.topicos or fallback.topicos
        resumo = structured.resumo_executivo or fallback.resumo_executivo

        return AtaExtraction(
            titulo=structured.titulo or fallback.titulo,
            resumo_executivo=resumo,
            topicos=topicos,
            decisoes=decisions,
            acoes=actions,
            kaizens=kaizens,
            riscos=risks,
            participantes=structured.participantes or fallback.participantes,
            projeto=structured.projeto or fallback.projeto,
            sprint=structured.sprint or fallback.sprint,
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
            f"# ATA - {extraction.titulo}",
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
                    f"### {decision.id} - {decision.titulo}",
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
                due = f" prazo:{action.prazo}" if action.prazo else ""
                lines.append(f"- [ ] **{action.id}: {action.titulo}** {responsible}{due} project:{extraction.projeto} {tags} priority:{action.prioridade.lower()} #sprint/{extraction.sprint}")
        else:
            lines.append(f"- [ ] **A-001: Revisar ata e definir próximos passos** [[Responsável a definir]] project:{extraction.projeto} #encaminhamento priority:media #sprint/{extraction.sprint}")

        lines.extend(["", "## Kaizens"])
        lines.extend(f"- **{item.id} ({item.categoria})**: {item.descricao}" for item in extraction.kaizens)
        lines.extend(["", "## Riscos e Bloqueios"])
        lines.extend(f"- **{item.id}**: {item.descricao} | severidade={item.severidade} | mitigação={item.mitigacao or 'A definir'}" for item in extraction.riscos)
        return "\n".join(lines).strip() + "\n"


class ValidatorAgent(BaseAgent):
    def validate(self, state: PipelineState, min_score: int) -> ValidationResult:
        extraction = state.ata_extraction
        errors: list[str] = []
        warnings: list[str] = []
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
        if any("definir" in sanitize_text(action.responsavel).lower() for action in extraction.acoes):
            warnings.append("actions_with_unresolved_owner")
            score -= 10
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
        ata_text = _strip_frontmatter(state.ata_markdown_final).strip() or "ATA indisponível."
        return EmailPayload(
            subject=f"[ATA] {extraction.projeto} - {extraction.titulo}",
            body_text=f"ATA gerada automaticamente pelo pipeline.\n\n{ata_text}\n",
            body_html=_markdown_to_email_html(ata_text, extraction.titulo),
            to=state.event.destinatarios,
        )


class AuditorAgent(BaseAgent):
    def audit(self, state: PipelineState) -> AuditResult:
        extraction = state.ata_extraction
        validation = state.validation_result
        if extraction is None or validation is None:
            return AuditResult(passed=False, issues=["missing_state_for_audit"])
        issues = list(validation.errors)
        sprint_artifact = _find_artifact(state.arquivos_derivados, "sprint-")
        encaminhamentos_artifact = _find_artifact(state.arquivos_derivados, "encaminhamentos")
        kaizens_artifact = _find_artifact(state.arquivos_derivados, "kaizens")
        bloqueios_artifact = _find_artifact(state.arquivos_derivados, "bloqueios")
        metricas_artifact = _find_artifact(state.arquivos_derivados, "metricas")

        if not sprint_artifact:
            issues.append("missing_sprint_artifact")
        else:
            sprint_text = _read_artifact_text(sprint_artifact)
            if extraction.projeto not in sprint_text:
                issues.append("sprint_missing_project")
            if extraction.sprint not in sprint_text:
                issues.append("sprint_missing_sprint_name")
            if str(len(extraction.acoes)) not in sprint_text:
                issues.append("sprint_missing_actions_count")
            if str(len(extraction.decisoes)) not in sprint_text:
                issues.append("sprint_missing_decisions_count")

        if extraction.acoes and not encaminhamentos_artifact:
            issues.append("missing_encaminhamentos_artifact")
        elif encaminhamentos_artifact:
            dashboard_rows = _artifact_bullet_rows(encaminhamentos_artifact)
            if len(dashboard_rows) != len(extraction.acoes):
                issues.append("encaminhamentos_count_mismatch")

        if extraction.kaizens and not kaizens_artifact:
            issues.append("missing_kaizens_artifact")
        elif kaizens_artifact:
            dashboard_rows = _artifact_bullet_rows(kaizens_artifact)
            if len(dashboard_rows) != len(extraction.kaizens):
                issues.append("kaizens_count_mismatch")

        if extraction.riscos and not bloqueios_artifact:
            issues.append("missing_bloqueios_artifact")
        elif bloqueios_artifact:
            dashboard_rows = _artifact_bullet_rows(bloqueios_artifact)
            if len(dashboard_rows) != len(extraction.riscos):
                issues.append("bloqueios_count_mismatch")

        if not metricas_artifact:
            issues.append("missing_metricas_artifact")
        else:
            metrics = _parse_metricas_artifact(metricas_artifact)
            if metrics.get("decisoes") != len(extraction.decisoes):
                issues.append("metricas_decisoes_mismatch")
            if metrics.get("acoes") != len(extraction.acoes):
                issues.append("metricas_acoes_mismatch")
            if metrics.get("kaizens") != len(extraction.kaizens):
                issues.append("metricas_kaizens_mismatch")
            if metrics.get("riscos") != len(extraction.riscos):
                issues.append("metricas_riscos_mismatch")
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


def _split_sentences(transcript: str) -> list[str]:
    normalized = re.sub(r"\s+", " ", transcript).strip()
    if not normalized:
        return []
    return [item.strip(" -") for item in re.split(r"(?<=[.!?])\s+", normalized) if item.strip()]


def _extract_topics(sentences: list[str]) -> list[str]:
    keyword_topics = [
        ("next", "Arquitetura em Next.js"),
        ("react", "Uso de React na aplicação"),
        ("tailwind", "Padronização visual com Tailwind"),
        ("neon", "Definição do banco de dados Neon"),
        ("autentica", "Escopo de autenticação"),
        ("login", "Necessidade de login no MVP"),
        ("arquivo", "Criação inicial dos arquivos do projeto"),
        ("instal", "Instalação inicial de dependências"),
    ]
    found: list[str] = []
    lowered = " ".join(sentences).lower()
    for token, topic in keyword_topics:
        if token in lowered and topic not in found:
            found.append(topic)
    return found or sentences[:5] or ["Discussão geral"]


def _extract_decisions(sentences: list[str]) -> list[Decision]:
    decisions: list[Decision] = []
    seen_titles: set[str] = set()
    rules = [
        (r"\bnext\b", "Arquitetura base em Next.js", "Adotar Next.js como base da arquitetura web.", "Padroniza estrutura frontend e SSR."),
        (r"\breact\b", "Frontend em React", "Utilizar React como biblioteca principal da interface.", "Mantém o frontend alinhado ao stack definido."),
        (r"\btailwind\b", "Estilização com Tailwind", "Usar Tailwind CSS como camada principal de estilos.", "Centraliza o sistema visual e acelera a implementação."),
        (r"\bcentralizad[ao].*tailwind|\btemas das cores", "Temas centralizados no Tailwind", "Centralizar cores, temas e tokens visuais no Tailwind.", "Facilita consistência visual e manutenção futura."),
        (r"\bneon\b", "Banco de dados em Neon", "Usar Neon como base de dados inicial do projeto.", "Define o serviço de persistência para a primeira versão."),
        (r"n[aã]o precisa.*autentica|n[aã]o precisa.*login", "Sem autenticação no momento inicial", "Não implementar login ou autenticação nesta primeira fase.", "Reduz escopo do MVP e acelera a entrega inicial."),
        (r"come[cç]a a criar os arquivos|criar os arquivos", "Gerar estrutura inicial do projeto", "Começar o projeto já criando os arquivos e a estrutura base.", "Acelera o bootstrap e reduz trabalho manual."),
        (r"install|instal", "Instalar dependências iniciais", "Instalar as dependências necessárias já no início da geração do projeto.", "Deixa o ambiente pronto para evolução imediata."),
    ]

    for sentence in sentences:
        lowered = sentence.lower()
        for pattern, title, decision_text, impact in rules:
            if re.search(pattern, lowered) and title not in seen_titles:
                decisions.append(
                    Decision(
                        id=f"D-{len(decisions) + 1:03d}",
                        titulo=title,
                        contexto=sentence,
                        decisao=decision_text,
                        impacto=impact,
                    )
                )
                seen_titles.add(title)
    return decisions


def _extract_actions(sentences: list[str], participants: list[str], meeting_date: str = "") -> list[ActionItem]:
    actions: list[ActionItem] = []
    rules = [
        (r"\bnext\b", "Criar a base do projeto em Next.js com React"),
        (r"\btailwind\b", "Configurar Tailwind CSS e centralizar os temas visuais"),
        (r"\bneon\b", "Preparar a integração inicial com o banco Neon"),
        (r"n[aã]o precisa.*autentica|n[aã]o precisa.*login", "Registrar que a autenticação fica fora do escopo inicial"),
        (r"criar os arquivos|come[cç]a a criar", "Gerar os arquivos iniciais e a estrutura do projeto"),
        (r"install|instal", "Instalar as dependências necessárias do projeto"),
    ]

    for sentence in sentences:
        lowered = sentence.lower()
        for pattern, title in rules:
            if re.search(pattern, lowered) and not any(action.titulo == title for action in actions):
                owner = _infer_owner_for_sentence(sentence, participants)
                due_date = _extract_due_date(sentence, meeting_date)
                actions.append(
                    ActionItem(
                        id=f"A-{len(actions) + 1:03d}",
                        titulo=title,
                        responsavel=owner,
                        prazo=due_date,
                        prioridade="media",
                        tags=["encaminhamento"],
                    )
                )
    return actions


def _extract_kaizens(sentences: list[str]) -> list[Kaizen]:
    kaizens: list[Kaizen] = []
    transcript = " ".join(sentences).lower()
    if "gravei" in transcript or "repita" in transcript:
        kaizens.append(
            Kaizen(
                id="K-001",
                categoria="comunicação",
                descricao="Registrar requisitos em áudio ou prompt reutilizável para evitar retrabalho nas repetições.",
            )
        )
    if "centralizado" in transcript and "tailwind" in transcript:
        kaizens.append(
            Kaizen(
                id=f"K-{len(kaizens) + 1:03d}",
                categoria="arquitetura",
                descricao="Centralizar tokens visuais desde o início para reduzir inconsistências entre telas.",
            )
        )
    return kaizens


def _extract_risks(sentences: list[str], decisions: list[Decision]) -> list[RiskItem]:
    risks: list[RiskItem] = []
    transcript = " ".join(sentences).lower()
    if "autentica" in transcript or "login" in transcript:
        risks.append(
            RiskItem(
                id="R-001",
                descricao="A ausência inicial de autenticação pode gerar débito técnico e risco de segurança ao expandir o produto.",
                probabilidade=2,
                impacto=4,
                mitigacao="Registrar o tema no backlog e tratar antes de expor funcionalidades sensíveis.",
            )
        )
    if any("Tailwind" in decision.titulo or "Tailwind" in decision.decisao for decision in decisions):
        risks.append(
            RiskItem(
                id=f"R-{len(risks) + 1:03d}",
                descricao="Sem governança dos tokens visuais, o uso de Tailwind pode se fragmentar rapidamente.",
                probabilidade=2,
                impacto=3,
                mitigacao="Definir convenções de tema e classes utilitárias compartilhadas desde o bootstrap.",
            )
        )
    return risks


def _build_summary(titulo: str, decisions: list[Decision], actions: list[ActionItem], topicos: list[str], projeto: str) -> str:
    focus = ", ".join(topic.lower() for topic in topicos[:3]) if topicos else "arquitetura inicial"
    summary = f"Reunião '{titulo}' do projeto {projeto} definiu {focus}."
    if decisions:
        summary += f" Foram registradas {len(decisions)} decisões estruturantes para o bootstrap da solução."
    if actions:
        summary += f" A reunião também gerou {len(actions)} encaminhamentos para execução imediata."
    return summary


def _infer_owner_for_sentence(sentence: str, participants: list[str]) -> str:
    if not participants:
        return "Responsável a definir"

    lowered_sentence = sanitize_text(sentence).lower()
    normalized_participants = [normalize_participant_name(name) for name in participants]

    for participant in normalized_participants:
        tokens = [token for token in re.findall(r"[a-zà-ÿ0-9]+", participant.lower()) if len(token) > 2]
        if tokens and all(token in lowered_sentence for token in tokens[:2]):
            return participant

    if any(token in lowered_sentence for token in {"equipe", "técnica", "tecnica", "time", "dev", "desenvolvimento"}):
        team_participant = next((name for name in normalized_participants if "equipe" in name.lower()), None)
        if team_participant:
            return team_participant

    return normalized_participants[0]


def _extract_due_date(sentence: str, meeting_date: str) -> str:
    lowered_sentence = sanitize_text(sentence).lower()
    base_date = _parse_iso_date(meeting_date)

    explicit_match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", lowered_sentence)
    if explicit_match:
        return explicit_match.group(1)

    brazilian_match = re.search(r"\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b", lowered_sentence)
    if brazilian_match:
        day = int(brazilian_match.group(1))
        month = int(brazilian_match.group(2))
        year_raw = brazilian_match.group(3)
        if year_raw:
            year = int(year_raw) if len(year_raw) == 4 else 2000 + int(year_raw)
        elif base_date:
            year = base_date.year
        else:
            year = date.today().year
        try:
            return date(year, month, day).isoformat()
        except ValueError:
            return ""

    if not base_date:
        return ""

    relative_mapping = {
        "hoje": 0,
        "amanhã": 1,
        "amanha": 1,
        "ontem": -1,
    }
    for token, offset in relative_mapping.items():
        if token in lowered_sentence:
            return (base_date.fromordinal(base_date.toordinal() + offset)).isoformat()

    if "semana que vem" in lowered_sentence or "próxima semana" in lowered_sentence or "proxima semana" in lowered_sentence:
        return (base_date.fromordinal(base_date.toordinal() + 7)).isoformat()

    return ""


def _normalize_due_date(raw_value: str, meeting_date: str) -> str:
    raw = sanitize_text(raw_value)
    if not raw:
        return ""

    lowered = raw.lower()
    base_date = _parse_iso_date(meeting_date)
    if lowered in {"próximo dia", "proximo dia", "dia seguinte", "amanhã", "amanha"} and base_date:
        return date.fromordinal(base_date.toordinal() + 1).isoformat()
    if lowered in {"hoje"} and base_date:
        return base_date.isoformat()
    if lowered in {"próxima semana", "proxima semana", "semana que vem"} and base_date:
        return date.fromordinal(base_date.toordinal() + 7).isoformat()

    iso_match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", raw)
    if iso_match:
        return iso_match.group(1)

    short_match = re.search(r"\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b", raw)
    if short_match:
        day = int(short_match.group(1))
        month = int(short_match.group(2))
        year_raw = short_match.group(3)
        if year_raw:
            year = int(year_raw) if len(year_raw) == 4 else 2000 + int(year_raw)
            if base_date and abs(year - base_date.year) > 1:
                year = base_date.year
        elif base_date:
            year = base_date.year
        else:
            year = date.today().year
        try:
            return date(year, month, day).isoformat()
        except ValueError:
            return raw

    return raw


def _parse_iso_date(value: str) -> date | None:
    raw = sanitize_text(value)
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError:
        return None


def _normalize_action_owner(raw_owner: str, default_owner: str) -> str:
    owner = normalize_participant_name(sanitize_text(raw_owner))
    if owner and "definir" not in owner.lower():
        return owner
    return default_owner or "Responsável a definir"


def _default_owner_from_participants(participants: list[str]) -> str:
    normalized_participants = [normalize_participant_name(sanitize_text(name)) for name in participants if sanitize_text(name)]
    concrete_participants = [name for name in normalized_participants if not _participant_is_role_like(name)]
    if len(concrete_participants) == 1:
        return concrete_participants[0]
    return ""


def _participant_is_role_like(value: str) -> bool:
    lowered = sanitize_text(value).lower()
    role_tokens = {"equipe", "time", "cliente", "fornecedor", "parceiro", "pai", "mae", "mãe", "grupo"}
    return any(token in lowered for token in role_tokens)


def _coerce_risk_level(value: object) -> int:
    if isinstance(value, int):
        return min(max(value, 1), 5)
    raw = str(value).strip().lower()
    if raw.isdigit():
        return min(max(int(raw), 1), 5)
    mapping = {
        "baixo": 1,
        "baixa": 1,
        "low": 1,
        "medio": 3,
        "media": 3,
        "médio": 3,
        "média": 3,
        "medium": 3,
        "alto": 5,
        "alta": 5,
        "high": 5,
    }
    return mapping.get(raw, 1)


def _is_structured_payload_usable(payload: dict) -> bool:
    decisions = payload.get("decisoes", [])
    actions = payload.get("acoes", [])

    has_summary = bool(str(payload.get("resumo_executivo", "")).strip())
    has_topics = bool(payload.get("topicos"))
    if not has_summary or not has_topics:
        return False
    if decisions:
        decision_ok = not _collection_is_generic(_normalize_payload_items(decisions, "decision"), "decision")
        action_ok = not actions or not _collection_is_generic(_normalize_payload_items(actions, "action"), "action")
        return decision_ok and action_ok
    return actions and not _collection_is_generic(_normalize_payload_items(actions, "action"), "action")


def _normalize_payload_items(items: list, kind: str) -> list[Decision] | list[ActionItem]:
    normalized: list[Decision] | list[ActionItem] = []
    for index, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            continue
        if kind == "decision":
            normalized.append(
                Decision(
                    id=f"D-{index:03d}",
                    titulo=sanitize_text(item.get("titulo") or item.get("descricao") or f"Decisão {index}"),
                    contexto=sanitize_text(item.get("contexto", "")),
                    decisao=sanitize_text(item.get("decisao") or item.get("descricao", "")),
                )
            )
        else:
            normalized.append(
                ActionItem(
                    id=f"A-{index:03d}",
                    titulo=sanitize_text(item.get("titulo") or item.get("descricao") or f"Acao {index}"),
                    responsavel=sanitize_text(item.get("responsavel", "Responsável a definir")),
                )
            )
    return normalized


def _collection_is_generic(items: list[Decision] | list[ActionItem], kind: str) -> bool:
    if not items:
        return True

    useful_count = 0
    for item in items:
        if kind == "decision":
            if _decision_is_useful(item):
                useful_count += 1
        else:
            if _action_is_useful(item):
                useful_count += 1

    threshold = max(1, len(items) // 2)
    return useful_count < threshold


def _decision_is_useful(item: Decision) -> bool:
    title = sanitize_text(item.titulo).lower()
    text = " ".join([title, sanitize_text(item.contexto), sanitize_text(item.decisao)]).strip().lower()
    if not text:
        return False
    if re.fullmatch(r"(decis[aã]o|item|ponto)\s*\d+", title):
        return False
    return len(text) >= 20


def _action_is_useful(item: ActionItem) -> bool:
    title = sanitize_text(item.titulo).lower()
    if not title:
        return False
    if re.fullmatch(r"(a[cç][aã]o|acao|item|tarefa)\s*\d+", title):
        return False
    if title in {"ajustar", "verificar", "acompanhar", "alinhar"}:
        return False
    return len(title) >= 12 and " " in title


def _merge_decisions(primary: list[Decision], fallback: list[Decision]) -> list[Decision]:
    merged: list[Decision] = []
    for item in [*primary, *fallback]:
        if not _decision_is_useful(item):
            continue
        overlap_index = next((index for index, existing in enumerate(merged) if _decisions_overlap(item, existing)), -1)
        if overlap_index >= 0:
            merged[overlap_index] = _prefer_richer_decision(merged[overlap_index], item)
            continue
        merged.append(item)
    return _reindex_decisions(merged)


def _merge_actions(primary: list[ActionItem], fallback: list[ActionItem]) -> list[ActionItem]:
    merged: list[ActionItem] = []
    for item in [*primary, *fallback]:
        if not _action_is_useful(item):
            continue
        normalized_item = ActionItem(
            id=item.id,
            titulo=item.titulo,
            responsavel=normalize_participant_name(item.responsavel or "Responsável a definir"),
            prazo=item.prazo,
            prioridade=item.prioridade or "media",
            tags=item.tags or ["encaminhamento"],
        )
        overlap_index = next((index for index, existing in enumerate(merged) if _actions_overlap(normalized_item, existing)), -1)
        if overlap_index >= 0:
            merged[overlap_index] = _prefer_richer_action(merged[overlap_index], normalized_item)
            continue
        merged.append(normalized_item)
    return _reindex_actions(merged)


def _reindex_decisions(items: list[Decision]) -> list[Decision]:
    return [
        Decision(
            id=f"D-{index:03d}",
            titulo=item.titulo,
            contexto=item.contexto,
            decisao=item.decisao,
            alternativas=item.alternativas,
            impacto=item.impacto,
        )
        for index, item in enumerate(items, start=1)
    ]


def _reindex_actions(items: list[ActionItem]) -> list[ActionItem]:
    return [
        ActionItem(
            id=f"A-{index:03d}",
            titulo=item.titulo,
            responsavel=item.responsavel,
            prazo=item.prazo,
            prioridade=item.prioridade,
            tags=item.tags,
        )
        for index, item in enumerate(items, start=1)
    ]


def _prefer_richer_decision(left: Decision, right: Decision) -> Decision:
    if _decision_richness(right) > _decision_richness(left):
        stronger, weaker = right, left
    else:
        stronger, weaker = left, right

    alternatives = stronger.alternativas or weaker.alternativas
    if stronger.alternativas and weaker.alternativas:
        alternatives = list(dict.fromkeys([*stronger.alternativas, *weaker.alternativas]))

    return Decision(
        id=stronger.id,
        titulo=_prefer_longer_text(stronger.titulo, weaker.titulo),
        contexto=_prefer_longer_text(stronger.contexto, weaker.contexto),
        decisao=_prefer_longer_text(stronger.decisao, weaker.decisao),
        alternativas=alternatives,
        impacto=_prefer_longer_text(stronger.impacto, weaker.impacto),
    )


def _prefer_richer_action(left: ActionItem, right: ActionItem) -> ActionItem:
    if _action_richness(right) > _action_richness(left):
        stronger, weaker = right, left
    else:
        stronger, weaker = left, right

    merged_tags = list(dict.fromkeys([*(stronger.tags or []), *(weaker.tags or []), "encaminhamento"]))

    return ActionItem(
        id=stronger.id,
        titulo=_prefer_longer_text(stronger.titulo, weaker.titulo),
        responsavel=_prefer_action_owner(stronger.responsavel, weaker.responsavel),
        prazo=_prefer_action_due_date(stronger.prazo, weaker.prazo),
        prioridade=_prefer_action_priority(stronger.prioridade, weaker.prioridade),
        tags=merged_tags,
    )


def _decision_richness(item: Decision) -> int:
    score = 0
    score += min(len(_meaningful_tokens(item.titulo)), 5)
    score += min(len(_meaningful_tokens(item.contexto)), 6)
    score += min(len(_meaningful_tokens(item.decisao)), 6)
    score += min(len(item.alternativas or []), 3)
    score += min(len(_meaningful_tokens(item.impacto)), 4)
    return score


def _action_richness(item: ActionItem) -> int:
    score = 0
    score += min(len(_meaningful_tokens(item.titulo)), 6)
    if sanitize_text(item.responsavel) and "definir" not in sanitize_text(item.responsavel).lower():
        score += 3
    if sanitize_text(item.prazo):
        score += 3
    if sanitize_text(item.prioridade):
        score += 1
    score += len(item.tags or [])
    return score


def _prefer_longer_text(left: str, right: str) -> str:
    left_clean = sanitize_text(left)
    right_clean = sanitize_text(right)
    if len(right_clean) > len(left_clean):
        return right_clean
    return left_clean or right_clean


def _prefer_action_owner(left: str, right: str) -> str:
    left_clean = normalize_participant_name(sanitize_text(left))
    right_clean = normalize_participant_name(sanitize_text(right))
    if not left_clean or "definir" in left_clean.lower():
        return right_clean or left_clean
    if not right_clean or "definir" in right_clean.lower():
        return left_clean
    return _prefer_longer_text(left_clean, right_clean)


def _prefer_action_due_date(left: str, right: str) -> str:
    left_clean = sanitize_text(left)
    right_clean = sanitize_text(right)
    left_date = _parse_iso_date(left_clean)
    right_date = _parse_iso_date(right_clean)
    if left_date and right_date:
        return left_clean if left_date <= right_date else right_clean
    if left_date:
        return left_clean
    if right_date:
        return right_clean
    return left_clean or right_clean


def _prefer_action_priority(left: str, right: str) -> str:
    left_clean = sanitize_text(left) or "media"
    right_clean = sanitize_text(right) or "media"
    return left_clean if _priority_weight(left_clean) >= _priority_weight(right_clean) else right_clean


def _decisions_overlap(left: Decision, right: Decision) -> bool:
    left_text = f"{left.titulo} {left.decisao}"
    right_text = f"{right.titulo} {right.decisao}"
    return _text_overlap_ratio(left_text, right_text) >= 0.58


def _actions_overlap(left: ActionItem, right: ActionItem) -> bool:
    left_text = f"{left.titulo} {left.responsavel}"
    right_text = f"{right.titulo} {right.responsavel}"
    return _text_overlap_ratio(left_text, right_text) >= 0.55


def _text_overlap_ratio(left: str, right: str) -> float:
    left_tokens = _meaningful_tokens(left)
    right_tokens = _meaningful_tokens(right)
    if not left_tokens or not right_tokens:
        return 0.0
    intersection = left_tokens & right_tokens
    return len(intersection) / min(len(left_tokens), len(right_tokens))


def _meaningful_tokens(text: str) -> set[str]:
    stopwords = {
        "a", "o", "as", "os", "de", "do", "da", "das", "dos", "em", "no", "na",
        "para", "com", "sem", "por", "e", "ou", "um", "uma", "neste", "nesta",
        "ser", "usar", "utilizar", "implementar", "projeto",
    }
    normalized = sanitize_text(text).lower()
    tokens = {token for token in re.findall(r"[a-zà-ÿ0-9]+", normalized) if len(token) > 2 and token not in stopwords}
    return tokens


def _safe_slug(value: str) -> str:
    return slugify_filename(value, fallback="ata")


def _html_escape(value: str) -> str:
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _infer_title_from_transcript(transcript: str) -> str:
    lowered = sanitize_text(transcript).lower()
    if not lowered:
        return ""
    if "next" in lowered and "tailwind" in lowered and "neon" in lowered:
        return "Definição de arquitetura inicial"
    if "ata" in lowered and "sprint" in lowered:
        return "Alinhamento de ata e sprint"

    sentences = _split_sentences(transcript)
    if not sentences:
        return ""
    candidate = sanitize_text(sentences[0]).rstrip(".")
    if len(candidate) > 80:
        candidate = candidate[:77].rstrip() + "..."
    return candidate[:1].upper() + candidate[1:] if candidate else ""


def _markdown_to_email_html(markdown_text: str, title: str) -> str:
    lines = markdown_text.splitlines()
    html_lines = [
        "<html><body style=\"font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#1f2937;\">",
        f"<h1>{_html_escape(title)}</h1>",
    ]
    in_frontmatter = False
    in_list = False

    for raw_line in lines:
        line = raw_line.rstrip()
        stripped = line.strip()

        if stripped == "---":
            in_frontmatter = not in_frontmatter
            continue
        if in_frontmatter or not stripped:
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            continue
        if stripped.startswith("### "):
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            html_lines.append(f"<h3>{_html_escape(stripped[4:])}</h3>")
            continue
        if stripped.startswith("## "):
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            html_lines.append(f"<h2>{_html_escape(stripped[3:])}</h2>")
            continue
        if stripped.startswith("# "):
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            html_lines.append(f"<h2>{_html_escape(stripped[2:])}</h2>")
            continue
        if stripped.startswith("- "):
            if not in_list:
                html_lines.append("<ul>")
                in_list = True
            html_lines.append(f"<li>{_render_inline_markdown(stripped[2:])}</li>")
            continue

        if in_list:
            html_lines.append("</ul>")
            in_list = False
        html_lines.append(f"<p>{_render_inline_markdown(stripped)}</p>")

    if in_list:
        html_lines.append("</ul>")
    html_lines.append("</body></html>")
    return "".join(html_lines)


def _render_inline_markdown(text: str) -> str:
    escaped = _html_escape(text)
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", escaped)
    escaped = re.sub(r"\[\[(.+?)\]\]", r"<strong>\1</strong>", escaped)
    return escaped


def _strip_frontmatter(markdown_text: str) -> str:
    stripped = markdown_text.strip()
    if not stripped.startswith("---"):
        return markdown_text

    lines = markdown_text.splitlines()
    if len(lines) < 3:
        return markdown_text

    end_index = None
    for index in range(1, len(lines)):
        if lines[index].strip() == "---":
            end_index = index
            break
    if end_index is None:
        return markdown_text
    return "\n".join(lines[end_index + 1 :]).lstrip()


def _find_artifact(paths: list[str], needle: str) -> str:
    lowered_needle = needle.lower()
    return next((path for path in paths if lowered_needle in Path(path).name.lower()), "")


def _read_artifact_text(path: str) -> str:
    artifact_path = Path(path)
    if not artifact_path.exists():
        return ""
    return artifact_path.read_text(encoding="utf-8", errors="ignore")


def _artifact_bullet_rows(path: str) -> list[str]:
    text = _read_artifact_text(path)
    return [line for line in text.splitlines() if line.strip().startswith("- ")]


def _parse_metricas_artifact(path: str) -> dict[str, int]:
    metrics: dict[str, int] = {}
    for row in _artifact_bullet_rows(path):
        match = re.match(r"-\s+([a-z_]+)=(\d+)", row.strip(), re.IGNORECASE)
        if match:
            metrics[match.group(1).lower()] = int(match.group(2))
    return metrics
