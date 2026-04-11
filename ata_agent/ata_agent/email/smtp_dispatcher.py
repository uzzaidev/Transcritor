from __future__ import annotations

import html
import smtplib
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
    """Conversão mínima: parágrafos e quebras; escapa HTML."""
    esc = html.escape(md)
    blocks = esc.split("\n\n")
    parts = []
    for b in blocks:
        lines = b.strip().split("\n")
        inner = "<br>\n".join(lines)
        parts.append(f"<p>{inner}</p>")
    return "\n".join(parts) if parts else f"<pre>{esc}</pre>"


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
        return DeliveryResult(False, "smtp", "", "sem destinatários")

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

    mid = msg["Message-ID"]

    try:
        if settings.smtp_tls:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=120)
            server.ehlo()
            server.starttls()
            server.ehlo()
        else:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=120)
        server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.ata_from, recipients, msg.as_string())
        server.quit()
        return DeliveryResult(True, "smtp", mid or "", "")
    except Exception as e:
        return DeliveryResult(False, "smtp", mid or "", str(e))
