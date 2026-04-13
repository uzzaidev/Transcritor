from __future__ import annotations

from ata_agent import gemini_client


def test_parse_structured_extractions_accepts_fenced_json(monkeypatch) -> None:
    payload = """```json
{"participantes":["Ana"],"decisoes":["D1"],"acoes":["A1"],"kaizens":[],"riscos":[],"projeto":"UZZ","sprint":"S1"}
```"""
    monkeypatch.setattr(gemini_client, "generate_text_only", lambda *args, **kwargs: payload)

    parsed = gemini_client.parse_structured_extractions("k", "m", "texto")
    assert parsed["participantes"] == ["Ana"]
    assert parsed["projeto"] == "UZZ"


def test_parse_structured_extractions_returns_empty_on_invalid_json(monkeypatch) -> None:
    monkeypatch.setattr(gemini_client, "generate_text_only", lambda *args, **kwargs: "nao-json")
    parsed = gemini_client.parse_structured_extractions("k", "m", "texto")
    assert parsed == {}
