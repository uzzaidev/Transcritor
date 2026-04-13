from __future__ import annotations

import html
import smtplib
import time
import uuid
from dataclasses import dataclass
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate

from ata_agent.config import Settings


@dataclass
class DeliveryResult:
    success: bool
    provider: str
    message_id: str
    error: str


def _markdownish_to_html(md: str) -> str:
    esc = html.escape(md)
    blocks = esc.split("\n\n")
    parts = []
    for block in blocks:
        lines = block.strip().split("\n")
        inner = "<br>\n".join(lines)
        parts.append(f"<p>{inner}</p>")
    return "\n".join(parts) if parts else f"<pre>{esc}</pre>"


def _build_message(
    settings: Settings,
    *,
    subject: str,
    body_text: str,
    body_html: str | None,
    recipients: list[str],
) -> tuple[MIMEMultipart, str]:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.ata_from
    msg["To"] = ", ".join(recipients)
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = f"<{uuid.uuid4()}@ata-agent.local>"
    if settings.ata_reply_to:
        msg["Reply-To"] = settings.ata_reply_to

    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    html_body = body_html or _markdownish_to_html(body_text)
    msg.attach(MIMEText(html_body, "html", "utf-8"))
    return msg, (msg["Message-ID"] or "")


def _send_once(settings: Settings, *, recipients: list[str], message: MIMEMultipart) -> None:
    if settings.smtp_tls:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=120) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.ata_from, recipients, message.as_string())
        return

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=120) as server:
        server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.ata_from, recipients, message.as_string())


def _is_non_retryable_smtp_error(exc: Exception) -> bool:
    return isinstance(
        exc,
        (
            smtplib.SMTPAuthenticationError,
            smtplib.SMTPRecipientsRefused,
            smtplib.SMTPSenderRefused,
            smtplib.SMTPNotSupportedError,
        ),
    )


def _backoff_seconds(settings: Settings, attempt: int) -> int:
    base = max(1, settings.smtp_retry_base_seconds)
    max_wait = max(base, settings.smtp_retry_max_seconds)
    return min(max_wait, base * (2 ** max(0, attempt - 1)))


def send_ata_email(
    settings: Settings,
    *,
    subject: str,
    body_text: str,
    body_html: str | None = None,
    to: list[str] | None = None,
) -> DeliveryResult:
    recipients = to or settings.ata_recipients
    if not recipients:
        return DeliveryResult(False, "smtp", "", "sem destinatarios")

    msg, mid = _build_message(
        settings,
        subject=subject,
        body_text=body_text,
        body_html=body_html,
        recipients=recipients,
    )

    attempts = max(1, settings.smtp_retry_attempts)
    last_error = ""
    for attempt in range(1, attempts + 1):
        try:
            _send_once(settings, recipients=recipients, message=msg)
            return DeliveryResult(True, "smtp", mid, "")
        except Exception as exc:
            last_error = str(exc)
            if _is_non_retryable_smtp_error(exc):
                return DeliveryResult(
                    False,
                    "smtp",
                    mid,
                    f"erro smtp nao retentavel na tentativa {attempt}/{attempts}: {last_error}",
                )
            if attempt >= attempts:
                break
            time.sleep(_backoff_seconds(settings, attempt))

    return DeliveryResult(
        False,
        "smtp",
        mid,
        f"falha smtp apos {attempts} tentativa(s): {last_error}",
    )
