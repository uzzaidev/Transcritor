from __future__ import annotations

import json
import sys
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path

from .config import PipelineConfig
from .contracts import PipelineEvent, sanitize_text
from .orchestrator import PipelineOrchestrator
from .real_world_regression import _strip_transcription_banner


@dataclass(slots=True)
class DerivedCaseResult:
    case_id: str
    success: bool
    audit_passed: bool
    audit_issues: list[str]
    sprint_present: bool
    encaminhamentos_present: bool
    kaizens_present: bool
    bloqueios_present: bool
    metricas_present: bool
    sprint_actions_count_ok: bool
    sprint_decisions_count_ok: bool
    metricas_ok: bool


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
    config.output_root = base_output_root / "regression_runs" / f"derived_artifacts_{timestamp}"
    orchestrator = PipelineOrchestrator(config)

    results = [_run_case(orchestrator, workspace, case) for case in cases]
    report = _build_report(results)

    output_root = base_output_root / "regression"
    output_root.mkdir(parents=True, exist_ok=True)
    json_path = output_root / f"derived_artifacts_regression_{timestamp}.json"
    md_path = output_root / f"derived_artifacts_regression_{timestamp}.md"
    json_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    md_path.write_text(_report_to_markdown(report), encoding="utf-8")

    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if report["summary"]["failed_cases"] == 0 else 2


def _run_case(orchestrator: PipelineOrchestrator, workspace: Path, case: dict) -> DerivedCaseResult:
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
    sprint_path = _find_artifact(result.state.arquivos_derivados, "Sprint-")
    encaminhamentos_path = _find_artifact(result.state.arquivos_derivados, "encaminhamentos_")
    kaizens_path = _find_artifact(result.state.arquivos_derivados, "kaizens_")
    bloqueios_path = _find_artifact(result.state.arquivos_derivados, "bloqueios_")
    metricas_path = _find_artifact(result.state.arquivos_derivados, "metricas_")

    sprint_text = _read_text(sprint_path)
    metricas = _parse_metricas(metricas_path)

    return DerivedCaseResult(
        case_id=case["id"],
        success=result.success,
        audit_passed=bool(result.state.audit_result and result.state.audit_result.passed),
        audit_issues=list(result.state.audit_result.issues if result.state.audit_result else ["missing_audit_result"]),
        sprint_present=bool(sprint_path),
        encaminhamentos_present=bool(encaminhamentos_path),
        kaizens_present=bool(kaizens_path),
        bloqueios_present=bool(bloqueios_path),
        metricas_present=bool(metricas_path),
        sprint_actions_count_ok=bool(extraction and f"Ações planejadas: {len(extraction.acoes)}" in sanitize_text(sprint_text)),
        sprint_decisions_count_ok=bool(extraction and f"Decisões registradas: {len(extraction.decisoes)}" in sanitize_text(sprint_text)),
        metricas_ok=bool(
            extraction
            and metricas.get("decisoes") == len(extraction.decisoes)
            and metricas.get("acoes") == len(extraction.acoes)
            and metricas.get("kaizens") == len(extraction.kaizens)
            and metricas.get("riscos") == len(extraction.riscos)
        ),
    )


def _build_report(results: list[DerivedCaseResult]) -> dict:
    failed = [item for item in results if not item.audit_passed]
    return {
        "generated_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "summary": {
            "total_cases": len(results),
            "failed_cases": len(failed),
            "audit_failures": [item.case_id for item in failed],
        },
        "results": [asdict(item) for item in results],
    }


def _report_to_markdown(report: dict) -> str:
    lines = [
        "# Regressão de Derivados",
        "",
        f"- Gerado em: `{report['generated_at']}`",
        f"- Total de casos: `{report['summary']['total_cases']}`",
        f"- Casos com falha: `{report['summary']['failed_cases']}`",
        f"- Falhas de auditoria: `{', '.join(report['summary']['audit_failures']) or 'nenhum'}`",
        "",
        "## Casos",
    ]
    for item in report["results"]:
        lines.extend(
            [
                f"### {item['case_id']}",
                f"- Auditado com sucesso: `{item['audit_passed']}`",
                f"- Issues: `{', '.join(item['audit_issues']) or 'nenhum'}`",
                f"- Sprint presente: `{item['sprint_present']}`",
                f"- Encaminhamentos presente: `{item['encaminhamentos_present']}`",
                f"- Kaizens presente: `{item['kaizens_present']}`",
                f"- Bloqueios presente: `{item['bloqueios_present']}`",
                f"- Métricas presente: `{item['metricas_present']}`",
                f"- Contagem de ações no sprint: `{item['sprint_actions_count_ok']}`",
                f"- Contagem de decisões no sprint: `{item['sprint_decisions_count_ok']}`",
                f"- Métricas consistentes: `{item['metricas_ok']}`",
                "",
            ]
        )
    return "\n".join(lines).strip() + "\n"


def _find_artifact(paths: list[str], needle: str) -> str:
    lowered = needle.lower()
    return next((path for path in paths if lowered in Path(path).name.lower()), "")


def _read_text(path: str) -> str:
    if not path:
        return ""
    file_path = Path(path)
    if not file_path.exists():
        return ""
    return file_path.read_text(encoding="utf-8", errors="ignore")


def _parse_metricas(path: str) -> dict[str, int]:
    text = _read_text(path)
    metrics: dict[str, int] = {}
    for line in text.splitlines():
        stripped = sanitize_text(line)
        if not stripped.startswith("- "):
            continue
        if "=" not in stripped:
            continue
        key, value = stripped[2:].split("=", 1)
        if value.isdigit():
            metrics[key.strip().lower()] = int(value)
    return metrics


if __name__ == "__main__":
    raise SystemExit(main())
