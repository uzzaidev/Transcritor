# 10 — Integrações e Side Effects

**Checkpoint:** 2026-04-13
**Projeto:** Transcritor (Uzz.Ai — Ferramentas)

---

## Mapa de Integrações

| Serviço | Tipo | Módulo | Direção | Auth |
|---------|------|--------|---------|------|
| Gmail IMAP | Email | `ata_agent/` | Inbound (leitura) | App Password |
| Gmail SMTP | Email | `ata_agent/`, `ata_multiagent_pipeline/` | Outbound (envio) | App Password |
| Google Gemini 2.5 Flash | AI/LLM | `ata_agent/`, `gemini-whisper/` | Outbound | API Key |
| OpenAI GPT-4o-mini | AI/LLM | `ata_multiagent_pipeline/` | Outbound | API Key |
| OpenAI Whisper | AI/Speech | `gemini-whisper/` | Outbound | API Key |
| Neon PostgreSQL | Database | `web/` | Outbound | Connection string |
| Git (local) | VCS | `ata_multiagent_pipeline/` | Local | SSH/HTTPS |

---

## A. Gmail IMAP — Leitura de E-mails

**Evidência:** `ata_agent/ata_agent/email/imap_listener.py`

**Configuração:**
```env
IMAP_HOST=imap.gmail.com
IMAP_SSL=true
IMAP_USER=seu@gmail.com
IMAP_PASSWORD=senha_de_app_gmail
IMAP_FOLDER=INBOX
EMAIL_SUBJECT_TRIGGER=[TRANSCRICAO]
```

**Comportamento:**
- Conecta via SSL na porta 993
- Busca e-mails com flag `UNSEEN` + assunto contendo o trigger
- Extrai anexos de áudio (mp3, m4a, wav, ogg, flac, opus)
- Salva attachment em disco temporariamente para upload ao Gemini
- Marca o e-mail como lido após processamento (`\Seen`)
- **NÃO deleta** os e-mails do Gmail

**Modo daemon:** Polling a cada N segundos (configurável via `--interval`)

---

## B. Gmail SMTP — Envio de E-mails

**Evidência:** `ata_agent/ata_agent/email/smtp_dispatcher.py`

**Configuração:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_TLS=true
SMTP_USER=seu@gmail.com
SMTP_PASSWORD=senha_de_app_gmail
ATA_FROM_EMAIL=seu@gmail.com
ATA_REPLY_TO=
ATA_RECIPIENTS=destinatario@email.com,outro@email.com
```

**E-mail enviado:**
- **Assunto:** `[ATA] {sprint} — {projeto}`
- **Corpo text/plain:** ATA em Markdown
- **Corpo text/html:** ATA convertida para HTML simples
- **Remetente:** `ATA_FROM_EMAIL`
- **Destinatários:** Lista de `ATA_RECIPIENTS`
- **Opcional:** Se `INCLUDE_RAW_TRANSCRIPT_IN_EMAIL=true`, inclui a transcrição bruta

**Sem retry automático** em caso de falha SMTP.

---

## C. Google Gemini 2.5 Flash — Transcrição e Geração

**Evidência:** `ata_agent/ata_agent/gemini_client.py` + `gemini-whisper/services/transcriptionService.ts`

### Uso no `ata_agent/` (Files API)

| Operação | API Call | Propósito |
|----------|----------|-----------|
| Upload de áudio | `POST /upload/v1beta/files` | Upload resumable do arquivo |
| Poll status | `GET /v1beta/files/{name}` | Aguarda ACTIVE |
| Transcrição | `POST /generateContent` (com file_uri) | Áudio → texto |
| Extração JSON | `POST /generateContent` | Texto → {decisions, actions, kaizens, risks} |
| Geração ATA | `POST /generateContent` | Dados estruturados → Markdown |
| Resumo executivo | `POST /generateContent` | ATA → resumo curto |
| Delete arquivo | `DELETE /v1beta/files/{name}` | Limpeza após uso |

**Total de chamadas por e-mail processado:** ~5-6 chamadas ao Gemini

### Uso no `gemini-whisper/` (inlineData)

| Operação | Método | Propósito |
|----------|--------|-----------|
| Transcrição | `generateContent` com `inlineData` (base64) | Áudio → texto (sem upload separado) |
| Descoberta de speakers | `generateContent` (texto) | Identificar speakers no transcript |

**Modelo configurável:** `GEMINI_MODEL` (default: `gemini-2.5-flash`)

---

## D. OpenAI — Agentes e Whisper

### `ata_multiagent_pipeline/` — Agentes

**Evidência:** `ata_multiagent_pipeline/agents.py`

| Agente | Modelo | Propósito |
|--------|--------|-----------|
| `ExtractorAgent` | gpt-4o-mini | Extração JSON estruturado (JSON mode) |
| `AtaAgent` | gpt-4o-mini | Geração de ATA Markdown |

**Configuração:**
```env
OPENAI_API_KEY=
PIPELINE_OPENAI_MODEL=gpt-4o-mini
PIPELINE_MIN_VALIDATION_SCORE=80
```

### `gemini-whisper/` — Whisper (provider alternativo)

**Evidência:** `gemini-whisper/services/transcriptionService.ts`

- Endpoint: `https://api.openai.com/v1/audio/transcriptions`
- Modelo: Whisper (automático)
- Ativado quando: usuário seleciona "openai" no SettingsModal

