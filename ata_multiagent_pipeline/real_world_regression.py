from __future__ import annotations

import json
import re
import sys
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path

from .config import PipelineConfig
from .contracts import ActionItem, Decision, PipelineEvent, sanitize_text, text_looks_degraded
from .orchestrator import PipelineOrchestrator


@dataclass(slots=True)
class RegressionCaseResult:
    case_id: str
    source: str
    success: bool
    validation_score: int
    decisions: int
    actions: int
    generic_decisions: int
    generic_actions: int
    unresolved_owners: int
    actions_with_due_date: int
    degraded_output: bool
    warnings: list[str]
    errors: list[str]
    generated_ata: str = ""


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    args = argv if argv is not None else sys.argv[1:]
    workspace = Path.cwd()
    manifest_path = Path(args[0]).resolve() if args else workspace / "ata_multiagent_pipeline" / "examples" / "real_world_regression_cases.json"

    cases = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    config = PipelineConfig.from_workspace(workspace)
    config.smtp_dry_run = True
    timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    base_output_root = config.output_root
    config.output_root = base_output_root / "regression_runs" / f"real_world_{timestamp}"
    orchestrator = PipelineOrchestrator(config)

    results: list[RegressionCaseResult] = []
    for case in cases:
        results.append(_run_case(orchestrator, workspace, case))

    report = _build_report(results)
    output_root = base_output_root / "regression"
    output_root.mkdir(parents=True, exist_ok=True)
    json_path = output_root / f"real_world_regression_{timestamp}.json"
    md_path = output_root / f"real_world_regression_{timestamp}.md"
    json_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    md_path.write_text(_report_to_markdown(report), encoding="utf-8")

    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if report["summary"]["failed_cases"] == 0 else 2


def _run_case(orchestrator: PipelineOrchestrator, workspace: Path, case: dict) -> RegressionCaseResult:
    source_path = (workspace / case["source"]).resolve()
    raw_text = source_path.read_text(encoding="utf-8", errors="ignore")
    transcript_text = _strip_transcription_banner(raw_text)

    event = PipelineEvent.from_dict(
        {
            "tipo_evento": "nova_reuniao",
            "arquivo_fonte": str(source_path),
            "projeto": case.get("project", "REGRESSION"),
            "sprint": case.get("sprint", ""),
            "participantes": case.get("participants", []),
            "transcript_text": transcript_text,
            "destinatarios": [],
            "meeting_title": case.get("meeting_title", ""),
            "meeting_date": case.get("meeting_date", ""),
        }
    )

    result = orchestrator.run(event)
    extraction = result.state.ata_extraction
    validation = result.state.validation_result
    decisions = extraction.decisoes if extraction else []
    actions = extraction.acoes if extraction else []

    return RegressionCaseResult(
        case_id=case["id"],
        source=case["source"],
        success=result.success,
        validation_score=validation.score if validation else 0,
        decisions=len(decisions),
        actions=len(actions),
        generic_decisions=sum(1 for item in decisions if _decision_is_generic(item)),
        generic_actions=sum(1 for item in actions if _action_is_generic(item)),
        unresolved_owners=sum(1 for item in actions if "definir" in sanitize_text(item.responsavel).lower()),
        actions_with_due_date=sum(1 for item in actions if _looks_like_iso_date(item.prazo)),
        degraded_output=_case_looks_degraded(result),
        warnings=list(validation.warnings if validation else []),
        errors=list(validation.errors if validation else []),
        generated_ata=next((path for path in result.state.arquivos_derivados if path.endswith(".md") and "\\atas\\" in path), ""),
    )


def _build_report(results: list[RegressionCaseResult]) -> dict:
    failed = [item for item in results if not item.success]
    degraded = [item.case_id for item in results if item.degraded_output]
    generics = [item.case_id for item in results if item.generic_actions or item.generic_decisions]

    return {
        "generated_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "summary": {
            "total_cases": len(results),
            "failed_cases": len(failed),
            "average_validation_score": round(sum(item.validation_score for item in results) / max(len(results), 1), 2),
            "cases_with_generic_output": generics,
            "cases_with_degraded_output": degraded,
        },
        "results": [asdict(item) for item in results],
    }


