# 14 — Diagramas de Arquitetura

**Checkpoint:** 2026-04-13
**Projeto:** Transcritor (Uzz.Ai — Ferramentas)

---

## 1. Arquitetura Geral do Sistema

```mermaid
graph TB
  subgraph "Triggers de Entrada"
    EMAIL["📧 E-mail com áudio\n[TRANSCRICAO]"]
    ELECTRON_UI["🖥️ Electron App\n(Upload manual / Gravação)"]
  end

  subgraph "ata_agent (Python)"
    IMAP["IMAP Listener\nimap_listener.py"]
    GEMINI_CLIENT["Gemini Client\ngemini_client.py"]
    ORCH1["Orchestrator\norchestrator.py"]
    STORE["Store\nstore.py"]
    SMTP1["SMTP Dispatcher\nsmtp_dispatcher.py"]
  end

  subgraph "ata_multiagent_pipeline (Python)"
    CLI["CLI\ncli.py"]
    ORCH2["Orchestrator\norchestrator.py"]
    AGENTS["Agents\nAtaAgent + ExtractorAgent"]
    EMAILING["Emailing\nemailing.py"]
    GITOPS["GitOps\ngitops.py"]
  end

  subgraph "gemini-whisper (Electron)"
    REACT_APP["React App\nApp.tsx"]
    TRANS_SVC["Transcription Service"]
    IPC["Electron IPC\nmain.cjs"]
  end

  subgraph "web (Next.js)"
    DASHBOARD["Dashboard\napp/page.tsx"]
  end

  subgraph "External Services"
    GEMINI_API["Google Gemini\n2.5 Flash API"]
    OPENAI_API["OpenAI\nGPT-4o-mini / Whisper"]
    GMAIL_IMAP["Gmail IMAP\nimap.gmail.com:993"]
    GMAIL_SMTP["Gmail SMTP\nsmtp.gmail.com:587"]
    NEON_DB[("Neon PostgreSQL\n(serverless)")]
  end

  EMAIL --> GMAIL_IMAP
  GMAIL_IMAP --> IMAP
  IMAP --> ORCH1
  ORCH1 --> GEMINI_CLIENT
  GEMINI_CLIENT --> GEMINI_API
  GEMINI_API --> GEMINI_CLIENT
  ORCH1 --> STORE
  ORCH1 --> SMTP1
  SMTP1 --> GMAIL_SMTP
  GMAIL_SMTP --> EMAIL

  ELECTRON_UI --> REACT_APP
  REACT_APP --> TRANS_SVC
  TRANS_SVC --> GEMINI_API
  TRANS_SVC --> OPENAI_API
  REACT_APP --> IPC
  IPC --> CLI
  CLI --> ORCH2
  ORCH2 --> AGENTS
  AGENTS --> OPENAI_API
  ORCH2 --> EMAILING
  EMAILING --> GMAIL_SMTP
  ORCH2 --> GITOPS

  DASHBOARD --> NEON_DB

  style NEON_DB fill:#336791,color:#fff
  style GEMINI_API fill:#4285f4,color:#fff
  style OPENAI_API fill:#10a37f,color:#fff
```

---

## 2. Fluxo de Processamento — Pipeline Email (ata_agent)