---

## E. Neon PostgreSQL

**Evidência:** `web/lib/db.ts`, `web/db/schema.ts`

- **Tipo:** Serverless PostgreSQL (HTTP adapter, não WebSocket)
- **Uso atual:** Apenas leitura (`SELECT COUNT(*)` de `pipeline_events`)
- **INSERT:** NÃO IMPLEMENTADO ainda (ver 07_DATA_ACCESS_MAP.md)
- **Connection string:** Via `DATABASE_URL` em `.env.local`

---

## F. Git Integration (Opcional)

**Evidência:** `ata_multiagent_pipeline/gitops.py` + `.env.example`

```env
PIPELINE_GIT_ENABLED=0            # Desabilitado por padrão
PIPELINE_GIT_REMOTE=origin
PIPELINE_GIT_BRANCH=main
PIPELINE_GIT_ALLOW_PUSH=0
PIPELINE_DESTRUCTIVE_GIT_OPS=0
```

**Quando habilitado (`PIPELINE_GIT_ENABLED=1`):**
- Commit dos artefatos gerados (`generated/ata_pipeline/`) no git local
- Se `PIPELINE_GIT_ALLOW_PUSH=1`: push para remote
- Se `PIPELINE_DESTRUCTIVE_GIT_OPS=1`: operações destrutivas habilitadas (detalhes não confirmados)

**Status:** Implementado mas desabilitado por padrão. Sprint 5 do roadmap.

---

## G. Script Ops (Opcional)

**Evidência:** `ata_multiagent_pipeline/scriptops.py` + `.env.example`

```env
PIPELINE_SCRIPTOPS_ENABLED=0
```

**Quando habilitado:**
- Execução de scripts externos definidos nos artefatos
- Framework de dry-run + rollback
- **Sprint 4 do roadmap**

---

## H. Webhooks

**NÃO ENCONTRADO** nenhum endpoint de webhook no projeto.

---

## I. Cron Jobs

**NÃO ENCONTRADO** nenhum cron job configurado.

O modo "daemon" do `ata_agent/` é um loop Python com `time.sleep()`, não um cron system externo.

---

## J. Background Jobs / Queues

**NÃO ENCONTRADO** nenhum sistema de filas (Bull, Celery, etc.).

O processamento é síncrono dentro do loop daemon.

---

## K. File Storage

**Temporário (local):**
- Arquivos de áudio extraídos de e-mails → salvos temporariamente em disco
- Deletados após upload para Gemini Files API

**Persistente (local):**
- `generated/ata_pipeline/` — artefatos gerados (ATAs, emails, logs)
- `.cache/ata_agent/processed.json` — IDs processados

**Cloud storage:** NÃO ENCONTRADO (S3, GCS, etc.)

---

## Perguntas em Aberto

1. **`PIPELINE_DESTRUCTIVE_GIT_OPS`** — o que exatamente essa flag permite? Não encontrado detalhamento no código.
2. **ScriptOps** — que tipos de scripts podem ser executados via `scriptops.py`? Há validação do script antes da execução?
3. **Gemini quota:** Com processamento de múltiplos áudios longos, qual é o custo esperado e há rate limiting no cliente?
4. **SMTP sem retry:** Se o e-mail falhar (timeout, SMTP temporariamente indisponível), o evento é perdido. Considerar retry com backoff.
