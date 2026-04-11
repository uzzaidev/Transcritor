---
created: 2026-03-21
updated: 2026-03-21
feature: Diarização Precisa com Identificação de Falantes
status: Planejado — aguardando implementação
---

# PLANO DE IMPLEMENTAÇÃO: Diarização com Identificação de Falantes

## Resumo executivo

Implementar diarização em **3 fases desacopladas**, permitindo que arquivos de **qualquer duração** sejam diarizados com nomes reais de falantes:

1. **Discovery Pass** — Gemini analisa o máximo do arquivo para identificar os falantes
2. **Nomeação** — usuário ouve amostras de áudio e nomeia cada falante
3. **Transcrição Chunked** — arquivo processado em chunks de 10min com os profiles já conhecidos injetados em cada chunk

---

## O problema com a abordagem ingênua

Processar o arquivo inteiro em um único request para diarizar **não escala**:

- Arquivos longos excedem o limite de tokens do Gemini
- A segmentação atual (chunks de 10min) perde contexto entre chunks — o Gemini pode chamar o mesmo falante de "Speaker 1" num chunk e "Speaker 2" em outro
- Sem names, o output final traz "Speaker 1:", "Speaker 2:" — sem valor prático

### Solução: separar descoberta de transcrição

```
Discovery Pass (arquivo inteiro → identifica quem são os falantes)
        ↓
   Modal de Nomeação (usuário ouve e nomeia)
        ↓
Transcrição Chunked (cada chunk recebe os profiles → output consistente)
```

---

## Arquitetura detalhada

### FASE 1 — Discovery Pass

**Objetivo:** identificar os falantes e coletar amostras representativas. Não é uma transcrição completa.

**Como funciona:**
- Arquivo enviado via File API (upload resumível — já implementado)
- Request único com `maxOutputTokens: 16384` e `temperature: 0.1`
- Gemini analisa o arquivo inteiro (ou o máximo que o modelo suportar)
- Retorna JSON estruturado com amostras por falante e timestamps

**Prompt do Discovery Pass:**

```
You are a speaker diarization AI.
Analyze this audio file and identify all distinct speakers.

For each speaker, provide 2-3 of their clearest and most representative speech segments.
Timestamps must be absolute seconds from the very start of the file (float, 1 decimal place).
Label speakers in order of first appearance: "Speaker 1", "Speaker 2", etc.

Return ONLY valid JSON — no markdown fences, no extra text:
{
  "language": "<detected language name>",
  "speakers": ["Speaker 1", "Speaker 2"],
  "segments": [
    { "speaker": "Speaker 1", "startTime": 0.0,  "endTime": 8.5,  "text": "..." },
    { "speaker": "Speaker 2", "startTime": 9.2,  "endTime": 17.1, "text": "..." },
    { "speaker": "Speaker 1", "startTime": 45.0, "endTime": 52.3, "text": "..." }
  ]
}
```

**Output:** `SpeakerDiscoveryResult` salvo no `QueueItem` e usado nas fases seguintes.

---

### FASE 2 — Modal de Nomeação

**Objetivo:** usuário identifica quem é cada falante antes de processar o arquivo inteiro.

**Fluxo:**
1. App extrai clip de áudio (~8s) do arquivo para cada falante usando Web Audio API
2. Modal abre com um card por falante:
   - Player de áudio (play/pause da amostra)
   - Trecho de fala em itálico como referência textual
   - Input de texto: "Nome do falante..."
3. Usuário ouve, reconhece, digita o nome
4. Confirma → `speakerNames` salvo no `QueueItem`
5. Fila retoma automaticamente para a Fase 3

**Comportamento especial:** se apenas 1 falante detectado → pula o modal → vai direto para Fase 3.

---

### FASE 3 — Transcrição Chunked com Profiles

**Objetivo:** processar o arquivo completo em chunks de 10min (comportamento atual preservado), mas cada chunk recebe os profiles dos falantes no prompt.

