from __future__ import annotations

import json
import mimetypes
import os
import time
from pathlib import Path

import requests

GEMINI_UPLOAD_START = "https://generativelanguage.googleapis.com/upload/v1beta/files"
GEMINI_FILES = "https://generativelanguage.googleapis.com/v1beta/files"
GEMINI_GENERATE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
RETRIABLE_STATUS_CODES = {408, 429, 500, 502, 503, 504}


def _guess_mime(path: Path) -> str:
    mime, _ = mimetypes.guess_type(path.name)
    if mime:
        return mime
    suf = path.suffix.lower()
    return {
        ".m4a": "audio/mp4",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
        ".aac": "audio/aac",
        ".mp4": "audio/mp4",
    }.get(suf, "application/octet-stream")


def _retry_int(name: str, default: int) -> int:
    try:
        return max(1, int((os.getenv(name, "") or str(default)).strip()))
    except ValueError:
        return max(1, default)


def _retry_sleep(attempt: int) -> None:
    base = _retry_int("GEMINI_RETRY_BASE_SECONDS", 1)
    max_wait = _retry_int("GEMINI_RETRY_MAX_SECONDS", 30)
    wait = min(max_wait, base * (2 ** max(0, attempt - 1)))
    time.sleep(wait)


def _request_with_retry(method: str, url: str, **kwargs) -> requests.Response:
    attempts = _retry_int("GEMINI_RETRY_ATTEMPTS", 3)
    last_exc: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            response = requests.request(method, url, **kwargs)
        except requests.RequestException as exc:
            last_exc = exc
            if attempt >= attempts:
                break
            _retry_sleep(attempt)
            continue

        if response.status_code in RETRIABLE_STATUS_CODES and attempt < attempts:
            _retry_sleep(attempt)
            continue
        return response

    raise RuntimeError(
        f"Gemini request failed after {attempts} attempt(s): {last_exc}"
    )


def upload_audio_file(api_key: str, file_path: Path) -> tuple[str, str]:
    """Resumable upload (mesmo fluxo da app gemini-whisper). Devolve (file_uri, file_resource_name)."""
    data = file_path.read_bytes()
    size = len(data)
    mime = _guess_mime(file_path)
    display = file_path.name[:200]

    r = _request_with_retry(
        "POST",
        f"{GEMINI_UPLOAD_START}?key={api_key}",
        headers={
            "X-Goog-Upload-Protocol": "resumable",
            "X-Goog-Upload-Command": "start",
            "X-Goog-Upload-Header-Content-Length": str(size),
            "X-Goog-Upload-Header-Content-Type": mime,
            "Content-Type": "application/json",
        },
        json={"file": {"display_name": display}},
        timeout=120,
    )
    r.raise_for_status()
    session_url = r.headers.get("x-goog-upload-url")
    if not session_url:
        raise RuntimeError("Gemini não devolveu URL de upload.")

    up = _request_with_retry(
        "POST",
        session_url,
        headers={
            "Content-Length": str(size),
            "X-Goog-Upload-Offset": "0",
            "X-Goog-Upload-Command": "upload, finalize",
        },
        data=data,
        timeout=600,
    )
    up.raise_for_status()
    body = up.json()
    fmeta = body.get("file") or {}
    uri = fmeta.get("uri")
    name = fmeta.get("name", "")
    short = name.split("/")[-1] if name else ""
    if not uri or not short:
        raise RuntimeError("Resposta de upload inválida.")
    return uri, short


def wait_file_active(api_key: str, file_short_name: str, max_wait: int = 300) -> None:
    deadline = time.time() + max_wait
    url = f"{GEMINI_FILES}/{file_short_name}?key={api_key}"
    while time.time() < deadline:
        r = _request_with_retry("GET", url, timeout=60)
        r.raise_for_status()
        state = (r.json().get("state") or "").upper()
        if state == "ACTIVE":
            return
        if state == "FAILED":
            raise RuntimeError("Processamento do ficheiro no Gemini falhou.")
        time.sleep(2)
    raise TimeoutError("Timeout à espera do ficheiro Gemini.")


