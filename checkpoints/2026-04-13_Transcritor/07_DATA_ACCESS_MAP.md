# 07 — Mapa de Acesso a Dados

**Checkpoint:** 2026-04-13
**Projeto:** Transcritor (Uzz.Ai — Ferramentas)

---

## Visão Geral de Fontes de Dados

| Fonte | Tipo | Módulo que acessa | ORM/Lib |
|-------|------|------------------|---------|
| Neon PostgreSQL | SQL (cloud serverless) | `web/` | Drizzle ORM |
| Gmail IMAP | Protocol | `ata_agent/` | `imaplib` (stdlib) |
| Gmail SMTP | Protocol | `ata_agent/`, `ata_multiagent_pipeline/` | `smtplib` (stdlib) |
| Gemini Files API | REST HTTP | `ata_agent/`, `gemini-whisper/` | `requests` / `@google/genai` |
| OpenAI API | REST HTTP | `ata_multiagent_pipeline/`, `gemini-whisper/` | `openai` SDK / `fetch` |
| Filesystem local | File I/O | Todos os módulos | stdlib `pathlib`/`fs` |

---

## A. Neon PostgreSQL (via Drizzle ORM)

### Por Endpoint/Página

#### `GET /` — Dashboard (`web/app/page.tsx`)

```typescript
// Evidência: web/app/page.tsx + web/lib/db.ts
const events = await db.select().from(pipelineEvents);
// Retorna: todos os registros de pipeline_events
// Sem filtro, sem paginação, sem ordenação explícita
```

**Tabela acessada:** `pipeline_events`
**Operação:** SELECT (full table scan)
**Riscos:**
- ❌ **Sem paginação** — se a tabela crescer para milhares de registros, vai ficar lento
- ❌ **Sem índice de ordenação** — não há ORDER BY no código
- ✅ Apenas leitura, sem risco de corrupção

### Por Tabela

#### Tabela: `pipeline_events`

| Operação | Arquivo | Condição | Notas |
|----------|---------|----------|-------|
| SELECT (all) | `web/app/page.tsx` | Sem filtro | Full scan |
| INSERT | NÃO ENCONTRADO | — | Quem insere os dados? |

> ⚠️ **LACUNA IDENTIFICADA:** Não foi encontrado código que faz INSERT na tabela `pipeline_events`.
> O `ata_agent/` e `ata_multiagent_pipeline/` não têm referência a `DATABASE_URL`.
> INFERÊNCIA: A inserção pode estar planejada mas não implementada ainda.

---

## B. Gmail IMAP

**Evidência:** `ata_agent/ata_agent/email/imap_listener.py`

### Operações

| Operação | Código | Descrição |
|----------|--------|-----------|
| SEARCH | `imap.search(None, 'UNSEEN SUBJECT "[TRANSCRICAO]"')` | Busca e-mails não lidos com trigger |
| FETCH | `imap.fetch(uid, '(RFC822)')` | Baixa e-mail completo (headers + corpo + anexos) |
| STORE | `imap.store(uid, '+FLAGS', '\\Seen')` | Marca como lido após processamento |

**Filtros aplicados:**
- Flag: `UNSEEN` — somente não lidos
- Subject: contém `EMAIL_SUBJECT_TRIGGER` (default: `[TRANSCRICAO]`)

**Anti-duplicidade:**
- `store.py` persiste `message_id` em `.cache/ata_agent/processed.json`
- Antes de processar: `is_processed(message_id)` → skip se já processado

**Extensões de áudio aceitas:**
- `.mp3`, `.m4a`, `.wav`, `.ogg`, `.flac`, `.opus`

---

## C. Gmail SMTP

**Evidência:** `ata_agent/ata_agent/email/smtp_dispatcher.py` + `ata_multiagent_pipeline/emailing.py`

### Operações

| Operação | Módulo | Descrição |
|----------|--------|-----------|
| Envio de e-mail | `smtp_dispatcher.py` | SMTP TLS, corpo text/plain + text/html |
| Envio de e-mail | `emailing.py` (multiagent) | Mesma operação, pipeline avançado |

**Configuração:**
- Host: `SMTP_HOST` (default: `smtp.gmail.com`)
- Port: `SMTP_PORT` (default: `587`, TLS)
- Auth: `SMTP_USER` + `SMTP_PASSWORD` (App Password Gmail)

---

## D. Gemini Files API

**Evidência:** `ata_agent/ata_agent/gemini_client.py`

### Operações

