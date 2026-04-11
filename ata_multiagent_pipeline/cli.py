from __future__ import annotations

import json
import sys
from pathlib import Path

from .config import PipelineConfig
from .contracts import PipelineEvent
from .orchestrator import PipelineOrchestrator


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    args = argv if argv is not None else sys.argv[1:]
    if not args:
        print("Usage: python -m ata_multiagent_pipeline.cli <event.json>")
        return 1

    event_path = Path(args[0]).resolve()
    payload = json.loads(event_path.read_text(encoding="utf-8"))
    workspace = event_path.parents[2] if event_path.parent.name == "examples" else Path.cwd()
    config = PipelineConfig.from_workspace(workspace)
    orchestrator = PipelineOrchestrator(config)
    result = orchestrator.run(PipelineEvent.from_dict(payload))
    print(json.dumps(result.to_dict(), indent=2, ensure_ascii=False))
    return 0 if result.success else 2


if __name__ == "__main__":
    raise SystemExit(main())
