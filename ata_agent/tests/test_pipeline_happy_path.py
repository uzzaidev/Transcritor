from __future__ import annotations

from pathlib import Path

from ata_agent.config import Settings
from ata_agent.email.imap_listener import AudioEmailJob
from ata_agent.email.smtp_dispatcher import DeliveryResult
from ata_agent.orchestrator import process_job


def _settings(tmp_path: Path) -> Settings:
    return Settings(
        gemini_api_key="key",
        gemini_model="gemini-2.5-flash",
        imap_host="imap.test",
        imap_user="user@test",
        imap_password="secret",
        imap_folder="INBOX",
        imap_ssl=True,
        smtp_host="smtp.test",
        smtp_port=587,
        smtp_user="smtp@test",
        smtp_password="secret",
        smtp_tls=True,
        email_subject_trigger="[TRANSCRICAO]",
        ata_recipients=["dest@test"],
        ata_from="from@test",
        ata_reply_to="",
        ata_template_path=None,
        include_raw_transcript_in_email=False,
        processed_store=tmp_path / "processed.json",
        temp_dir=tmp_path / "tmp",
        database_url="",
        smtp_retry_attempts=3,
        smtp_retry_base_seconds=1,
        smtp_retry_max_seconds=2,
        gemini_retry_attempts=3,
        gemini_retry_base_seconds=1,
        gemini_retry_max_seconds=2,
    )


def test_process_job_happy_path_with_mocks(monkeypatch, tmp_path: Path) -> None:
    settings = _settings(tmp_path)
    audio = tmp_path / "meeting.mp3"
    audio.write_bytes(b"audio")
    job = AudioEmailJob(
        uid=b"42",
        message_id="<id-1@test>",
        subject="[TRANSCRICAO] Reuniao semanal",
        audio_path=audio,
    )

    seen_marked: list[bytes] = []
    remembered_ids: list[str] = []
    event_types: list[str] = []

    monkeypatch.setattr("ata_agent.orchestrator.load_processed_ids", lambda *_: set())
    monkeypatch.setattr("ata_agent.orchestrator._load_template_excerpt", lambda *_: "")
    monkeypatch.setattr("ata_agent.gemini_client.transcribe_audio", lambda *_: "transcricao")
    monkeypatch.setattr(
        "ata_agent.gemini_client.parse_structured_extractions",
        lambda *_: {
            "participantes": ["Ana", "Bob"],
            "decisoes": ["D1"],
            "acoes": ["A1"],
            "kaizens": ["K1"],
            "riscos": ["R1"],
            "projeto": "UZZ",
            "sprint": "S-1",
        },
    )
    monkeypatch.setattr(
        "ata_agent.gemini_client.build_ata_markdown",
        lambda *_: "Decisoes principais:\n" + ("conteudo " * 30),
    )
    monkeypatch.setattr(
        "ata_agent.gemini_client.executive_summary_from_ata",
        lambda *_: "resumo executivo",
    )
    monkeypatch.setattr(
        "ata_agent.orchestrator.send_ata_email",
        lambda *_, **__: DeliveryResult(True, "smtp", "<mid@test>", ""),
    )
    monkeypatch.setattr(
        "ata_agent.orchestrator.remember_message_id",
        lambda _path, msg_id: remembered_ids.append(msg_id),
    )
    monkeypatch.setattr(
        "ata_agent.orchestrator.mark_uid_seen",
        lambda _settings, uid: seen_marked.append(uid),
    )
    monkeypatch.setattr(
        "ata_agent.orchestrator.persist_pipeline_event",
        lambda *_args, **kwargs: event_types.append(kwargs["event_type"]) or "evt-1",
    )

    state = process_job(settings, job)

    assert state.status_validacao == "ok"
    assert state.delivery_success is True
    assert state.delivery_error == ""
    assert remembered_ids == ["<id-1@test>"]
    assert seen_marked == [b"42"]
    assert "ata_agent.job.delivery" in event_types
    assert not audio.exists()
