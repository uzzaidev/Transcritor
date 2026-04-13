# 06 — Catálogo de Componentes e Serviços

**Checkpoint:** 2026-04-13
**Projeto:** Transcritor (Uzz.Ai — Ferramentas)

---

## A. React Components — `gemini-whisper/`

### App.tsx (Componente Raiz)

**Evidência:** `gemini-whisper/App.tsx` (~1000+ linhas)

- **Propósito:** Estado global da aplicação + orquestração de views
- **State principal:**
  - `queue: QueueItem[]` — fila de arquivos/gravações em processamento
  - `view: 'files' | 'live-context'` — modo de operação
  - `provider: 'gemini' | 'openai' | 'huggingface'` — provedor de transcrição
  - `apiKey: string` — chave Gemini (localStorage)
  - `openaiApiKey: string` — chave OpenAI (localStorage)
  - `ataDefaults: AtaPipelineDefaults` — configurações padrão de ATA
  - `diarizationEnabled: boolean` — identificação de speakers ligada/desligada
  - `showSettings: boolean` — modal de configurações visível
- **Componentes filhos:** Todos os 8 componentes abaixo
- **Hooks:**
  - `useState` para todo o estado local
  - `useEffect` para carregar configurações do localStorage na inicialização
- **IPC calls via:** `ataPipelineService.ts`

---

### FileUpload.tsx

**Evidência:** `gemini-whisper/components/FileUpload.tsx`

