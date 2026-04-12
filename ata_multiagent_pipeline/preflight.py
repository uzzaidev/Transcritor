from __future__ import annotations

import json
from pathlib import Path

from .config import PipelineConfig


def main() -> int:
    workspace = Path.cwd()
    config = PipelineConfig.from_workspace(workspace)

    smtp_fields = {
        "SMTP_HOST": bool(config.smtp_host),
        "SMTP_PORT": bool(config.smtp_port),
        "SMTP_USERNAME": bool(config.smtp_username),
        "SMTP_PASSWORD": bool(config.smtp_password),
        "SMTP_FROM_EMAIL": bool(config.smtp_from_email),
    }

    runtime_events_dir = config.output_root / "runtime_events"
    latest_runtime_event = ""
    if runtime_events_dir.exists():
        candidates = sorted(runtime_events_dir.glob("*.json"), key=lambda item: item.stat().st_mtime, reverse=True)
        latest_runtime_event = str(candidates[0]) if candidates else ""

    report = {
        "workspace_root": str(config.workspace_root),
        "output_root": str(config.output_root),
        "openai_configured": bool(config.openai_api_key),
        "smtp_ready": all(smtp_fields.values()),
        "smtp_dry_run": config.smtp_dry_run,
        "smtp_fields": smtp_fields,
        "git_enabled": config.git_enabled,
        "git_allow_push": config.git_allow_push,
        "scriptops_enabled": config.scriptops_enabled,
        "min_validation_score": config.min_validation_score,
        "runtime_events_ready": runtime_events_dir.exists(),
        "latest_runtime_event": latest_runtime_event,
    }

    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
