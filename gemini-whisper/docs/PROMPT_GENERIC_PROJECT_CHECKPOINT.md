---
created: 2026-03-21T16:15
updated: 2026-03-21T16:15
project: Gemini Whisper
stack: React 19 + TypeScript + Vite + Electron
---

# CHECKPOINT DO PROJETO: Gemini Whisper

**Data do Checkpoint:** 2026-03-21
**Modelo AI sugerido:** claude-sonnet-4-6 / gemini-2.5-flash
**Diretório raiz:** `C:\INTELIGENCIA ARTIFICAL\inteligencia artificial\SCRIPTS FUNCIONAIS\gemini-whisper`

---

## 1. VISÃO GERAL DO PROJETO

**Gemini Whisper** é uma aplicação desktop e web de transcrição de áudio e vídeo em lote, com suporte a múltiplos provedores de IA. O foco principal é a integração com o **Google Gemini 2.5 Flash**, com fallbacks para OpenAI Whisper e Hugging Face.

**Funcionalidades principais:**
- Transcrição em lote de arquivos de áudio e vídeo via fila
- Gravação ao vivo com transcrição em tempo real
- Live Context Recording: grava tela + áudio + captura screenshots com hotkey
- Suporte a múltiplos provedores: Gemini, OpenAI Whisper, Hugging Face
- Diarização de falantes
- Tradução para inglês
- Exportação como `.txt` ou `.md`
- App desktop via Electron (Windows NSIS installer)

---

## 2. STACK TECNOLÓGICA

| Categoria | Tecnologia | Versão |
|-----------|-----------|--------|
| UI Framework | React | 19.2.4 |
| Linguagem | TypeScript | 5.8.2 |
| Build Tool | Vite | 6.2.0 |
| Desktop | Electron | 34.1.1 |
| Packaging | Electron Builder | 25.1.8 |
| AI (primário) | Google Gemini 2.5 Flash | via @google/genai 1.41.0 |
| AI (alternativo) | OpenAI Whisper-1 | via REST API |
| AI (alternativo) | HuggingFace whisper-large-v3 | via Inference API |
| CSS | Tailwind CSS | via CDN no index.html |
| Icons | Lucide React | 0.563.0 |
| Env Vars | dotenv | 17.2.4 |
| Dev paralelo | concurrently + wait-on | - |

**Package Manager:** npm (package-lock.json presente)

---

## 3. ESTRUTURA DE DIRETÓRIOS

```
gemini-whisper/
├── App.tsx                        # Componente principal (728 linhas)
├── index.tsx                      # Entry point React
├── index.html                     # Template HTML com Tailwind CDN
├── types.ts                       # Tipos TypeScript globais
├── package.json                   # Scripts e dependências
├── tsconfig.json                  # Configuração TypeScript
├── vite.config.ts                 # Configuração Vite + aliases
├── metadata.json                  # Metadados do app
├── .env.local                     # API Keys (NÃO commitar)
├── .gitignore
│
├── components/
│   ├── FileUpload.tsx             # Drag-drop upload com validação
│   ├── FileQueue.tsx              # UI da fila de processamento
│   ├── AudioRecorder.tsx          # Gravação de microfone em tempo real
│   ├── ContextRecorder.tsx        # Live context: tela + áudio + screenshots
│   ├── TranscriptionView.tsx      # Exibição de resultados
│   └── SettingsModal.tsx          # Configuração de providers e API keys
│
├── services/
│   ├── transcriptionService.ts    # Orquestrador principal de transcrição
│   └── geminiService.ts           # Serviço Gemini legado
│
├── utils/
│   ├── costCalculator.ts          # Estimativa de custo OpenAI ($0.006/min)
│   └── fileUtils.ts               # Chunking de arquivos + formatBytes
│
├── electron/
│   └── main.cjs                   # Processo principal Electron
│
├── scripts/                       # Scripts de teste/diagnóstico
│   ├── listModels.js
│   ├── listModelsClean.js
│   ├── listModelsVerbose.js
│   ├── testGen.js
│   ├── testGenAlpha.js
│   └── testGenFinal.js
│
├── dist/                          # Build de produção (web)
├── release/                       # Installer Electron (win-unpacked)
│
├── docs/
│   └── PROMPT_GENERIC_PROJECT_CHECKPOINT.md  # Este arquivo
│
└── implementação ideia/           # Implementação alternativa/experimental
    ├── package.json
    ├── index.tsx
    ├── index.html
    ├── metadata.json
    ├── tsconfig.json
    └── vite.config.ts
```

