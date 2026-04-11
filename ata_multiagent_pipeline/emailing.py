from __future__ import annotations

import hashlib
import json
import smtplib
from datetime import datetime
from email.message import EmailMessage
from pathlib import Path

from .config import PipelineConfig
from .contracts import DeliveryResult, EmailPayload


class SmtpEmailProvider:
    def __init__(self, config: PipelineConfig, registry_path: Path) -> None:
        self.config = config
        self.registry_path = registry_path
        self.registry_path.parent.mkdir(parents=True, exist_ok=True)

    def send(self, payload: EmailPayload) -> DeliveryResult:
        if not payload.to:
            return DeliveryResult(success=False, provider="smtp", error="missing_recipients")

        duplicate_key = self._payload_fingerprint(payload)
        registry = self._load_registry()
        if duplicate_key in registry:
            return DeliveryResult(success=False, provider="smtp", error="duplicate_delivery_blocked")

        if not self.config.smtp_host or not self.config.smtp_from_email:
            return DeliveryResult(success=False, provider="smtp", error="smtp_not_configured")

        message = EmailMessage()
        message["Subject"] = payload.subject
        message["From"] = f"{self.config.smtp_from_name} <{self.config.smtp_from_email}>"
        message["To"] = ", ".join(payload.to)
        if payload.cc:
            message["Cc"] = ", ".join(payload.cc)
        if payload.reply_to:
            message["Reply-To"] = payload.reply_to
        message.set_content(payload.body_text)
        message.add_alternative(payload.body_html, subtype="html")

        try:
            if self.config.smtp_port == 465 and not self.config.smtp_use_tls:
                with smtplib.SMTP_SSL(self.config.smtp_host, self.config.smtp_port) as server:
                    self._login(server)
                    server.send_message(message)
            else:
                with smtplib.SMTP(self.config.smtp_host, self.config.smtp_port) as server:
                    if self.config.smtp_use_tls:
                        server.starttls()
                    self._login(server)
                    server.send_message(message)
        except Exception as exc:  # pragma: no cover
            return DeliveryResult(success=False, provider="smtp", error=str(exc))

        sent_at = datetime.utcnow().isoformat() + "Z"
        registry[duplicate_key] = sent_at
        self.registry_path.write_text(json.dumps(registry, indent=2, ensure_ascii=False), encoding="utf-8")

        return DeliveryResult(
            success=True,
            provider="smtp",
            message_id=message.get("Message-Id", ""),
            sent_at=sent_at,
        )

    def _login(self, server: smtplib.SMTP) -> None:
        if self.config.smtp_username:
            server.login(self.config.smtp_username, self.config.smtp_password)

    def _load_registry(self) -> dict[str, str]:
        if not self.registry_path.exists():
            return {}
        return json.loads(self.registry_path.read_text(encoding="utf-8"))

    def _payload_fingerprint(self, payload: EmailPayload) -> str:
        raw = "|".join([payload.subject, ",".join(payload.to), payload.body_text])
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()