| Operação | Endpoint | Descrição |
|----------|----------|-----------|
| Upload | `POST https://generativelanguage.googleapis.com/upload/v1beta/files` | Upload resumable do arquivo de áudio |
| Poll status | `GET https://generativelanguage.googleapis.com/v1beta/files/{name}` | Aguarda status ACTIVE |
| Delete | `DELETE https://generativelanguage.googleapis.com/v1beta/files/{name}` | Remove após processamento |
| Generate | `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | Transcrição + geração |

**Modelo usado:** `GEMINI_MODEL` (default: `gemini-2.5-flash`)

**Prompts executados em sequência:**
1. Transcrição do áudio (`transcribe_audio`)
2. Extração JSON estruturado (`parse_structured_extractions`)
3. Geração da ATA (`build_ata_markdown`)
4. Resumo executivo (`executive_summary_from_ata`)

---

## E. Gemini API (Electron — inlineData)

**Evidência:** `gemini-whisper/services/transcriptionService.ts`

### Operações

| Operação | SDK | Modo | Limite |
|----------|-----|------|--------|
| Transcrição | `@google/genai` | `inlineData` (base64) | Limites do modelo |
| Discover speakers | `@google/genai` | Prompt text | — |

**Diferença do `ata_agent/`:**
- Electron usa `inlineData` (base64 embutido no request) — mais simples, mas limitado a arquivos pequenos
- `ata_agent/` usa Files API (upload separado + referência URI) — suporta arquivos maiores

---

## F. OpenAI API

**Evidência:** `ata_multiagent_pipeline/agents.py` + `gemini-whisper/services/transcriptionService.ts`

### Operações

| Módulo | Endpoint | Propósito |
|--------|----------|-----------|
| `ata_multiagent_pipeline/` | `POST /v1/chat/completions` (JSON mode) | Extração estruturada + geração de ATA |
| `gemini-whisper/` | `POST /v1/audio/transcriptions` | Whisper (provider alternativo) |

**Modelo usado:** `PIPELINE_OPENAI_MODEL` (default: `gpt-4o-mini`)

---

## G. Filesystem

### Leitura

| Arquivo | Quem lê | Propósito |
|---------|---------|-----------|
| `.env` / `.env.local` | `config.py` em todos os módulos Python | Variáveis de ambiente |
| `prompts/template_default.md` | `gemini_client.py` | Template padrão de ATA |
| `ATA_TEMPLATE_PATH` (se definido) | `gemini_client.py` | Template customizado |
| `examples/sample_event.json` | `cli.py` (multiagent) | Input de teste |
| `runtime_events/*.json` | `cli.py` (reprocess-latest) | Reprocessamento |

### Escrita

| Arquivo | Quem escreve | Propósito |
|---------|-------------|-----------|
| `.cache/ata_agent/processed.json` | `store.py` | IDs de mensagens processadas |
| `generated/ata_pipeline/atas/*.md` | `orchestrator.py` (multiagent) | ATA gerada |
| `generated/ata_pipeline/email/*.json` | `emailing.py` | Payload de e-mail |
| `generated/ata_pipeline/logs/*.log` | `logging_utils.py` | Logs de execução |
| `generated/ata_pipeline/runtime_events/*.json` | `orchestrator.py` | Para reprocessamento |
| `generated/ata_pipeline/sprints/` | `orchestrator.py` | Artefatos de sprint |
| `generated/ata_pipeline/dashboards/` | `orchestrator.py` | Atualizações de dashboard |

---

## Mapa de Riscos de Dados

| Risco | Severidade | Módulo | Detalhes |
|-------|-----------|--------|---------|
| Full table scan em `pipeline_events` | Médio | `web/` | Sem paginação — cresce com o tempo |
| INSERT ausente em `pipeline_events` | Alto | Todos | Quem popula o banco? |
| Gemini inlineData sem limite de tamanho | Médio | `gemini-whisper/` | Arquivos grandes podem falhar silenciosamente |
| `.cache/processed.json` em disco local | Baixo | `ata_agent/` | Se o processo reiniciar em outro servidor, perde o histórico |
| Sem retry em falhas SMTP | Médio | Ambos Python | Se SMTP falhar, e-mail é perdido sem reprocessamento automático |

---

## Perguntas em Aberto

1. **INSERT em `pipeline_events`:** Nenhum código Python acessa `DATABASE_URL`. Como os eventos chegam ao banco Neon? Está implementado?
2. **Cleanup de arquivos Gemini:** Após upload na Files API, o arquivo é deletado do Gemini após uso? Há custo de armazenamento contínuo?
3. **`processed.json` persistência:** Em um ambiente de deploy em cloud/container, o `.cache/` é preservado entre restarts?