---

## 4. TIPOS TYPESCRIPT PRINCIPAIS (`types.ts`)

```typescript
enum ProcessStatus {
  IDLE, PENDING, UPLOADING, PROCESSING, COMPLETED, ERROR
}

interface TranscriptionResult {
  text: string;
  language?: string;
  summary?: string;
  provider: string;
}

type TranscriptionProvider = 'gemini' | 'openai' | 'huggingface';

interface ApiKeys {
  openai: string;
  huggingface: string;
}

interface QueueItem {
  id: string;
  file: File;
  status: ProcessStatus;
  result?: TranscriptionResult;
  error?: string;
  type: 'audio' | 'video';
  previewUrl?: string;
  progressMessage?: string;
}
```

---

## 5. COMPONENTE PRINCIPAL (`App.tsx` — 728 linhas)

### Estado principal:
| State | Tipo | Descrição |
|-------|------|-----------|
| `viewMode` | `'files' \| 'live-context'` | Aba ativa |
| `queue` | `QueueItem[]` | Fila de arquivos |
| `provider` | `TranscriptionProvider` | Provider AI selecionado |
| `apiKeys` | `ApiKeys` | Chaves de API (localStorage) |
| `mode` | `'transcribe' \| 'translate'` | Modo de operação |
| `inputMode` | `'upload' \| 'record'` | Upload ou gravação |
| `language` | `string` | Idioma alvo |
| `useDiarization` | `boolean` | Diarização ativa |
| `isProcessingQueue` | `boolean` | Fila processando |

### Funções principais:
- `handleFilesSelected()` — Adiciona arquivos à fila
- `handleRemoveFromQueue()` — Remove item da fila
- `processQueue()` — Loop recursivo de processamento sequencial
- `handleSessionComplete()` — Processa gravação ao vivo
- `processSessionAuto()` — Auto-processa sessão e gera markdown
- `downloadMarkdown()` — Exporta sessão como `.md` com screenshots
- `downloadText()` — Exporta transcrição como `.txt`
- `generateMarkdown()` — Gera markdown com screenshots embutidos

---

## 6. SERVIÇO DE TRANSCRIÇÃO (`services/transcriptionService.ts`)

**Função principal:** `transcribeMedia(file, mode, provider, apiKeys, options)`

### Implementações por provider:

**A) Gemini (primário)**
- Upload via Google File API (protocolo resumível)
- Segmentação de arquivos grandes (intervalos de 10 minutos)
- Modelo: `gemini-2.5-flash`
- Parsing de JSON estruturado na resposta
- Suporte a diarização de falantes
- Retorna: `{ text, language, summary }`

**B) OpenAI Whisper**
- Endpoint: `/v1/audio/transcriptions` ou `/v1/audio/translations`
- Submit como `multipart/form-data`
- Modelo: `whisper-1`
- Retorna: texto plano

**C) Hugging Face**
- Inference API: `openai/whisper-large-v3`
- Autenticação: Bearer token
- Retorna: `{ text }`

**Lógica de chunking:**
- `CHUNK_SIZE = 24MB` (limite OpenAI: 25MB)
- `getFileChunks(file)` divide arquivos grandes em pedaços

---

## 7. COMPONENTES UI

### `FileUpload.tsx`
- Drag-and-drop + seleção múltipla
- Tipos aceitos: `audio/*, video/*, .ogg, .m4a, .mp3, .wav, .webm, .mp4, .mpeg, .mov`
- Tamanho máximo: 2GB
- Suporte a formato WhatsApp (`.ogg`, `.m4a`)

