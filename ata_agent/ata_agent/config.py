from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Raiz do repositório (…/ata_agent/ata_agent/config.py → parents[2])
_ROOT = Path(__file__).resolve().parents[2]
for candidate in (
    _ROOT / ".env",
    Path(__file__).resolve().parents[1] / ".env",
    Path.cwd() / ".env",
):
    if candidate.is_file():
        load_dotenv(candidate)
        break
else:
    load_dotenv()


def _b(name: str, default: bool = False) -> bool:
    v = os.getenv(name, "").strip().lower()
    if v in ("1", "true", "yes", "on"):
        return True
    if v in ("0", "false", "no", "off", ""):
        return default
    return default


def _i(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, "").strip() or default)
    except ValueError:
        return default


@dataclass
class Settings:
    gemini_api_key: str
    gemini_model: str

    imap_host: str
    imap_user: str
    imap_password: str
    imap_folder: str
    imap_ssl: bool

    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password: str
    smtp_tls: bool

    email_subject_trigger: str
    ata_recipients: list[str]
    ata_from: str
    ata_reply_to: str

    ata_template_path: Path | None
    include_raw_transcript_in_email: bool

    processed_store: Path
    temp_dir: Path

    @classmethod
    def load(cls) -> Settings:
        recipients = [
            x.strip()
            for x in os.getenv("ATA_RECIPIENTS", "").split(",")
            if x.strip()
        ]
        tpl = os.getenv("ATA_TEMPLATE_PATH", "").strip()
        return cls(
            gemini_api_key=os.getenv("GEMINI_API_KEY", "").strip(),
            gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip(),
            imap_host=os.getenv("IMAP_HOST", "imap.gmail.com").strip(),
            imap_user=os.getenv("IMAP_USER", "").strip(),
            imap_password=os.getenv("IMAP_PASSWORD", "").strip(),
            imap_folder=os.getenv("IMAP_FOLDER", "INBOX").strip() or "INBOX",
            imap_ssl=_b("IMAP_SSL", True),
            smtp_host=os.getenv("SMTP_HOST", "smtp.gmail.com").strip(),
            smtp_port=_i("SMTP_PORT", 587),
            smtp_user=os.getenv("SMTP_USER", "").strip(),
            smtp_password=os.getenv("SMTP_PASSWORD", "").strip(),
            smtp_tls=_b("SMTP_TLS", True),
            email_subject_trigger=os.getenv(
                "EMAIL_SUBJECT_TRIGGER", "[TRANSCRICAO]"
            ).strip(),
            ata_recipients=recipients,
            ata_from=os.getenv("ATA_FROM_EMAIL", "").strip() or os.getenv(
                "SMTP_USER", ""
            ).strip(),
            ata_reply_to=os.getenv("ATA_REPLY_TO", "").strip(),
            ata_template_path=Path(tpl).resolve() if tpl else None,
            include_raw_transcript_in_email=_b("INCLUDE_RAW_TRANSCRIPT_IN_EMAIL", False),
            processed_store=Path(
                os.getenv(
                    "ATA_PROCESSED_STORE",
                    str(_ROOT / ".cache" / "ata_agent" / "processed.json"),
                )
            ).resolve(),
            temp_dir=Path(
                os.getenv(
                    "ATA_TEMP_DIR",
                    str(_ROOT / ".cache" / "ata_agent" / "tmp"),
                )
            ).resolve(),
        )

    def validate(self) -> list[str]:
        errors: list[str] = []
        if not self.gemini_api_key:
            errors.append("GEMINI_API_KEY ausente")
        if not self.imap_user or not self.imap_password:
            errors.append("IMAP_USER / IMAP_PASSWORD ausentes")
        if not self.smtp_user or not self.smtp_password:
            errors.append("SMTP_USER / SMTP_PASSWORD ausentes")
        if not self.ata_recipients:
            errors.append("ATA_RECIPIENTS ausente")
        if not self.ata_from:
            errors.append("ATA_FROM_EMAIL ou SMTP_USER ausente")
        return errors
