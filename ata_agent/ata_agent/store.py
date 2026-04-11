from __future__ import annotations

import json
import threading
from pathlib import Path

_lock = threading.Lock()


def load_processed_ids(path: Path) -> set[str]:
    if not path.is_file():
        return set()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        ids = data.get("message_ids") or []
        return {str(x) for x in ids}
    except (json.JSONDecodeError, OSError):
        return set()


def remember_message_id(path: Path, message_id: str) -> None:
    message_id = message_id.strip()
    if not message_id:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with _lock:
        current = load_processed_ids(path)
        current.add(message_id)
        path.write_text(
            json.dumps({"message_ids": sorted(current)}, indent=2),
            encoding="utf-8",
        )
