from __future__ import annotations

import json
import sys
from pathlib import Path

from .config import PipelineConfig
from .contracts import PipelineEvent
from .maintenance import cleanup_legacy_artifacts
from .orchestrator import PipelineOrchestrator


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    args = argv if argv is not None else sys.argv[1:]
    if not args:
        print("Usage: python -m ata_multiagent_pipeline.cli <event.json> [--dry-run-email] | reprocess-latest [--dry-run-email] | cleanup-generated")
        return 1

    command = args[0]
    dry_run_email = "--dry-run-email" in args

    if command == "cleanup-generated":
        config = PipelineConfig.from_workspace(Path.cwd())
        report = cleanup_legacy_artifacts(config.output_root)
        print(json.dumps(report.to_dict(), indent=2, ensure_ascii=False))
        return 0

    if command == "reprocess-latest":
        event_path = _resolve_latest_runtime_event(Path.cwd())
    else:
        event_path = Path(command).resolve()

    payload = json.loads(event_path.read_text(encoding="utf-8-sig"))
    workspace = event_path.parents[2] if event_path.parent.name == "examples" else Path.cwd()
    config = PipelineConfig.from_workspace(workspace)
    if dry_run_email:
        config.smtp_dry_run = True
    orchestrator = PipelineOrchestrator(config)
    result = orchestrator.run(PipelineEvent.from_dict(payload))
    print(json.dumps(result.to_dict(), indent=2, ensure_ascii=False))
    return 0 if result.success else 2


def _resolve_latest_runtime_event(workspace: Path) -> Path:
    runtime_dir = workspace / "generated" / "ata_pipeline" / "runtime_events"
    candidates = sorted(runtime_dir.glob("*.json"), key=lambda item: item.stat().st_mtime, reverse=True)
    if not candidates:
        raise FileNotFoundError(f"no_runtime_events_found:{runtime_dir}")
    return candidates[0].resolve()


if __name__ == "__main__":
    raise SystemExit(main())