### `FileQueue.tsx`
- Exibe status: PENDING, PROCESSING, COMPLETED, ERROR
- Ações por item: Download (TXT), Ver resultado, Remover
- Limpar itens concluídos
- Barra de progresso animada para itens ativos
- Mensagens de progresso em tempo real

### `AudioRecorder.tsx`
- Input de microfone em tempo real
- Timer (MM:SS)
- Indicador visual pulsante
- Converte para WebM
- Gerencia permissões do browser

### `ContextRecorder.tsx`
- Captura simultânea: tela/janela + áudio
- Speech-to-text em tempo real via Google GenAI
- Screenshots via hotkey (padrão: `Ctrl+Shift+S`)
- Screenshots via mouse buttons 3/4
- Metadados de timestamp em cada captura
- Exporta sessão como markdown com screenshots embutidos
- Integração com Electron IPC para shortcuts globais

### `SettingsModal.tsx`
- Seleção do provider (Gemini / OpenAI / HuggingFace)
- Campos de API key (inputs tipo password)
- Persistência em localStorage

---

## 8. ELECTRON (`electron/main.cjs`)

| Configuração | Valor |
|-------------|-------|
| Tamanho da janela | 1200x800 |
| Dev mode | Carrega `localhost:5173` + DevTools aberto |
| Prod mode | Carrega `dist/index.html` |
| nodeIntegration | true |
| contextIsolation | false |
| webSecurity | false |
| backgroundThrottling | false |

**Atenção:** Configurações de segurança permissivas para desenvolvimento — devem ser restritas em produção.

---

## 9. VITE CONFIG (`vite.config.ts`)

- Base URL: `./` (paths relativos)
- Dev server: porta `5173`, host `0.0.0.0`
- Plugin: `@vitejs/plugin-react`
- Alias: `@/*` → diretório raiz
- Variáveis expostas: `process.env.GEMINI_API_KEY`, `process.env.OPENAI_API_KEY`

---

## 10. SCRIPTS NPM

```bash
npm run dev              # Inicia dev server Vite (porta 5173)
npm run build            # Build da web app → dist/
npm run preview          # Preview da build de produção
npm run electron:dev     # Electron + Vite dev server em paralelo
npm run electron:build   # Gera installer Electron → release/
```

---

## 11. VARIÁVEIS DE AMBIENTE (`.env.local`)

```
GEMINI_API_KEY=<chave_google_gemini>
OPENAI_API_KEY=<chave_openai>
```

> **ATENÇÃO:** Nunca commitar este arquivo. Está no `.gitignore`.
> API keys do OpenAI e HuggingFace também podem ser fornecidas via UI (localStorage).

---

## 12. FLUXOS DE USUÁRIO

### Fluxo 1: Transcrição em Lote
1. Aba "Files" → modo Upload
2. Upload múltiplos arquivos (drag-drop ou clique)
3. Configura opções: modo, idioma, provider, diarização
4. Clica "Start Processing"
5. Fila processa sequencialmente com feedback visual
6. Download de cada resultado como `.txt`

### Fluxo 2: Live Context Recording
1. Aba "Live Context"
2. Inicia sessão de gravação (tela + áudio)
3. Fala normalmente — transcrição em tempo real
4. Captura screenshots com `Ctrl+Shift+S`
5. Para a gravação
6. App gera markdown: transcript + screenshots com timestamps
7. Download como `.md`

### Fluxo 3: Gerenciamento de API Keys
1. Clica ícone de Settings
2. Modal abre com seleção de provider
3. Insere API key desejada
4. Salvo em localStorage — persiste entre sessões

---

## 13. UTILITÁRIOS

### `utils/costCalculator.ts`
- `calculateOpenAICost(durationInSeconds)` — $0.006/minuto
- `formatCurrency(amount)` — Formata como USD (4 casas decimais)

### `utils/fileUtils.ts`
- `CHUNK_SIZE = 24MB`
- `getFileChunks(file)` — Divide arquivos em chunks para upload
- `formatBytes(bytes)` — Converte bytes para B/KB/MB/GB legível