```mermaid
sequenceDiagram
  participant Gmail
  participant IMAP as imap_listener.py
  participant Store as store.py
  participant Orch as orchestrator.py
  participant Gemini as gemini_client.py
  participant GeminiAPI as Gemini API
  participant SMTP as smtp_dispatcher.py
  participant Recipient as Destinatário

  loop A cada N segundos (daemon)
    IMAP->>Gmail: SEARCH UNSEEN [TRANSCRICAO]
    Gmail-->>IMAP: UIDs de e-mails não lidos

    loop Para cada e-mail
      IMAP->>Store: is_processed(message_id)?
      alt Já processado
        Store-->>IMAP: true → skip
      else Não processado
        Store-->>IMAP: false → continuar
        IMAP->>Gmail: FETCH message (RFC822)
        Gmail-->>IMAP: E-mail completo + anexo
        IMAP->>Orch: AudioJob(message_id, audio_path)

        Orch->>Gemini: upload_audio(audio_path)
        Gemini->>GeminiAPI: POST /upload/v1beta/files
        GeminiAPI-->>Gemini: file_uri

        Gemini->>GeminiAPI: GET /v1beta/files/{name} (poll)
        GeminiAPI-->>Gemini: status: ACTIVE

        Gemini->>GeminiAPI: generateContent (transcrição)
        GeminiAPI-->>Gemini: transcricao_bruta

        Gemini->>GeminiAPI: generateContent (extração JSON)
        GeminiAPI-->>Gemini: {decisions, actions, kaizens, risks}

        Gemini->>GeminiAPI: generateContent (ATA Markdown)
        GeminiAPI-->>Gemini: ata_markdown_final

        Gemini->>GeminiAPI: generateContent (resumo)
        GeminiAPI-->>Gemini: ata_resumo_executivo

        Orch->>Orch: validate_ata() ≥ 120 chars + keyword

        alt Validação OK
          Orch->>SMTP: send_ata_email(state)
          SMTP->>Gmail: SMTP TLS (text + HTML)
          Gmail->>Recipient: 📧 ATA da reunião
          Orch->>Store: mark_processed(message_id)
          Orch->>Gmail: STORE +FLAGS \\Seen
        else Validação FALHOU
          Orch->>Orch: log error, skip send
        end

        Gemini->>GeminiAPI: DELETE /v1beta/files/{name}
      end
    end
  end
```

---

## 3. Fluxo de Processamento — Pipeline Electron (ata_multiagent)

```mermaid
sequenceDiagram
  participant User as Usuário
  participant React as React App
  participant IPC as Electron IPC (main.cjs)
  participant Python as ata_multiagent_pipeline
  participant OpenAI as OpenAI API
  participant SMTP as Gmail SMTP

  User->>React: Upload áudio ou gravação
  React->>React: transcribeWithGemini() → texto

  alt Diarização habilitada
    React->>React: discoverSpeakers() → speaker IDs
    React->>User: SpeakerIdentificationModal
    User->>React: Mapeia IDs para nomes
  end

  User->>React: Clica "Gerar ATA"
  React->>User: AtaGenerationModal
  User->>React: Preenche projeto, sprint, participantes, destinatários
  React->>IPC: invoke('ata-pipeline:run', AtaPipelineRequest)

  IPC->>IPC: Resolve Python executable
  IPC->>Python: spawn('python', ['-m', 'ata_multiagent_pipeline', event.json])

  Python->>Python: preflight() — verifica SMTP + OpenAI
  Python->>OpenAI: ExtractorAgent.extract() [JSON mode]
  OpenAI-->>Python: {decisions, actions, kaizens, risks}
  Python->>OpenAI: AtaAgent.generate()
  OpenAI-->>Python: ata_markdown_final
  Python->>Python: validate (score >= 80)
  Python->>SMTP: send_email()
  SMTP-->>Python: OK
  Python->>Python: Save artefatos em generated/

  Python-->>IPC: stdout: JSON result
  IPC-->>React: AtaPipelineExecutionResult
  React->>User: Status (success/error) no FileQueue
```

---

## 4. Diagrama de Componentes React (gemini-whisper)

```mermaid
graph TD
  APP["App.tsx\n(state: queue, provider, apiKeys, ataDefaults)"]

  APP --> SETTINGS["SettingsModal\n(apiKeys, provider, defaults → localStorage)"]
  APP --> UPLOAD["FileUpload\n(drag-drop → File[])"]
  APP --> RECORDER["AudioRecorder\n(MediaRecorder → Blob)"]
  APP --> CONTEXT["ContextRecorder\n(contexto + gravação)"]
  APP --> QUEUE["FileQueue\n(QueueItem[] com status/progresso)"]

  QUEUE --> TRANS_VIEW["TranscriptionView\n(texto + export)"]
  QUEUE --> SPEAKER_MODAL["SpeakerIdentificationModal\n(ID → nome)"]
  QUEUE --> ATA_MODAL["AtaGenerationModal\n(projeto/sprint/dest → pipeline)"]

  UPLOAD --> APP
  RECORDER --> APP
  CONTEXT --> APP

  APP --> TRANS_SVC["transcriptionService.ts\n(Gemini 2.5 / OpenAI Whisper)"]
  APP --> ATA_SVC["ataPipelineService.ts\n(Electron IPC)"]

  TRANS_SVC --> GEMINI["Gemini API"]
  TRANS_SVC --> OPENAI["OpenAI API"]
  ATA_SVC --> ELECTRON["electron/main.cjs"]
  ELECTRON --> PYTHON["ata_multiagent_pipeline"]
```