**Prompt de cada chunk (quando diarização ativa):**

```
You are a professional transcription AI.
Transcribe this audio segment in ${language}.

KNOWN SPEAKERS — use these names exactly. Do NOT use generic "Speaker N" labels:
${profiles.map(p => `- ${p.id} = ${p.displayName}`).join('\n')}

Focus on the audio between ${startTimestamp} and ${endTimestamp}.
Capture every word. Do not summarize.

Return JSON:
{
  "text": "João: Olá, como você está?\n\nMaria: Estou bem, obrigado.",
  "segments": [
    { "speaker": "João", "startTime": 0.0, "endTime": 4.2, "text": "Olá, como você está?" },
    { "speaker": "Maria", "startTime": 4.5, "endTime": 7.1, "text": "Estou bem, obrigado." }
  ]
}
```

**Por que isso resolve o problema de consistência:**
Mesmo que o Gemini "esqueça" o contexto entre chunks separados, cada chunk recebe explicitamente os nomes dos falantes no prompt. O modelo não precisa inventar labels — eles já estão definidos.

---

## Novos tipos TypeScript (`types.ts`)

```typescript
// Segmento de fala com timestamp (vem do discovery pass e da transcrição chunked)
export interface SpeakerSegment {
  speaker: string;      // "Speaker 1" (discovery) ou "João" (pós-nomeação)
  startTime: number;    // segundos absolutos desde o início do arquivo
  endTime: number;
  text: string;
}

// Perfil de falante — preenchido após o usuário nomear
export interface SpeakerProfile {
  id: string;           // "Speaker 1" — faz match com SpeakerSegment.speaker
  displayName: string;  // nome real digitado: "João", "Maria", "Entrevistador"
  color: ColorToken;    // da paleta SPEAKER_COLORS
  sampleText: string;   // trecho de fala usado no modal de nomeação
}

// Resultado do discovery pass (salvo no QueueItem antes da nomeação)
export interface SpeakerDiscoveryResult {
  language: string;
  speakers: string[];           // ["Speaker 1", "Speaker 2"]
  segments: SpeakerSegment[];   // amostras representativas por falante
}

// TranscriptionResult: novos campos opcionais para diarização
export interface TranscriptionResult {
  text: string;
  language?: string;
  summary?: string;
  provider: string;
  segments?: SpeakerSegment[];        // NOVO: todos os segmentos da transcrição
  speakerProfiles?: SpeakerProfile[]; // NOVO: profiles com nomes reais
}

// QueueItem: campos de lifecycle da diarização
export interface QueueItem {
  id: string;
  file: File;
  status: ProcessStatus;
  result?: TranscriptionResult;
  error?: string;
  type: 'audio' | 'video';
  previewUrl?: string;
  progressMessage?: string;
  // NOVOS:
  discoveryResult?: SpeakerDiscoveryResult; // resultado da fase 1
  speakerNames?: Record<string, string>;    // { "Speaker 1": "João" } — persiste
  awaitingDiarization?: boolean;
}

// Novo status: item pausado aguardando nomeação
export enum ProcessStatus {
  IDLE = 'IDLE',
  PENDING = 'PENDING',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  AWAITING_NAMES = 'AWAITING_NAMES', // NOVO
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

// Paleta de cores para até 6 falantes
export type ColorToken = {
  bg: string;
  text: string;
  border: string;
  hex: string;
};

export const SPEAKER_COLORS: ColorToken[] = [
  { bg: 'bg-blue-500/20',    text: 'text-blue-300',    border: 'border-blue-500/40',    hex: '#93c5fd' },
  { bg: 'bg-amber-500/20',   text: 'text-amber-300',   border: 'border-amber-500/40',   hex: '#fcd34d' },
  { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/40', hex: '#6ee7b7' },
  { bg: 'bg-rose-500/20',    text: 'text-rose-300',    border: 'border-rose-500/40',    hex: '#fda4af' },
  { bg: 'bg-purple-500/20',  text: 'text-purple-300',  border: 'border-purple-500/40',  hex: '#d8b4fe' },
  { bg: 'bg-cyan-500/20',    text: 'text-cyan-300',    border: 'border-cyan-500/40',    hex: '#67e8f9' },
];
```