---

## 14. METADADOS DO APP (`metadata.json`)

```json
{
  "name": "Gemini Whisper",
  "description": "A high-performance audio and video transcription application powered by Gemini 2.5 Flash."
}
```

**Build config (package.json):**
- App ID: `com.gemini.whisper`
- Produto: `Gemini Whisper`
- Target: Windows NSIS (instalação customizável, one-click desativado)

---

## 15. DECISÕES ARQUITETURAIS

| Decisão | Motivação |
|---------|-----------|
| Fila sequencial com refs | Evita race conditions no loop de processamento |
| Provider abstraction | Fácil trocar ou adicionar novos provedores AI |
| localStorage para API keys | Persiste sem backend |
| Electron + Web híbrido | Mesmo codebase funciona como web e desktop |
| `.env.local` para Gemini key | Chave sensível não exposta via UI |
| Segmentação de 10min no Gemini | Contorna limite de processamento de arquivos grandes |

---

## 16. ESTADO ATUAL DO PROJETO (2026-03-21)

- Core features completos e estáveis
- `App.tsx` extensivamente refatorado (fev/2026)
- Sistema de fila implementado e funcional
- Todos os componentes finalizados
- Suporte Electron adicionado
- Build de produção configurado
- Pasta `implementação ideia/` contém variante experimental separada

### Pontos de atenção / possíveis TODOs:
- Segurança do Electron: `nodeIntegration`, `contextIsolation`, `webSecurity` precisam revisão para produção
- Calculadora de custo só implementada para OpenAI
- Diarização não totalmente testada com todos os providers
- Feature de screenshots em `QueueItem` não unificada com fluxo de sessão ao vivo
- `geminiService.ts` marcado como legado — checar se ainda é usado

---

## 17. DEPENDÊNCIAS EXTERNAS

| Serviço | Uso | Custo |
|---------|-----|-------|
| Google Gemini API | Provider primário | Free tier disponível |
| OpenAI API | Provider alternativo | $0.006/min (whisper-1) |
| Hugging Face Inference | Provider alternativo | Free tier + token |

> Todos os serviços requerem conectividade de internet. Não há processamento local de AI.

---

## 18. CONTEXTO PARA CONTINUAR O DESENVOLVIMENTO

Ao retomar este projeto, lembre-se:

1. **Entry point principal:** [App.tsx](../App.tsx) — toda a orquestração está aqui
2. **Lógica de transcrição:** [services/transcriptionService.ts](../services/transcriptionService.ts)
3. **Tipos globais:** [types.ts](../types.ts)
4. **Para rodar em dev:** `npm run electron:dev` (Electron) ou `npm run dev` (web)
5. **Build para Windows:** `npm run electron:build` → gera em `release/`
6. **API keys:** configurar `.env.local` ou via Settings UI no app
7. **Provider padrão:** Gemini (não requer input de key na UI, usa `.env.local`)

---

## 19. FEATURE PLAN: Diarização Precisa com Identificação de Falantes

**Status:** Planejado — a implementar
**Prioridade:** Alta

### Visão geral

Implementar diarização de falantes em duas fases separadas, permitindo que **arquivos de qualquer tamanho** sejam diarizados corretamente:

1. **Fase de Descoberta** — identificar os falantes no máximo de áudio possível
2. **Fase de Nomeação** — usuário nomeia cada falante via preview de áudio
3. **Fase de Transcrição** — arquivo processado em chunks, cada chunk já conhece os falantes

### Fluxo completo

