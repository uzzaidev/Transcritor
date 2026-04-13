from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from ata_agent.config import Settings

log = logging.getLogger(__name__)

try:
    import psycopg
except Exception:  # pragma: no cover
    psycopg = None


def persist_pipeline_event(
    settings: Settings,
    *,
    event_type: str,
    success: bool,
    payload: dict[str, Any],
    event_id: str | None = None,
) -> str | None:
    """Persist a compact observability event to Neon pipeline_events."""
    if not settings.database_url:
        return None
    if psycopg is None:
        log.warning("psycopg indisponivel; evento nao persistido (%s)", event_type)
        return None

    eid = event_id or str(uuid.uuid4())
    body = {
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        **payload,
    }

    try:
        with psycopg.connect(settings.database_url, autocommit=True, connect_timeout=10) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO pipeline_events (id, event_type, success, payload)
                    VALUES (%s, %s, %s, %s::jsonb)
                    """,
                    (eid, event_type, success, json.dumps(body, ensure_ascii=False, default=str)),
                )
        return eid
    except Exception as exc:
        log.error("falha ao persistir evento '%s': %s", event_type, exc)
        return None
