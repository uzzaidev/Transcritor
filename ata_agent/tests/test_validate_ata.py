from ata_agent.orchestrator import _validate_ata


def test_validate_ata_rejects_short_markdown() -> None:
    ok, reason = _validate_ata("curta")
    assert not ok
    assert reason == "ata muito curta"


def test_validate_ata_rejects_without_sections() -> None:
    text = "x" * 130
    ok, reason = _validate_ata(text)
    assert not ok
    assert reason == "ata sem secoes reconheciveis"


def test_validate_ata_accepts_decisions_content() -> None:
    text = (
        "# ATA\n\n"
        + "Decisoes tomadas\n"
        + ("Conteudo suficiente para validacao. " * 8)
    )
    ok, reason = _validate_ata(text)
    assert ok
    assert reason == "ok"
