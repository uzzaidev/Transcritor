from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
import re
from typing import Any
import unicodedata


@dataclass(slots=True)
class Decision:
    id: str
    titulo: str
    contexto: str
    decisao: str
    alternativas: list[str] = field(default_factory=list)
    impacto: str = ""


@dataclass(slots=True)
class ActionItem:
    id: str
    titulo: str
    responsavel: str
    prazo: str = ""
    prioridade: str = "media"
    tags: list[str] = field(default_factory=list)


@dataclass(slots=True)
class Kaizen:
    id: str
    categoria: str
    descricao: str


@dataclass(slots=True)
class RiskItem:
    id: str
    descricao: str
    probabilidade: int = 1
    impacto: int = 1
    mitigacao: str = ""

    @property
    def severidade(self) -> int:
        return self.probabilidade * self.impacto


@dataclass(slots=True)
class PipelineEvent:
    tipo_evento: str
    arquivo_fonte: str
    projeto: str
    sprint: str
    participantes: list[str]
    transcript_text: str = ""
    destinatarios: list[str] = field(default_factory=list)
    meeting_title: str = ""
    meeting_date: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "PipelineEvent":
        return cls(
            tipo_evento=sanitize_text(payload.get("tipo_evento", "nova_reuniao")),
            arquivo_fonte=sanitize_text(payload.get("arquivo_fonte", "")),
            projeto=sanitize_text(payload.get("projeto", "GERAL")),
            sprint=sanitize_text(payload.get("sprint", "")),
            participantes=_sanitize_participant_list(payload.get("participantes", [])),
            transcript_text=sanitize_text(payload.get("transcript_text", "")),
            destinatarios=_sanitize_string_list(payload.get("destinatarios", [])),
            meeting_title=sanitize_text(payload.get("meeting_title", "")),
            meeting_date=sanitize_text(payload.get("meeting_date", "")),
            metadata=payload.get("metadata", {}),
        )


@dataclass(slots=True)
class AtaExtraction:
    titulo: str
    resumo_executivo: str
    topicos: list[str]
    decisoes: list[Decision]
    acoes: list[ActionItem]
    kaizens: list[Kaizen]
    riscos: list[RiskItem]
    participantes: list[str]
    projeto: str
    sprint: str


@dataclass(slots=True)
class ValidationResult:
    valid: bool
    score: int
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass(slots=True)
class EmailPayload:
    subject: str
    body_text: str
    body_html: str
    to: list[str]
    cc: list[str] = field(default_factory=list)
    reply_to: str = ""


@dataclass(slots=True)
class DeliveryResult:
    success: bool
    provider: str
    message_id: str = ""
    sent_at: str = ""
    error: str = ""


@dataclass(slots=True)
class AuditResult:
    passed: bool
    issues: list[str] = field(default_factory=list)


@dataclass(slots=True)
class PipelineState:
    event: PipelineEvent
    arquivo_fonte: Path
    transcript_text: str
    ata_extraction: AtaExtraction | None = None
    ata_markdown_final: str = ""
    ata_resumo_executivo: str = ""
    status_validacao: str = "pendente"
    validation_result: ValidationResult | None = None
    arquivos_derivados: list[str] = field(default_factory=list)
    email_payload: EmailPayload | None = None
    delivery_result: DeliveryResult | None = None
    audit_result: AuditResult | None = None
    logs: list[dict[str, Any]] = field(default_factory=list)


@dataclass(slots=True)
class PipelineResult:
    success: bool
    state: PipelineState

    def to_dict(self) -> dict[str, Any]:
        return {
            "success": self.success,
            "state": _serialize(self.state),
            "generated_at": datetime.utcnow().isoformat() + "Z",
        }


def _serialize(value: Any) -> Any:
    if hasattr(value, "__dataclass_fields__"):
        return {key: _serialize(val) for key, val in asdict(value).items()}
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [_serialize(item) for item in value]
    if isinstance(value, dict):
        return {key: _serialize(val) for key, val in value.items()}
    return value


def sanitize_text(value: Any) -> str:
    text = str(value or "").replace("\ufeff", "").strip()
    if not text:
        return ""

    text = _repair_utf8_mojibake(text)
    text = re.sub(r"[^\S\r\n]+", " ", text)
    return text.strip()


def text_looks_degraded(value: str) -> bool:
    text = sanitize_text(value)
    if not text:
        return False
    return "??" in text or "\ufffd" in text or bool(re.search(r"[A-Za-zÀ-ÿ]\?[A-Za-zÀ-ÿ]", text))


def slugify_filename(value: str, fallback: str = "ata") -> str:
    ascii_text = unicodedata.normalize("NFKD", sanitize_text(value)).encode("ascii", "ignore").decode("ascii")
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_text).strip("-").lower()
    return cleaned or fallback


def _sanitize_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [sanitize_text(item) for item in value if sanitize_text(item)]


def _sanitize_participant_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [normalize_participant_name(sanitize_text(item)) for item in value if sanitize_text(item)]


def normalize_participant_name(value: str) -> str:
    aliases = {
        "equipe t?cnica": "Equipe técnica",
        "equipe técnica": "Equipe técnica",
        "equipe técnica ": "Equipe técnica",
    }
    return aliases.get(value.lower(), value)


def _repair_utf8_mojibake(text: str) -> str:
    if not any(marker in text for marker in ("Ã", "Â", "â", "\ufffd")):
        return text

    try:
        repaired = text.encode("latin1").decode("utf-8")
    except (UnicodeDecodeError, UnicodeEncodeError):
        return text

    if _text_quality_score(repaired) >= _text_quality_score(text):
        return repaired
    return text


def _text_quality_score(text: str) -> int:
    preferred = sum(1 for char in text if char.isalnum() or char.isspace() or char in ".,;:!?-_()/[]#@")
    penalties = (text.count("\ufffd") * 5) + (text.count("Ã") * 2) + (text.count("Â") * 2) + (text.count("â") * 2)
    return preferred - penalties