def generate_with_audio(
    api_key: str,
    model: str,
    file_uri: str,
    mime: str,
    user_prompt: str,
    *,
    temperature: float = 0.2,
    max_output_tokens: int = 8192,
) -> str:
    url = GEMINI_GENERATE.format(model=model) + f"?key={api_key}"
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "fileData": {
                            "mimeType": mime,
                            "fileUri": file_uri,
                        }
                    },
                    {"text": user_prompt},
                ],
            }
        ],
        "generationConfig": {
            "temperature": temperature,
            "topP": 0.95,
            "topK": 40,
            "maxOutputTokens": max_output_tokens,
        },
    }
    r = _request_with_retry("POST", url, json=payload, timeout=600)
    if not r.ok:
        try:
            detail = r.json().get("error", {}).get("message", r.text)
        except Exception:
            detail = r.text
        raise RuntimeError(f"Gemini HTTP {r.status_code}: {detail}")
    return _extract_text(r.json())


def generate_text_only(
    api_key: str,
    model: str,
    user_prompt: str,
    *,
    temperature: float = 0.3,
    max_output_tokens: int = 8192,
) -> str:
    url = GEMINI_GENERATE.format(model=model) + f"?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": user_prompt}]}],
        "generationConfig": {
            "temperature": temperature,
            "topP": 0.95,
            "topK": 40,
            "maxOutputTokens": max_output_tokens,
        },
    }
    r = _request_with_retry("POST", url, json=payload, timeout=300)
    if not r.ok:
        try:
            detail = r.json().get("error", {}).get("message", r.text)
        except Exception:
            detail = r.text
        raise RuntimeError(f"Gemini HTTP {r.status_code}: {detail}")
    return _extract_text(r.json())


def _extract_text(response_json: dict) -> str:
    cands = response_json.get("candidates") or []
    if not cands:
        return ""
    parts = (cands[0].get("content") or {}).get("parts") or []
    chunks: list[str] = []
    for p in parts:
        t = p.get("text")
        if t:
            chunks.append(t)
    return "".join(chunks).strip()


def transcribe_audio(api_key: str, model: str, audio_path: Path) -> str:
    mime = _guess_mime(audio_path)
    uri, short = upload_audio_file(api_key, audio_path)
    wait_file_active(api_key, short)
    prompt = (
        "Transcreve integralmente este áudio em português. "
        "Devolve apenas o texto transcrito, com parágrafos quando mudar de tema. "
        "Não comentes, não faças resumo."
    )
    return generate_with_audio(api_key, model, uri, mime, prompt)


def build_ata_markdown(
    api_key: str,
    model: str,
    transcript: str,
    template_excerpt: str,
    email_subject_hint: str,
) -> str:
    prompt = f"""Atua como assistente executivo. Com base na transcrição abaixo, produz uma **Ata de Reunião** em Markdown.

Regras:
- Inclui cabeçalho com data (se inferível) ou "Data: a confirmar", reunião derivada do contexto, e lista de participantes se identificáveis.
- Secções: Tópicos discutidos; Decisões tomadas (numeradas D-001, …); Próximos passos / encaminhamentos (cada linha com responsável quando possível, usando wiki-links `[[Nome]]`); Riscos ou bloqueios; Kaizens (se aplicável).
- Para tarefas de seguimento, inclui a tag `#encaminhamento` nessa linha ou na mesma frase, conforme o padrão do vault da empresa.
- Linguagem profissional, em português.
- Não copies a transcrição integral no final; a ata deve ser sintética mas fiel.

{f"Contexto do assunto do e-mail: {email_subject_hint}" if email_subject_hint else ""}

{f"Trecho ou instruções de template a respeitar:\\n{template_excerpt[:12000]}" if template_excerpt else ""}

Transcrição:
{transcript[:100000]}
"""
    return generate_text_only(api_key, model, prompt, temperature=0.25)


def executive_summary_from_ata(api_key: str, model: str, ata_md: str) -> str:
    prompt = (
        "Resume a ata seguinte em 5–8 linhas para o corpo de um e-mail executivo. "
        "Português, bullets curtos, foco em decisões e prazos.\n\n"
        + ata_md[:60000]
    )
    return generate_text_only(api_key, model, prompt, temperature=0.2, max_output_tokens=1024)


def parse_structured_extractions(
    api_key: str, model: str, transcript: str
) -> dict:
    """Extrai listas estruturadas (JSON) para popular PipelineState."""
    prompt = (
        "Analisa a transcrição e devolve **apenas** um objeto JSON válido com chaves: "
        'participantes (array de strings), decisoes (array), acoes (array), '
        'kaizens (array), riscos (array), projeto (string ou vazio), sprint (string ou vazio).\n\n'
        f"Transcrição:\n{transcript[:80000]}"
    )
    raw = generate_text_only(api_key, model, prompt, temperature=0.1)
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1]
        raw = raw.rsplit("```", 1)[0].strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}
