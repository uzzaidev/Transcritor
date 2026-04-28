from __future__ import annotations

import contextvars
import logging
import uuid

_correlation_id_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "ata_agent_correlation_id",
    default="-",
)


class ContextEnrichmentFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "correlation_id"):
            record.correlation_id = _correlation_id_var.get("-")
        if not hasattr(record, "context"):
            record.context = record.name
        return True


def configure_logging(level: int = logging.INFO) -> None:
    enrichment_filter = ContextEnrichmentFilter()
    logging.basicConfig(
        level=level,
        format=(
            "%(asctime)s [%(levelname)s] [corr=%(correlation_id)s] "
            "[ctx=%(context)s] %(name)s: %(message)s"
        ),
    )
    root = logging.getLogger()
    root.addFilter(enrichment_filter)
    for handler in root.handlers:
        handler.addFilter(enrichment_filter)


def set_correlation_id(correlation_id: str) -> contextvars.Token[str]:
    return _correlation_id_var.set(correlation_id)


def reset_correlation_id(token: contextvars.Token[str]) -> None:
    _correlation_id_var.reset(token)


def new_correlation_id() -> str:
    return str(uuid.uuid4())


def get_logger(name: str, context: str) -> logging.LoggerAdapter:
    return logging.LoggerAdapter(logging.getLogger(name), {"context": context})