- **Propósito:** Interface drag-and-drop para upload de arquivos de áudio/vídeo
- **Props:** `onFilesSelected: (files: File[]) => void`
- **Funcionalidade:**
  - Aceita múltiplos arquivos
  - Filtra por tipo (audio/*, video/*)
  - Exibe feedback visual de drag-over
- **Sem estado interno significativo**

---

### AudioRecorder.tsx

**Evidência:** `gemini-whisper/components/AudioRecorder.tsx`

- **Propósito:** Gravação de áudio do microfone
- **Props:** `onRecordingComplete: (blob: Blob, filename: string) => void`
- **State:**
  - `isRecording: boolean`
  - `mediaRecorder: MediaRecorder | null`
  - `audioChunks: Blob[]`
- **APIs Web usadas:**
  - `navigator.mediaDevices.getUserMedia({ audio: true })`
  - `MediaRecorder` API

---

### ContextRecorder.tsx

**Evidência:** `gemini-whisper/components/ContextRecorder.tsx`

- **Propósito:** Gravação ao vivo com contexto de reunião (título, participantes)
- **Props:** `onComplete: (result: { blob: Blob, context: MeetingContext }) => void`
- **State:**
  - `context: MeetingContext` — dados da reunião
  - `isRecording: boolean`
- **Diferença de AudioRecorder:** Captura metadata da reunião junto com o áudio

---

### FileQueue.tsx

**Evidência:** `gemini-whisper/components/FileQueue.tsx`

- **Propósito:** Exibe a fila de arquivos com status e progresso de cada item
- **Props:**
  - `queue: QueueItem[]`
  - `onRemove: (id: string) => void`
  - `onRetry: (id: string) => void`
  - `onGenerateAta: (id: string) => void`
- **Status exibidos:** IDLE, PENDING, UPLOADING, PROCESSING, AWAITING_NAMES, COMPLETED, ERROR
- **Sub-exibição:** Progresso de ATA pipeline por item

---

### TranscriptionView.tsx

**Evidência:** `gemini-whisper/components/TranscriptionView.tsx`

- **Propósito:** Exibir resultado de transcrição com opções de exportação
- **Props:**
  - `item: QueueItem`
  - `onExport: (format: 'txt' | 'md' | 'json') => void`
- **Funcionalidade:**
  - Texto formatado com speakers identificados
  - Cópia para clipboard
  - Export em múltiplos formatos

---

### SpeakerIdentificationModal.tsx

**Evidência:** `gemini-whisper/components/SpeakerIdentificationModal.tsx`

- **Propósito:** Modal para mapear IDs de speakers (SPEAKER_00, SPEAKER_01...) para nomes reais
- **Props:**
  - `speakers: string[]` — lista de IDs detectados
  - `onConfirm: (mapping: Record<string, string>) => void`
  - `onClose: () => void`
- **State:**
  - `mapping: Record<string, string>` — ID → nome
- **Acionado quando:** `status === ProcessStatus.AWAITING_NAMES`

---

### AtaGenerationModal.tsx

**Evidência:** `gemini-whisper/components/AtaGenerationModal.tsx`

- **Propósito:** Modal para configurar parâmetros antes de gerar ATA via pipeline Python
- **Props:**
  - `defaults: AtaPipelineDefaults`
  - `transcriptText: string`
  - `onGenerate: (params: AtaPipelineRequest) => void`
  - `onClose: () => void`
- **State:** Campos editáveis (projeto, sprint, participantes, destinatários, título, data)
- **Input final:** `AtaPipelineRequest` → enviado via `ataPipelineService.runPipeline()`

---

### SettingsModal.tsx

**Evidência:** `gemini-whisper/components/SettingsModal.tsx`

- **Propósito:** Configurações persistidas em localStorage
- **Props:**
  - `onClose: () => void`
  - `onSave: (settings: AppSettings) => void`
- **State/Campos:**
  - `geminiApiKey: string`
  - `openaiApiKey: string`
  - `provider: 'gemini' | 'openai' | 'huggingface'`
  - `ataDefaults: AtaPipelineDefaults` (projeto padrão, sprint, participantes, destinatários, auto-generate)
  - `projectProfiles: AtaProjectProfile[]` — perfis por projeto

---

## B. Services — `gemini-whisper/services/`

### transcriptionService.ts

**Evidência:** `gemini-whisper/services/transcriptionService.ts` (~150 linhas)

- **Propósito:** Orquestrar transcrição com Gemini ou OpenAI
- **Funções principais:**
  - `transcribeWithGemini(file, apiKey)` → chama Gemini 2.5 Flash via `@google/genai`
  - `transcribeWithOpenAI(file, apiKey)` → chama `api.openai.com/v1/audio/transcriptions`
  - `discoverSpeakers(transcript)` → prompt Gemini para identificar speakers
- **Dados de entrada:** `File` (blob de áudio)
- **Dados de saída:** `TranscriptionResult { text, speakers?, rawResponse }`

### geminiService.ts

**Evidência:** `gemini-whisper/services/geminiService.ts`

- **Propósito:** Wrapper legado do SDK `@google/generative-ai`
- **Status:** LEGADO — supersedido por `transcriptionService.ts` que usa `@google/genai`
- **Recomendação:** Candidato à remoção (ver 13_TECH_DEBT_FINDINGS.md)

### ataPipelineService.ts

**Evidência:** `gemini-whisper/services/ataPipelineService.ts` (69 linhas)

- **Propósito:** Interface entre React e o processo Electron (IPC)
- **Funções:**
  - `runPipeline(payload: AtaPipelineRequest)` → `ipcRenderer.invoke('ata-pipeline:run', payload)`
  - `preflight()` → `ipcRenderer.invoke('ata-pipeline:preflight')`
  - `reprocessLatest()` → `ipcRenderer.invoke('ata-pipeline:reprocess-latest')`
- **Retorno:** `Promise<AtaPipelineExecutionResult>`

---

## C. Utilities — `gemini-whisper/utils/`

### audioSlicer.ts

- **Propósito:** Dividir arquivos de áudio em segmentos menores para processamento
- **Uso:** Arquivos grandes que excedem limites de inlineData

### costCalculator.ts

- **Propósito:** Estimar custo de transcrição OpenAI Whisper API
- **Cálculo baseado em:** tokens de input/output e tabela de preços OpenAI

### fileUtils.ts

- **Propósito:** Chunking de arquivos (1MB por chunk)
- **Exporta:** `CHUNK_SIZE`, função de split

---

## D. Python Services — `ata_agent/`

### orchestrator.py

**Evidência:** `ata_agent/ata_agent/orchestrator.py:1-144`

- **Propósito:** Pipeline central de processamento
- **Funções:**
  - `run_once(settings)` — executa uma passagem completa no IMAP
  - `process_job(job, settings, client)` — processa um e-mail individualmente
  - `validate_ata(text)` — min 120 chars + contém "decis" ou "topic"

### gemini_client.py

**Evidência:** `ata_agent/ata_agent/gemini_client.py` (~250 linhas)

- **Propósito:** Wrapper sobre a Gemini Files API
- **Funções:**
  - `upload_audio(path)` → upload resumable → retorna `file_uri`
  - `wait_file_active(file_uri)` → polling até status ACTIVE
  - `generate_with_audio(file_uri, prompt, model)` → chamada de geração
  - `transcribe_audio(file_uri)` → prompt específico para transcrição
  - `parse_structured_extractions(transcript)` → prompt para JSON estruturado
  - `build_ata_markdown(state, template)` → geração da ATA final
  - `executive_summary_from_ata(ata)` → prompt para resumo executivo

### imap_listener.py

**Evidência:** `ata_agent/ata_agent/email/imap_listener.py` (144 linhas)

- **Propósito:** Busca e extrai áudios de e-mails
- **Funções:**
  - `fetch_audio_jobs(settings)` → lista de jobs (message_id, audio_path, from, subject)
  - Filtra por `EMAIL_SUBJECT_TRIGGER` no assunto
  - Extrai anexos de áudio (.mp3, .m4a, .wav, .ogg, .flac, .opus)
  - Ignora mensagens já processadas (via `store.py`)

### smtp_dispatcher.py

**Evidência:** `ata_agent/ata_agent/email/smtp_dispatcher.py` (75 linhas)

- **Propósito:** Envio de e-mail com ATA
- **Funções:**
  - `send_ata_email(settings, state)` → SMTP TLS com corpo text/plain + text/html
  - Corpo HTML: ATA convertida de Markdown para HTML simples
  - Assunto: `[ATA] {sprint} — {projeto}`

### store.py

**Evidência:** `ata_agent/ata_agent/store.py`

- **Propósito:** Persistência de IDs de mensagens já processadas
- **Armazenamento:** `.cache/ata_agent/processed.json`
- **Funções:**
  - `is_processed(message_id)` → bool
  - `mark_processed(message_id)` → persiste

---

## E. Python Services — `ata_multiagent_pipeline/`

### agents.py

**Evidência:** `ata_multiagent_pipeline/agents.py` (~150+ linhas)

- **Propósito:** Agentes especializados baseados em OpenAI
- **Classes:**
  - `AtaAgent` — geração de ATA Markdown via gpt-4o-mini
  - `ExtractorAgent` — extração JSON estruturado (decisions, actions, kaizens, risks)
  - `OpenAIJsonClient` — wrapper para chamadas JSON mode da OpenAI API

### config.py (multiagent)

**Evidência:** `ata_multiagent_pipeline/config.py`

- **Propósito:** Dataclass `PipelineConfig` com todos os parâmetros
- **Campos:** workspace, openai_key, model, smtp_*, git_*, scriptops_*, validation thresholds

### preflight.py

**Evidência:** `ata_multiagent_pipeline/preflight.py`

- **Propósito:** Checks de pré-condição antes de executar o pipeline
- **Verifica:** SMTP conectado, OpenAI respondendo, `runtime_events/` existente

---

## F. Web Components — `web/`

### app/page.tsx

**Evidência:** `web/app/page.tsx`

- **Propósito:** Server Component — busca contagem total de `pipeline_events` e exibe no dashboard
- **Data fetching:** `db.select().from(pipelineEvents)` (server-side, Neon + Drizzle)
- **Sem estado client-side**

### app/layout.tsx

**Evidência:** `web/app/layout.tsx`

- **Propósito:** Root layout com fontes Google (Inter + JetBrains Mono)
- **Configuração de metadata:** título, descrição
- **Sem auth middleware**

---

## Perguntas em Aberto

1. **`geminiService.ts` legado** — pode ser removido? `transcriptionService.ts` o substitui completamente?
2. **`App.tsx` com 1000+ linhas** — candidato à refatoração em hooks customizados e contextos React?
3. **`web/` sem componentes** — apenas `page.tsx` e `layout.tsx`. A intenção é expandir com componentes de tabela/filtro na v2?