```
[Upload arquivo] → [FASE 1: Discovery Pass]
                        ↓
              Gemini processa o máximo possível do arquivo
              (arquivo inteiro ou limite do modelo)
              Objetivo: identificar quem são os falantes,
              suas características vocais e timestamps de amostra
                        ↓
              Retorna: { speakers: ["Speaker 1", "Speaker 2"],
                         samples: [{speaker, startTime, endTime, text}] }
                        ↓
                   [FASE 2: Modal de Nomeação]
                        ↓
              Para cada falante detectado:
                - Preview de áudio (~8s) cortado do arquivo original
                - Trecho de fala como referência textual
                - Input para o usuário digitar o nome real
                        ↓
              Usuário confirma: { "Speaker 1": "João", "Speaker 2": "Maria" }
                        ↓
              speakerProfiles salvo no QueueItem (persiste)
                        ↓
                   [FASE 3: Transcrição Chunked]
                        ↓
              Arquivo dividido em chunks de 10min (comportamento atual)
              CADA CHUNK recebe no prompt:
                "Os falantes identificados são:
                 - Speaker 1 = João (primeira voz a falar)
                 - Speaker 2 = Maria (segunda voz)
                 Use exatamente esses nomes na transcrição."
                        ↓
              Chunks concatenados → resultado final com nomes reais
```

### Por que essa arquitetura

| Problema | Solução |
|----------|---------|
| Arquivos longos não cabem em um único request | Discovery pass + chunked transcription |
| Chunks processados independentemente perdem contexto de quem é quem | Speaker profiles do discovery pass são injetados no prompt de cada chunk |
| Gemini pode rotular "Speaker 1" diferente em chunks diferentes | Profiles fixos garantem consistência entre chunks |
| Usuário não sabe quem é "Speaker 1" | Preview de áudio + texto permite identificação antes de transcrever |

### Arquivos a criar/modificar

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `types.ts` | Modificar | `SpeakerSegment`, `SpeakerProfile`, `SPEAKER_COLORS`, `AWAITING_NAMES` status, extende `TranscriptionResult` e `QueueItem` |
| `services/transcriptionService.ts` | Modificar | Nova função `discoverSpeakers()` (discovery pass); prompt dos chunks recebe speaker profiles |
| `utils/audioSlicer.ts` | **Criar** | Web Audio API: corta arquivo no intervalo `[startSec, endSec]` → blob WAV para preview |
| `components/SpeakerIdentificationModal.tsx` | **Criar** | Modal: card por falante com player de áudio, trecho de fala, input de nome |
| `components/TranscriptionView.tsx` | Modificar | Renderização por segmento com cores + legenda de falantes + botão "Editar Nomes" |
| `components/FileQueue.tsx` | Modificar | Novo status `AWAITING_NAMES` ("Aguardando identificação...") |
| `App.tsx` | Modificar | Novo estado `diarizationPendingItem`; pausa fila no AWAITING_NAMES; retoma após nomeação |

### Novos tipos

```typescript
// Segmento de fala com timestamp (retornado pelo discovery pass)
interface SpeakerSegment {
  speaker: string;      // "Speaker 1", "Speaker 2"
  startTime: number;    // segundos absolutos desde o início do arquivo
  endTime: number;
  text: string;
}

// Perfil de falante (preenchido após nomeação pelo usuário)
interface SpeakerProfile {
  id: string;           // "Speaker 1" — faz match com SpeakerSegment.speaker
  displayName: string;  // nome real: "João", "Maria"
  color: string;        // da paleta SPEAKER_COLORS
  sampleText: string;   // trecho de fala para referência
}

// TranscriptionResult ganha campos opcionais:
interface TranscriptionResult {
  text: string;
  language?: string;
  summary?: string;
  provider: string;
  segments?: SpeakerSegment[];        // NOVO: segmentos do discovery pass
  speakerProfiles?: SpeakerProfile[]; // NOVO: profiles após nomeação
}

// QueueItem ganha campos de lifecycle da diarização:
interface QueueItem {
  // ... campos existentes ...
  awaitingDiarization?: boolean;
  speakerNames?: Record<string, string>; // { "Speaker 1": "João" } — persiste
}

// Novo status no enum:
enum ProcessStatus {
  // ... status existentes ...
  AWAITING_NAMES = 'AWAITING_NAMES', // NOVO: pausado aguardando nomes
}

// Paleta de até 6 falantes:
const SPEAKER_COLORS = [
  { bg: 'bg-blue-500/20',    text: 'text-blue-300',    border: 'border-blue-500/40',    hex: '#93c5fd' },
  { bg: 'bg-amber-500/20',   text: 'text-amber-300',   border: 'border-amber-500/40',   hex: '#fcd34d' },
  { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/40', hex: '#6ee7b7' },
  { bg: 'bg-rose-500/20',    text: 'text-rose-300',    border: 'border-rose-500/40',    hex: '#fda4af' },
  { bg: 'bg-purple-500/20',  text: 'text-purple-300',  border: 'border-purple-500/40',  hex: '#d8b4fe' },
  { bg: 'bg-cyan-500/20',    text: 'text-cyan-300',    border: 'border-cyan-500/40',    hex: '#67e8f9' },
];
```

