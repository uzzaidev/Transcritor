from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class PipelineState:
    """Contrato mínimo entre etapas do pipeline (handoff lógico)."""

    tipo_evento: str = "email_audio"
    arquivo_fonte: str = ""
    projeto: str = ""
    sprint: str = ""
    participantes: list[str] = field(default_factory=list)
    decisoes: list[str] = field(default_factory=list)
    acoes: list[str] = field(default_factory=list)
    kaizens: list[str] = field(default_factory=list)
    riscos: list[str] = field(default_factory=list)
    status_validacao: str = "pending"
    arquivos_derivados: list[str] = field(default_factory=list)

    transcricao_bruta: str = ""
    ata_markdown_final: str = ""
    ata_resumo_executivo: str = ""

    email_subject: str = ""
    email_body_text: str = ""
    email_body_html: str = ""
    destinatarios: list[str] = field(default_factory=list)

    delivery_success: bool = False
    delivery_provider: str = "smtp"
    delivery_message_id: str = ""
    delivery_error: str = ""

    meta: dict[str, Any] = field(default_factory=dict)
