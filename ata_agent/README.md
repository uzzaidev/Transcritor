# Agente de ATAs (Python)

Pipeline canonico:

IMAP (email com audio) -> Gemini (transcricao + extracao + ATA) -> SMTP (entrega) -> pipeline_events (Neon, opcional)

## Instalacao

```bash
cd ata_agent
python -m pip install -r requirements.txt
```

Para desenvolvimento e testes:

```bash
python -m pip install -r requirements-dev.txt
```

## Uso

```bash
python -m ata_agent run-once
python -m ata_agent daemon --interval 120
```

## Variaveis importantes

- `GEMINI_API_KEY`, `GEMINI_MODEL`
- `IMAP_*`
- `SMTP_*`
- `EMAIL_SUBJECT_TRIGGER`
- `ATA_RECIPIENTS`, `ATA_FROM_EMAIL`, `ATA_REPLY_TO`
- `DATABASE_URL` (opcional; quando definida, persiste eventos em `pipeline_events`)

## Confiabilidade

- Retry SMTP com backoff exponencial:
  - `SMTP_RETRY_ATTEMPTS` (default 3)
  - `SMTP_RETRY_BASE_SECONDS` (default 1)
  - `SMTP_RETRY_MAX_SECONDS` (default 30)
- Retry Gemini para falhas transitorias:
  - `GEMINI_RETRY_ATTEMPTS` (default 3)
  - `GEMINI_RETRY_BASE_SECONDS` (default 1)
  - `GEMINI_RETRY_MAX_SECONDS` (default 30)
- Falhas por mensagem sao isoladas (um erro nao derruba o lote inteiro).

## Observabilidade no banco

Com `DATABASE_URL` configurada, o agente grava eventos compactos em `pipeline_events`:

- `ata_agent.job.skipped_duplicate`
- `ata_agent.job.validation_failed`
- `ata_agent.job.delivery`
- `ata_agent.job.exception`

## Testes

```bash
cd ata_agent
python -m pytest
```