---

## 5. ERD — Banco de Dados (Neon PostgreSQL)

```mermaid
erDiagram
  pipeline_events {
    text id PK "Primary key (string)"
    timestamptz created_at "Default: NOW()"
    text event_type "NOT NULL: nova_reuniao, email_audio..."
    boolean success "Nullable: resultado do pipeline"
    jsonb payload "Nullable: PipelineState completo"
  }
```

---

## 6. Estrutura de Módulos e Dependências

```mermaid
graph LR
  subgraph "Shared Config"
    ENV[".env (raiz)"]
    TEMPLATES["Template de atas/"]
  end

  subgraph "ata_agent"
    ATA_CONFIG["config.py\n(Settings)"]
    ATA_CONTRACTS["contracts.py\n(PipelineState)"]
  end

  subgraph "ata_multiagent_pipeline"
    MULTI_CONFIG["config.py\n(PipelineConfig)"]
    MULTI_CONTRACTS["contracts.py\n(Decision, ActionItem...)"]
  end

  subgraph "gemini-whisper"
    TYPES["types.ts\n(QueueItem, AtaPipelineRequest...)"]
    THEME_NONE["(sem design tokens — usa Tailwind direto)"]
  end

  subgraph "web"
    SCHEMA["db/schema.ts"]
    TOKENS["theme/tokens.ts"]
  end

  ENV --> ATA_CONFIG
  ENV --> MULTI_CONFIG
  ENV --> TYPES
  ENV --> SCHEMA

  TEMPLATES --> ATA_CONFIG

  ATA_CONTRACTS --> ATA_CONFIG
  MULTI_CONTRACTS --> MULTI_CONFIG

  MULTI_CONTRACTS -.->|"IPC JSON"| TYPES
```

---

## 7. Deploy e Runtime

```mermaid
graph TB
  subgraph "Desenvolvedor / Servidor Local"
    DAEMON["ata_agent daemon\n(python -m ata_agent daemon)"]
    ELECTRON_APP["gemini-whisper\n(Electron desktop)"]
  end

  subgraph "Cloud"
    VERCEL["Vercel\n(web/ Next.js)"]
    NEON["Neon PostgreSQL\n(serverless)"]
  end

  subgraph "Google"
    GMAIL_SVC["Gmail\n(IMAP + SMTP)"]
    GEMINI_SVC["Gemini API\n(Files API)"]
  end

  subgraph "OpenAI"
    OPENAI_SVC["OpenAI API\n(GPT-4o-mini + Whisper)"]
  end

  DAEMON --> GMAIL_SVC
  DAEMON --> GEMINI_SVC
  ELECTRON_APP --> GEMINI_SVC
  ELECTRON_APP --> OPENAI_SVC
  ELECTRON_APP --> GMAIL_SVC
  VERCEL --> NEON
  VERCEL --> VERCEL
```

---

## Perguntas em Aberto

1. **Lacuna no diagrama de deploy:** O `ata_agent/` popula o Neon? Não há ligação entre o Python e o Neon nos diagramas — essa conexão falta no código.
2. **`ata_multiagent_pipeline` standalone:** Pode ser executado sem o Electron? Sim — via `python -m ata_multiagent_pipeline event.json`. O Electron é apenas uma UI opcional.
3. **Comunicação web ↔ Python:** O dashboard `web/` e o `ata_agent/` são totalmente desacoplados (sem API entre eles). Como o dashboard vai mostrar eventos em tempo real na v2?
