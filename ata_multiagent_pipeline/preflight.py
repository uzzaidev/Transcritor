from __future__ import annotations

import json
from pathlib import Path
import smtplib

from .config import PipelineConfig


def main() -> int:
    workspace = Path.cwd()
    config = PipelineConfig.from_workspace(workspace)

    smtp_fields = {
        "SMTP_HOST": bool(config.smtp_host),
        "SMTP_PORT": bool(config.smtp_port),
        "SMTP_USERNAME_OR_SMTP_USER": bool(config.smtp_username),
        "SMTP_PASSWORD": bool(config.smtp_password),
        "SMTP_FROM_EMAIL_OR_ATA_FROM_EMAIL": bool(config.smtp_from_email),
    }

    runtime_events_dir = config.output_root / "runtime_events"
    latest_runtime_event = ""
    if runtime_events_dir.exists():
        candidates = sorted(runtime_events_dir.glob("*.json"), key=lambda item: item.stat().st_mtime, reverse=True)
        latest_runtime_event = str(candidates[0]) if candidates else ""

    smtp_connection_ok = False
    smtp_auth_ok = False
    smtp_verify_error = ""
    smtp_login_verified = False
    if all(smtp_fields.values()) and not config.smtp_dry_run:
        smtp_connection_ok, smtp_auth_ok, smtp_verify_error = _verify_smtp(config)
        smtp_login_verified = smtp_connection_ok and smtp_auth_ok

    report = {
        "workspace_root": str(config.workspace_root),
        "output_root": str(config.output_root),
        "openai_configured": bool(config.openai_api_key),
        "smtp_ready": all(smtp_fields.values()),
        "smtp_dry_run": config.smtp_dry_run,
        "smtp_fields": smtp_fields,
        "smtp_connection_ok": smtp_connection_ok,
        "smtp_auth_ok": smtp_auth_ok,
        "smtp_login_verified": smtp_login_verified,
        "smtp_verify_error": smtp_verify_error,
        "git_enabled": config.git_enabled,
        "git_allow_push": config.git_allow_push,
        "scriptops_enabled": config.scriptops_enabled,
        "min_validation_score": config.min_validation_score,
        "runtime_events_ready": runtime_events_dir.exists(),
        "latest_runtime_event": latest_runtime_event,
    }

    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0

def _verify_smtp(config: PipelineConfig) -> tuple[bool, bool, str]:
    client: smtplib.SMTP | smtplib.SMTP_SSL | None = None
    try:
        use_ssl = bool(getattr(config, "smtp_use_ssl", False)) or int(config.smtp_port or 0) == 465
        use_tls = bool(getattr(config, "smtp_use_tls", False)) and not use_ssl

        if use_ssl:
            client = smtplib.SMTP_SSL(config.smtp_host, config.smtp_port, timeout=15)
            client.ehlo()
        else:
            client = smtplib.SMTP(config.smtp_host, config.smtp_port, timeout=15)
            client.ehlo()
            if use_tls:
                client.starttls()
                client.ehlo()

        return True, _smtp_login(client, config), ""
    except Exception as error:
        return False, False, str(error)
    finally:
        if client is not None:
            try:
                client.quit()
            except Exception:
                pass


def _smtp_login(client: smtplib.SMTP | smtplib.SMTP_SSL, config: PipelineConfig) -> bool:
    client.login(config.smtp_username, config.smtp_password)
    return True


if __name__ == "__main__":
    raise SystemExit(main())
