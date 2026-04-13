from pathlib import Path

from ata_agent.store import load_processed_ids, remember_message_id


def test_store_deduplicates_message_ids(tmp_path: Path) -> None:
    store_path = tmp_path / "processed.json"

    remember_message_id(store_path, "<msg-1@example.com>")
    remember_message_id(store_path, "<msg-1@example.com>")
    remember_message_id(store_path, "<msg-2@example.com>")

    ids = load_processed_ids(store_path)
    assert ids == {"<msg-1@example.com>", "<msg-2@example.com>"}