def _report_to_markdown(report: dict) -> str:
    lines = [
        "# Regressão com Casos Reais",
        "",
        f"- Gerado em: `{report['generated_at']}`",
        f"- Total de casos: `{report['summary']['total_cases']}`",
        f"- Casos com falha: `{report['summary']['failed_cases']}`",
        f"- Score médio de validação: `{report['summary']['average_validation_score']}`",
        f"- Casos com saída genérica: `{', '.join(report['summary']['cases_with_generic_output']) or 'nenhum'}`",
        f"- Casos com saída degradada: `{', '.join(report['summary']['cases_with_degraded_output']) or 'nenhum'}`",
        "",
        "## Casos",
    ]

    for item in report["results"]:
        lines.extend(
            [
                f"### {item['case_id']}",
                f"- Sucesso: `{item['success']}`",
                f"- Score: `{item['validation_score']}`",
                f"- Decisões: `{item['decisions']}`",
                f"- Ações: `{item['actions']}`",
                f"- Decisões genéricas: `{item['generic_decisions']}`",
                f"- Ações genéricas: `{item['generic_actions']}`",
                f"- Responsáveis indefinidos: `{item['unresolved_owners']}`",
                f"- Ações com prazo ISO: `{item['actions_with_due_date']}`",
                f"- Saída degradada: `{item['degraded_output']}`",
                f"- ATA gerada: `{item['generated_ata']}`",
                "",
            ]
        )

    return "\n".join(lines).strip() + "\n"


def _strip_transcription_banner(raw_text: str) -> str:
    lines = raw_text.splitlines()
    markers = ("arquivo:", "duração", "idioma", "modelo:", "device:", "data:", "data de processamento", "transcrição", "transcricao")
    normalized_head = [sanitize_text(line).lower() for line in lines[:12]]
    header_hits = sum(1 for line in normalized_head if any(marker in line for marker in markers))
    if header_hits < 2:
        return sanitize_text(raw_text)

    cleaned: list[str] = []
    skipping = True
    seen_header_metadata = 0
    for line in lines:
        lowered = sanitize_text(line).lower()
        if any(marker in lowered for marker in markers):
            seen_header_metadata += 1
        if skipping:
            if not line.strip():
                if seen_header_metadata >= 2:
                    skipping = False
                continue
            if any(marker in lowered for marker in markers):
                continue
            if set(line.strip()) <= {"=", "-", "ð", "Ÿ", "Ž", "µ", "Ã", "ƒ", "‡", "“", "", "â", "", "±", "ï", "¸", "", "Œ", "", "“", "”", "§", "¤"}:
                continue
            if seen_header_metadata >= 2:
                skipping = False
            else:
                continue
        cleaned.append(line)
    return sanitize_text("\n".join(cleaned))


def _decision_is_generic(item: Decision) -> bool:
    title = sanitize_text(item.titulo).lower()
    return bool(re.fullmatch(r"(decisão|decisao|item|ponto)\s*\d+", title))


def _action_is_generic(item: ActionItem) -> bool:
    title = sanitize_text(item.titulo).lower()
    return bool(re.fullmatch(r"(ação|acao|item|tarefa)\s*\d+", title))


def _looks_like_iso_date(value: str) -> bool:
    return bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", sanitize_text(value)))


def _case_looks_degraded(result) -> bool:
    extraction = result.state.ata_extraction
    if extraction is None:
        return False

    fields = [
        extraction.titulo,
        extraction.resumo_executivo,
        *extraction.topicos,
        *(item.titulo for item in extraction.decisoes),
        *(item.contexto for item in extraction.decisoes),
        *(item.titulo for item in extraction.acoes),
        *(item.responsavel for item in extraction.acoes),
        *extraction.participantes,
    ]
    return any(text_looks_degraded(field) for field in fields)


if __name__ == "__main__":
    raise SystemExit(main())