---

## Mudanças no `transcriptionService.ts`

### Nova função: `discoverSpeakers(file, options)`

```typescript
export async function discoverSpeakers(
  file: File,
  options: TranscriptionOptions
): Promise<SpeakerDiscoveryResult>
```

- Upload via `uploadFileToGemini()` (já existente)
- Request único ao Gemini com o prompt de discovery
- `maxOutputTokens: 16384`, `temperature: 0.1`
- Faz parse do JSON retornado → `SpeakerDiscoveryResult`
- Em caso de falha no parse ou 0 speakers → lança erro descritivo

### Função existente: `transcribeWithGemini()` — ajustes

Quando `options.diarization === true` e `options.speakerProfiles` presente:

1. Injeta os profiles no prompt de cada chunk:
   ```
   KNOWN SPEAKERS:
   - Speaker 1 = João
   - Speaker 2 = Maria
   ```
2. Pede retorno com `segments[]` além do `text`
3. Acumula os segments de todos os chunks (ajustando os timestamps relativos de cada chunk para absolutos)

Quando `options.diarization === true` mas `options.speakerProfiles` **não** presente:
- Não executa a transcrição — o caller (App.tsx) é quem orquestra a ordem correta

### Assinatura atualizada de `TranscriptionOptions`

```typescript
export interface TranscriptionOptions {
  diarization?: boolean;
  language?: string;
  duration?: number;
  onProgress?: (message: string) => void;
  speakerProfiles?: SpeakerProfile[]; // NOVO: injetados em cada chunk
}
```

---

## Novo arquivo: `utils/audioSlicer.ts`

Responsabilidade única: cortar o arquivo de áudio no intervalo `[startSec, endSec]` e retornar uma URL de objeto WAV para o `<audio>` do browser.

```typescript
// Retorna object URL de um clip WAV, ou null se o decode falhar
export async function extractAudioClip(
  file: File,
  startSec: number,
  endSec: number
): Promise<string | null>
```

**Implementação interna:**

```
1. file.arrayBuffer() → ArrayBuffer
2. new AudioContext().decodeAudioData(buffer) → AudioBuffer
3. Clamp: startSec = max(0, startSec - 0.5)   // margem para drift de timestamp
           endSec   = min(buffer.duration, endSec + 1.0)
4. Calcular startSample e endSample em frames
5. Criar novo AudioBuffer com (endSample - startSample) frames
6. Para cada canal: newBuffer.copyToChannel(slice, ch)
7. audioBufferToWav(newBuffer) → ArrayBuffer
8. URL.createObjectURL(new Blob([wavBuffer], { type: 'audio/wav' }))
```

**Encoder WAV interno (sem deps externas):**

```
RIFF header + fmt chunk (PCM 16-bit) + data chunk
- Samples: Float32 → clamp [-1,1] → Int16 (little-endian)
- Suporta mono e stereo
- DataView com setInt16(..., true) para little-endian
```

**Formatos suportados pelo AudioContext do Chromium/Electron:**
WAV, MP3, AAC/M4A, OGG/Opus, WebM — cobre todos os formatos aceitos pelo FileUpload.

**Clip de amostra:** selecionar o segmento com mais caracteres de texto entre os segmentos do falante (mais representativo), limitar a 8 segundos.

---

## Novo componente: `components/SpeakerIdentificationModal.tsx`

### Props

```typescript
interface SpeakerIdentificationModalProps {
  isOpen: boolean;
  file: File;
  discoveryResult: SpeakerDiscoveryResult;
  initialNames?: Record<string, string>;   // pré-preenche ao reabrir modal
  onConfirm: (names: Record<string, string>) => void;
  onCancel: () => void;
}
```

### Layout

