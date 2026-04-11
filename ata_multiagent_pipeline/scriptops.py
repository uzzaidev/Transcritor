from __future__ import annotations

import subprocess
from dataclasses import dataclass

from .config import PipelineConfig
from .gitops import GitIntegrator


@dataclass(slots=True)
class ScriptExecutionResult:
    command: list[str]
    returncode: int
    stdout: str
    stderr: str


class ScriptOps:
    def __init__(self, config: PipelineConfig, git_integrator: GitIntegrator) -> None:
        self.config = config
        self.git_integrator = git_integrator

    def classify_risk(self, command: list[str]) -> str:
        joined = " ".join(command).lower()
        if any(token in joined for token in ("migrate", "delete", "remove", "rename", "move")):
            return "high"
        return "medium"

    def backup_snapshot(self) -> dict[str, str]:
        return self.git_integrator.snapshot("backup: pre-script-execution snapshot")

    def dry_run(self, command: list[str]) -> ScriptExecutionResult:
        return self._run(command + ["--dry-run"])

    def execute(self, command: list[str]) -> ScriptExecutionResult:
        return self._run(command)

    def rollback(self, commit_hash: str) -> dict[str, str]:
        return self.git_integrator.rollback(commit_hash)

    def _run(self, command: list[str]) -> ScriptExecutionResult:
        result = subprocess.run(
            command,
            cwd=self.config.workspace_root,
            capture_output=True,
            text=True,
            check=False,
        )
        return ScriptExecutionResult(
            command=command,
            returncode=result.returncode,
            stdout=result.stdout,
            stderr=result.stderr,
        )
