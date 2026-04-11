from __future__ import annotations

import email
import imaplib
from dataclasses import dataclass
from email.message import Message
from pathlib import Path

from ata_agent.config import Settings

AUDIO_EXT = {".m4a", ".mp3", ".wav", ".ogg", ".flac", ".aac", ".mp4", ".webm"}


@dataclass
class AudioEmailJob:
    uid: bytes
    message_id: str
    subject: str
    audio_path: Path


def _decode_subject(msg: Message) -> str:
    subj = msg.get("Subject", "") or ""
    try:
        from email.header import decode_header

        parts = decode_header(subj)
        chunks: list[str] = []
        for frag, enc in parts:
            if isinstance(frag, bytes):
                chunks.append(frag.decode(enc or "utf-8", errors="replace"))
            else:
                chunks.append(frag)
        return "".join(chunks)
    except Exception:
        return subj


def _first_audio_attachment(msg: Message, dest_dir: Path) -> Path | None:
    dest_dir.mkdir(parents=True, exist_ok=True)

    if not msg.is_multipart():
        return None

    for part in msg.walk():
        if part.get_content_maintype() == "multipart":
            continue
        ctype = (part.get_content_type() or "").lower()
        filename = part.get_filename()
        suf = Path(filename or "").suffix.lower()
        is_audio = ctype.startswith("audio/") or suf in AUDIO_EXT
        if not is_audio:
            continue
        data = part.get_payload(decode=True)
        if not data:
            continue
        safe = Path(filename).name if filename else "audio_sem_nome.m4a"
        if Path(safe).suffix.lower() not in AUDIO_EXT:
            ext = ".m4a"
            if "mpeg" in ctype or "mp3" in ctype:
                ext = ".mp3"
            elif "wav" in ctype:
                ext = ".wav"
            safe = f"anexo_audio{ext}"
        out = dest_dir / safe
        base = out.stem
        n = 0
        while out.exists():
            n += 1
            out = dest_dir / f"{base}_{n}{out.suffix}"
        out.write_bytes(data)
        return out
    return None


def fetch_audio_jobs(settings: Settings) -> list[AudioEmailJob]:
    """Lista e-mails não lidos com assunto que contém o gatilho e um anexo de áudio."""
    trigger = settings.email_subject_trigger
    mail = (
        imaplib.IMAP4_SSL(settings.imap_host)
        if settings.imap_ssl
        else imaplib.IMAP4(settings.imap_host)
    )
    try:
        mail.login(settings.imap_user, settings.imap_password)
        mail.select(settings.imap_folder)

        # Assunto: contém gatilho (SEARCH mais portável que regex no servidor)
        esc = trigger.replace("\\", "\\\\").replace('"', '\\"')
        status, data = mail.uid("SEARCH", None, f'(UNSEEN SUBJECT "{esc}")')
        if status != "OK" or not data or not data[0]:
            return []

        uids = data[0].split()
        jobs: list[AudioEmailJob] = []

        for uid in uids:
            st, payload = mail.uid("FETCH", uid, "(BODY.PEEK[])")
            if st != "OK" or not payload or not isinstance(payload[0], tuple):
                continue
            raw = payload[0][1]
            if not isinstance(raw, (bytes, bytearray)):
                continue
            msg = email.message_from_bytes(raw)
            mid = (msg.get("Message-ID") or "").strip()
            if not mid:
                mid = f"no-id-{uid.decode()}"

            subj = _decode_subject(msg)
            if trigger.lower() not in subj.lower():
                continue

            audio = _first_audio_attachment(msg, settings.temp_dir)
            if not audio:
                continue

            jobs.append(
                AudioEmailJob(uid=uid, message_id=mid, subject=subj, audio_path=audio)
            )

        return jobs
    finally:
        try:
            mail.logout()
        except Exception:
            pass


def mark_uid_seen(settings: Settings, uid: bytes) -> None:
    mail = (
        imaplib.IMAP4_SSL(settings.imap_host)
        if settings.imap_ssl
        else imaplib.IMAP4(settings.imap_host)
    )
    try:
        mail.login(settings.imap_user, settings.imap_password)
        mail.select(settings.imap_folder)
        mail.uid("STORE", uid, "+FLAGS", "(\\Seen)")
    finally:
        try:
            mail.logout()
        except Exception:
            pass