```
┌─────────────────────────────────────────────────┐
│ 👥 Identificar Falantes                      [X] │
│ 2 falantes detectados — dê um nome a cada um     │
├─────────────────────────────────────────────────┤
│                                                   │
│  ▐ [🔵] Speaker 1                    [▶ Play]   │  ← barra azul lateral
│    "...trecho de fala do falante 1..."            │
│    Nome: [________________________]               │
│                                                   │
│  ▐ [🟡] Speaker 2                    [▶ Play]   │  ← barra âmbar lateral
│    "...trecho de fala do falante 2..."            │
│    Nome: [________________________]               │
│                                                   │
├─────────────────────────────────────────────────┤
│  [Pular — usar labels genéricos]  [Confirmar ▶] │
└─────────────────────────────────────────────────┘
```

### Comportamento

- **Extração de áudio:** ao abrir, `extractAudioClip()` é chamada para cada falante em paralelo (`Promise.all`)
- **Play/Pause:** um único áudio ativo por vez; pausar o anterior ao iniciar novo
- **Input:** Enter avança para o próximo input; último Enter equivale a "Confirmar"
- **Pular:** chama `onConfirm({})` — mantém labels "Speaker 1", "Speaker 2"
- **Confirmar:** chama `onConfirm(names)` — values em branco também usam label genérico
- **Cleanup:** `URL.revokeObjectURL()` em todos os clips ao fechar
- **Loading:** enquanto clips carregam, botão Play mostra spinner; Confirmar fica desabilitado

---

## Mudanças no `components/TranscriptionView.tsx`

### Nova prop

```typescript
onRequestRename?: () => void;  // exibe botão "Editar Nomes"
```

### Renderização condicional

**Quando `result.segments` presente** (diarização):

```
[Legenda no topo]
  🔵 João  🟡 Maria  [Editar Nomes]

[Blocos por segmento]
  ▐ João        00:00
    Olá, como você está?

  ▐ Maria       00:04
    Estou bem, obrigado.
```

**Quando `result.segments` ausente** (sem diarização):
- Comportamento atual preservado (texto plano com `whitespace-pre-wrap`)

### Formato de download

Quando há segments, o `result.text` já contém o formato:
```
[00:00] João: Olá, como você está?

[00:04] Maria: Estou bem, obrigado.
```
Nenhuma mudança necessária no download — `result.text` é a fonte.

---

## Mudanças no `components/FileQueue.tsx`

Adicionar display do novo status:

```tsx
// Status AWAITING_NAMES
{item.status === ProcessStatus.AWAITING_NAMES && (
  <span className="text-xs text-amber-400 flex items-center gap-1.5">
    <Users className="w-3 h-3" />
    Aguardando identificação dos falantes...
  </span>
)}
```

---

## Mudanças no `App.tsx`

### Novo estado

```typescript
const [diarizationPendingItem, setDiarizationPendingItem] = useState<QueueItem | null>(null);
```

### Loop de processamento revisado (quando diarização ativa)

```
processQueue() → pega próximo item PENDING
  ↓
  Se diarization=true:
    1. transcribeMedia() → apenas UPLOAD (onProgress mostra progresso)
    2. discoverSpeakers(file) → SpeakerDiscoveryResult
    3. Se uniqueSpeakers.length <= 1:
         → pula modal, vai direto para transcrição com 1 speaker
    4. Se uniqueSpeakers.length > 1:
         → salva discoveryResult no QueueItem
         → status = AWAITING_NAMES
         → setDiarizationPendingItem(item)
         → PAUSA a fila (isProcessingRef.current = false)
         → aguarda onConfirm do modal

  handleDiarizationConfirm(names):
    → monta SpeakerProfile[] a partir dos names
    → chama transcribeWithGemini(file, { speakerProfiles })
    → status = COMPLETED, result = finalResult com segments
    → speakerNames salvo no QueueItem
    → RETOMA a fila (processNext())

  Se diarization=false:
    → comportamento atual (transcribeMedia direto)
```

