from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path


class StructuredLogger:
    def __init__(self, log_path: Path) -> None:
        self.log_path = log_path
        self.log_path.parent.mkdir(parents=True, exist_ok=True)

    def log(self, step: str, status: str, details: dict | None = None) -> None:
        payload = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "step": step,
            "status": status,
            "details": details or {},
        }
        with self.log_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload, ensure_ascii=False) + "\n")
