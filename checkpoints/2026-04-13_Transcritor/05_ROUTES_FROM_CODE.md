# 05 — Rotas, Endpoints e Comandos

**Checkpoint:** 2026-04-13
**Projeto:** Transcritor (Uzz.Ai — Ferramentas)

---

## Web (`web/` — Next.js 15 App Router)

### Rotas HTTP

| Rota | Arquivo | Tipo | Auth | Propósito |
|------|---------|------|------|-----------|
| `/` | `web/app/page.tsx` | Page (Server Component) | ❌ Sem auth | Dashboard: total de `pipeline_events` do Neon |

**Evidência:** `web/app/page.tsx` — único `page.tsx` encontrado

> **Estado atual:** App extremamente mínimo (v1). Um único Server Component que consulta o Neon e exibe a contagem total de eventos. Sem rotas de API, sem auth, sem paginação.

### Rotas de API

Nenhuma rota de API (`route.ts`) encontrada.
**Evidência:** `find . -path "web/app/api/**"` → NÃO ENCONTRADO

---

## Desktop App (`gemini-whisper/` — Electron IPC)

O app desktop não usa HTTP para comunicação interna. Usa **Electron IPC** (Inter-Process Communication) entre o processo renderer (React) e o processo main (Node.js).

### Canais IPC

| Canal | Direção | Arquivo Handler | Propósito |
|-------|---------|-----------------|-----------|
| `ata-pipeline:run` | Renderer → Main | `electron/main.cjs` | Executar pipeline Python com payload JSON |
| `ata-pipeline:preflight` | Renderer → Main | `electron/main.cjs` | Verificar config (SMTP, OpenAI, runtime events) |
| `ata-pipeline:reprocess-latest` | Renderer → Main | `electron/main.cjs` | Reprocessar último evento salvo |

**Evidência:** `gemini-whisper/services/ataPipelineService.ts` + `gemini-whisper/electron/main.cjs`

#### Payload de `ata-pipeline:run`

```typescript
// Evidência: gemini-whisper/types.ts
interface AtaPipelineRequest {
  arquivoFonte: string;         // Path do arquivo de origem
  transcriptText: string;       // Texto da transcrição
  projeto: string;              // Nome do projeto
  sprint: string;               // Sprint (ex: Sprint-2025-W10)
  participantes: string[];      // Lista de nomes
  destinatarios: string[];      // Emails destino
  meetingTitle: string;         // Título da reunião
  meetingDate: string;          // Data (ISO string)
}
```

#### Resposta de `ata-pipeline:run`

```typescript
// Evidência: gemini-whisper/types.ts
interface AtaPipelineExecutionResult {
  success: boolean;
  message: string;
  stdout?: string;
  stderr?: string;
  pythonExecutable?: string;
  operation?: 'run' | 'reprocess-latest' | 'preflight';
  result?: {
    success: boolean;
    state?: Record<string, unknown>;
  };
  preflight?: {
    smtp_ready?: boolean;
    openai_configured?: boolean;
    runtime_events_ready?: boolean;
  };
}
```

### Chamadas a APIs Externas (do renderer)

| Serviço | API | Arquivo | Propósito |
|---------|-----|---------|-----------|
| Google Gemini | `generativelanguage.googleapis.com` | `services/transcriptionService.ts` | Transcrição via inlineData (base64) |
| OpenAI | `api.openai.com/v1/audio/transcriptions` | `services/transcriptionService.ts` | Whisper API (provider alternativo) |

---

## Backend Python — CLI (`ata_agent/`)

### Comandos Disponíveis

| Comando | Arquivo | Modo | Descrição |
|---------|---------|------|-----------|
| `python -m ata_agent run-once` | `ata_agent/__main__.py` | One-shot | Busca e processa e-mails, encerra |
| `python -m ata_agent daemon --interval N` | `ata_agent/__main__.py` | Loop | Polling IMAP a cada N segundos |

**Evidência:** `ata_agent/ata_agent/__main__.py`

### Fluxo Interno de Processamento

```
IMAP: fetch_audio_jobs()
  → Para cada job (mensagem com anexo de áudio):
      1. Upload áudio → Gemini Files API (resumable)
      2. wait_file_active() — aguarda processamento Gemini
      3. transcribe_audio() → texto bruto
      4. parse_structured_extractions() → JSON {decisions, actions, kaizens, risks}
      5. build_ata_markdown() → ATA formatada
      6. executive_summary_from_ata() → resumo curto
      7. validate_ata() → min 120 chars + contém "decis" ou "topic"
      8. smtp_send() → e-mail com ATA
      9. mark_processed(message_id) → store.py
```

**Evidência:** `ata_agent/ata_agent/orchestrator.py:1-144`

---

## Backend Python — CLI (`ata_multiagent_pipeline/`)

### Comandos Disponíveis

| Comando | Arquivo | Descrição |
|---------|---------|-----------|
| `python -m ata_multiagent_pipeline <event.json>` | `cli.py` | Executa pipeline com evento |
| `python -m ata_multiagent_pipeline reprocess-latest` | `cli.py` | Reprocessa último `runtime_event` |
| `python -m ata_multiagent_pipeline cleanup-generated` | `cli.py` | Remove artefatos de `generated/` |
| `python -m ata_multiagent_pipeline preflight` | `preflight.py` | Verifica SMTP, OpenAI, runtime events |

**Evidência:** `ata_multiagent_pipeline/cli.py:1-57`

### Fluxo Interno do Pipeline Multi-agente

```
Input: event.json (PipelineEvent)
  → preflight.py: validações de pré-condição
  → ExtractorAgent: extração JSON via OpenAI
      → Decision[], ActionItem[], Kaizen[], RiskItem[]
  → AtaAgent: geração de ATA Markdown via OpenAI
  → Validator: score de qualidade (>= PIPELINE_MIN_VALIDATION_SCORE=80)
  → emailing.py: formatar e-mail (texto + HTML)
  → smtp_send(): enviar para destinatários
  → gitops.py (se PIPELINE_GIT_ENABLED=1): commit + push
  → scriptops.py (se PIPELINE_SCRIPTOPS_ENABLED=1): scripts externos
  → PipelineResult: success/failure + artefatos
```

---

## Resumo de Superfície de Exposição

| Superfície | Tipo | Autenticação | Exposição Pública |
|-----------|------|-------------|-------------------|
| `web/` rota `/` | HTTP GET | ❌ Nenhuma | Sim (se deployado no Vercel) |
| Electron IPC | Local process | N/A (local) | Não |
| IMAP listener | Gmail IMAP | App Password | Não (outgoing only) |
| SMTP sender | Gmail SMTP | App Password | Não |
| Gemini API | HTTPS | API Key | Não (client-side) |
| OpenAI API | HTTPS | API Key | Não |

---

## Perguntas em Aberto

1. **Web `/` sem auth:** O dashboard exibe dados de pipeline (quantos eventos). É intencional não ter auth ou é v1 temporário?
2. **Gemini inline vs Files API:** O Electron usa `inlineData` (base64) para áudios pequenos. Qual é o limite de tamanho antes de precisar usar Files API?
3. **Electron IPC segurança:** `contextIsolation` está habilitado? `nodeIntegration` está desabilitado? Não verificado no `main.cjs`.
