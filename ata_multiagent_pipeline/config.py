from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _load_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}

    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip("\"'")
    return values


@dataclass(slots=True)
class PipelineConfig:
    workspace_root: Path
    output_root: Path
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "ATA Pipeline"
    smtp_use_tls: bool = True
    git_enabled: bool = False
    git_remote: str = "origin"
    git_branch: str = "main"
    git_allow_push: bool = False
    scriptops_enabled: bool = False
    destructive_git_ops_enabled: bool = False
    min_validation_score: int = 80

    @classmethod
    def from_workspace(cls, workspace_root: str | Path) -> "PipelineConfig":
        root = Path(workspace_root).resolve()
        env_values: dict[str, str] = {}
        for candidate in (root / ".env", root / "web_sales_agent" / ".env", root / "gemini-whisper" / ".env.local"):
            env_values.update(_load_env_file(candidate))

        def getenv(name: str, default: str = "") -> str:
            return os.getenv(name, env_values.get(name, default))

        return cls(
            workspace_root=root,
            output_root=root / "generated" / "ata_pipeline",
            openai_api_key=getenv("OPENAI_API_KEY"),
            openai_model=getenv("PIPELINE_OPENAI_MODEL", "gpt-4o-mini"),
            smtp_host=getenv("SMTP_HOST"),
            smtp_port=int(getenv("SMTP_PORT", "587")),
            smtp_username=getenv("SMTP_USERNAME"),
            smtp_password=getenv("SMTP_PASSWORD"),
            smtp_from_email=getenv("SMTP_FROM_EMAIL"),
            smtp_from_name=getenv("SMTP_FROM_NAME", "ATA Pipeline"),
            smtp_use_tls=getenv("SMTP_USE_TLS", "1") not in {"0", "false", "False"},
            git_enabled=getenv("PIPELINE_GIT_ENABLED", "0") in {"1", "true", "True"},
            git_remote=getenv("PIPELINE_GIT_REMOTE", "origin"),
            git_branch=getenv("PIPELINE_GIT_BRANCH", "main"),
            git_allow_push=getenv("PIPELINE_GIT_ALLOW_PUSH", "0") in {"1", "true", "True"},
            scriptops_enabled=getenv("PIPELINE_SCRIPTOPS_ENABLED", "0") in {"1", "true", "True"},
            destructive_git_ops_enabled=getenv("PIPELINE_DESTRUCTIVE_GIT_OPS", "0") in {"1", "true", "True"},
            min_validation_score=int(getenv("PIPELINE_MIN_VALIDATION_SCORE", "80")),
        )