### Gemini: Discovery Pass (nova função `discoverSpeakers`)

- Envia o arquivo inteiro via File API (resumable upload já existente)
- `maxOutputTokens: 16384`, `temperature: 0.1`
- Prompt focado **apenas em identificar falantes**, não em transcrever tudo:

```
You are a speaker diarization AI.
Analyze this audio and identify all distinct speakers.
For each speaker, provide 2-3 representative segments (their clearest speech moments).
Timestamps must be absolute seconds from the start of the file.

Return ONLY this JSON (no markdown):
{
  "language": "pt",
  "speakers": ["Speaker 1", "Speaker 2"],
  "segments": [
    { "speaker": "Speaker 1", "startTime": 0.0, "endTime": 8.5, "text": "..." },
    { "speaker": "Speaker 2", "startTime": 9.0, "endTime": 17.2, "text": "..." },
    { "speaker": "Speaker 1", "startTime": 45.3, "endTime": 52.1, "text": "..." }
  ]
}
```

### Gemini: Transcrição Chunked com Profiles injetados

Cada chunk recebe no prompt os profiles identificados:

```
You are a professional transcription AI.
Transcribe this audio segment in ${language}.

KNOWN SPEAKERS (use these names exactly — do NOT use "Speaker N" labels):
${profiles.map(p => `- ${p.id} = ${p.displayName}`).join('\n')}

Return JSON: { "text": "...", "segments": [...] }
```

Isso garante que mesmo que o Gemini "esqueça" o contexto entre chunks, cada chunk sabe exatamente quem é quem.

### Utilitário `audioSlicer.ts`

```typescript
// Corta o arquivo no intervalo dado e retorna URL de objeto WAV
export async function extractAudioClip(
  file: File,
  startSec: number,
  endSec: number
): Promise<string>

// Implementação: Web Audio API + encoder WAV 16-bit PCM
// Sem dependências externas — funciona em browser e Electron
// Em caso de erro de decode (formato não suportado): retorna null
// Adicionar margem de ±0.5s para compensar drift de timestamp do Gemini
```

### Modal `SpeakerIdentificationModal`

- Abre automaticamente após discovery pass (se > 1 falante)
- Card por falante com:
  - Cor identificadora (da paleta)
  - Botão play/pause da amostra de áudio (~8s)
  - Trecho de fala em itálico
  - Input: "Nome do falante..." (Enter avança para o próximo)
- Rodapé: `[Pular — usar labels genéricos]` | `[Confirmar Nomes]`
- Ao confirmar → speakerNames salvo no QueueItem → fila retoma

### Comportamento especial: 1 único falante

Se o discovery pass detectar apenas 1 speaker → pula o modal → processa diretamente sem diarização no resultado final.

### Renderização final (`TranscriptionView`)

Quando `result.segments` presente:
- Legenda de cores no topo (ex: 🔵 João · 🟡 Maria)
- Cada bloco de fala: `[timestamp] NomeFalante: texto da fala`
- Barra lateral colorida por falante
- Botão "Editar Nomes" reabre o modal preenchido com nomes atuais

---

*Checkpoint gerado em 2026-03-21 via análise do código-fonte atual.*
*Atualizado em 2026-03-21 — adicionada seção de feature plan (diarização).*
