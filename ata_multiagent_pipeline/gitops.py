from __future__ import annotations

import subprocess

from .config import PipelineConfig


class GitIntegrator:
    def __init__(self, config: PipelineConfig) -> None:
        self.config = config

    def publish(self, files: list[str], commit_message: str) -> dict[str, str]:
        if not self.config.git_enabled:
            return {"status": "skipped", "reason": "git_disabled"}
        if not files:
            return {"status": "skipped", "reason": "no_files"}

        self._run(["git", "pull", self.config.git_remote, self.config.git_branch])
        for file_path in files:
            self._run(["git", "add", file_path])
        self._run(["git", "commit", "-m", commit_message])
        self._run(["git", "pull", self.config.git_remote, self.config.git_branch])
        if self.config.git_allow_push:
            self._run(["git", "push", self.config.git_remote, self.config.git_branch])
            return {"status": "published"}
        return {"status": "committed", "reason": "push_disabled"}

    def snapshot(self, message: str) -> dict[str, str]:
        if not self.config.git_enabled:
            return {"status": "skipped", "reason": "git_disabled"}
        self._run(["git", "add", "-A"])
        self._run(["git", "commit", "-m", message])
        commit_hash = self._run(["git", "rev-parse", "HEAD"]).strip()
        return {"status": "snapshotted", "commit": commit_hash}

    def rollback(self, commit_hash: str) -> dict[str, str]:
        if not self.config.destructive_git_ops_enabled:
            return {"status": "blocked", "reason": "destructive_git_ops_disabled"}
        self._run(["git", "reset", "--hard", commit_hash])
        return {"status": "rolled_back", "commit": commit_hash}

    def _run(self, command: list[str]) -> str:
        result = subprocess.run(
            command,
            cwd=self.config.workspace_root,
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout or result.stderr