### Handler de confirmação

```typescript
const handleDiarizationConfirm = async (names: Record<string, string>) => {
  if (!diarizationPendingItem) return;

  const discovery = diarizationPendingItem.discoveryResult!;

  // Monta profiles com nomes do usuário (fallback para label genérico)
  const profiles: SpeakerProfile[] = discovery.speakers.map((sp, i) => ({
    id: sp,
    displayName: names[sp]?.trim() || sp,
    color: SPEAKER_COLORS[i % SPEAKER_COLORS.length],
    sampleText: discovery.segments.find(s => s.speaker === sp)?.text?.slice(0, 120) || '',
  }));

  // Transcrição completa com profiles injetados em cada chunk
  const result = await transcribeMedia(file, mode, provider, apiKeys, {
    diarization: true,
    language,
    speakerProfiles: profiles,
    onProgress: (msg) => updateProgress(diarizationPendingItem.id, msg),
  });

  // Finaliza o item
  setQueue(prev => prev.map(item =>
    item.id === diarizationPendingItem.id
      ? { ...item, status: ProcessStatus.COMPLETED, result, speakerNames: names }
      : item
  ));

  setDiarizationPendingItem(null);
  processNext(); // retoma a fila
};
```

### "Editar Nomes" em item já concluído

```typescript
const handleRequestRename = (itemId: string) => {
  const item = queue.find(i => i.id === itemId);
  if (item?.discoveryResult) {
    setDiarizationPendingItem(item); // modal abre pré-preenchido com item.speakerNames
    // Ao confirmar em modo edição: re-executa transcrição OU apenas rebuilda o texto
    // (ver nota abaixo)
  }
};
```

> **Nota sobre "Editar Nomes" pós-conclusão:** Se o item já está COMPLETED, ao confirmar a nomeação não precisamos re-chamar a API — apenas substituímos os IDs pelos novos nomes nos segments já presentes em `result.segments` e reconstruímos o `result.text`. Isso evita uma nova chamada à API.

---

## Ordem de implementação

| Passo | Arquivo | Depende de |
|-------|---------|-----------|
| 1 | `types.ts` | — |
| 2 | `utils/audioSlicer.ts` | — |
| 3 | `services/transcriptionService.ts` | `types.ts` |
| 4 | `components/SpeakerIdentificationModal.tsx` | `types.ts`, `audioSlicer.ts` |
| 5 | `components/TranscriptionView.tsx` | `types.ts` |
| 6 | `components/FileQueue.tsx` | `types.ts` |
| 7 | `App.tsx` | tudo acima |

---

## Casos especiais e tratamentos

| Caso | Tratamento |
|------|-----------|
| 1 único falante detectado | Pula modal; processa diretamente sem labels |
| Usuário clica "Pular" | `onConfirm({})` → mantém "Speaker 1", "Speaker 2" |
| Campo de nome em branco | Usa label genérico como fallback |
| `decodeAudioData` falha (formato raro) | Preview de áudio oculto; modal funciona só com texto |
| Gemini não retorna JSON válido no discovery | Erro descritivo; item vai para status ERROR com mensagem clara |
| Timestamps com drift do Gemini | Margem ±0.5s no audioSlicer compensa imprecisão |
| Arquivo de 1h+ | Chunked transcription com profiles injetados em cada chunk — funciona para qualquer duração |
| Reabrir "Editar Nomes" em item concluído | Modal abre pré-preenchido; ao confirmar, reconstrói texto localmente sem nova chamada à API |

---

## O que NÃO muda

- Upload de arquivo (File API resumível) — intacto
- Chunking de 10min — mantido e continua sendo usado na Fase 3
- Providers OpenAI e HuggingFace — diarização avançada só para Gemini; os outros continuam como estão
- Fila sequencial e sistema de refs — preservado
- UI de FileQueue, FileUpload, AudioRecorder, ContextRecorder — sem alterações

---

*Plano criado em 2026-03-21.*
