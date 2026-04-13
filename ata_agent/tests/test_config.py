from __future__ import annotations

from ata_agent.config import Settings


def _clear_required_env(monkeypatch) -> None:
    for key in (
        "GEMINI_API_KEY",
        "IMAP_USER",
        "IMAP_PASSWORD",
        "SMTP_USER",
        "SMTP_PASSWORD",
        "ATA_RECIPIENTS",
        "ATA_FROM_EMAIL",
    ):
        monkeypatch.delenv(key, raising=False)


def test_settings_validate_reports_missing_required_fields(monkeypatch) -> None:
    _clear_required_env(monkeypatch)
    settings = Settings.load()
    errors = settings.validate()

    assert "GEMINI_API_KEY ausente" in errors
    assert "IMAP_USER / IMAP_PASSWORD ausentes" in errors
    assert "SMTP_USER / SMTP_PASSWORD ausentes" in errors
    assert "ATA_RECIPIENTS ausente" in errors


def test_settings_validate_passes_with_required_fields(monkeypatch) -> None:
    _clear_required_env(monkeypatch)
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    monkeypatch.setenv("IMAP_USER", "imap@example.com")
    monkeypatch.setenv("IMAP_PASSWORD", "secret")
    monkeypatch.setenv("SMTP_USER", "smtp@example.com")
    monkeypatch.setenv("SMTP_PASSWORD", "secret")
    monkeypatch.setenv("ATA_RECIPIENTS", "a@example.com,b@example.com")
    monkeypatch.setenv("ATA_FROM_EMAIL", "from@example.com")

    settings = Settings.load()
    assert settings.validate() == []
