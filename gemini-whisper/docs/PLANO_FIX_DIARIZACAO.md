---
created: 2026-03-21
feature: Fix Diarização — MAX_TOKENS + JSON Parse Failures
status: Plano aprovado — pronto para implementar
arquivo_alvo: services/transcriptionService.ts
---

# PLANO DE CORREÇÃO: Diarização com MAX_TOKENS e JSON Parse Failures

## Diagnóstico a partir dos logs

### O que os logs mostram com clareza

| Chunk | finishReason | responseTextLength | Resultado |
|-------|-------------|-------------------|-----------|
| Discovery | MAX_TOKENS | 20.567 chars | Recovery regex salvou (157 segs, 6 speakers) |
| Chunk 1/5 (0–4min) | STOP | 6.717 chars | Parseou OK |
| Chunk 2/5 (4–8min) | MAX_TOKENS | 37.537 chars | **Parse falhou — JSON incompleto** |

**Chunk 2 gerou 37.537 chars ≈ ~16.000 tokens de JSON.** Com `maxOutputTokens: 16384`, o modelo esgotou o limite no meio de um array de segmentos e o JSON ficou sem fechamento.

---

### Por que o Chunk 2 é 5x maior que o Chunk 1?

Chunk 1 retornou segmentos **sem timestamps** (só `speaker` + `text`, agrupados). O modelo ignorou a instrução de incluir `startTime`/`endTime` e produziu algo compacto.

Chunk 2 retornou segmentos com **timestamps ultra-granulares** (`start`/`end` a cada 5–10 segundos), gerando centenas de objetos JSON para 4 minutos de áudio. O modelo também usou os nomes de campo `start`/`end` em vez dos instruídos `startTime`/`endTime`.

Isso expõe dois problemas simultâneos:
1. **Volume de output JSON é imprevisível** — o modelo pode ser mais ou menos granular a cada chunk
2. **`normalizeSegments` silencia segmentos com `start`/`end`** — campo errado, segmento descartado

---

### Causa-raiz técnica (em uma frase)

> O pipeline de transcrição diarizada pede JSON estruturado com timestamps por utterance, e o Gemini produz output JSON grande demais para caber em `maxOutputTokens`, truncando no meio e quebrando o parse.

---

## As 4 correções (em ordem de impacto)

---

### Correção 1 — CRÍTICA: Abandonar JSON nos chunks de transcrição diarizada

**Arquivo:** `transcriptionService.ts`

**Problema:** pedir JSON com `segments[]` para cada chunk infla o output em 5–10x comparado ao texto puro. Qualquer truncamento por `MAX_TOKENS` quebra o JSON irreparavelmente.

**Solução:** usar **plain text** com formato `NOME: fala` para chunks diarizados.

O modelo retorna algo como:
```
PV: Muito ruído, mas vamos tentar gravar, vamos ver se sai alguma coisa. Às vezes a gente tá conversando, não chegando numa decisão.

EMILEINE: Porque ela vai buscar, vocês não chegaram a conclusão nenhuma, mas o tópico tal foi citado 15 vezes durante a reunião.

LUIS: Exatamente, aquele assunto precisa de atenção.
```

Este formato é **3–5x menor** que o JSON equivalente e **nunca falha no parse** (não é JSON).

#### Mudanças no código

**A. Remover diarização do `expectsStructuredJson`** (linha 716):

```typescript
// ANTES:
const expectsStructuredJson = diarizationEnabled || mode === "translate";

// DEPOIS:
const expectsStructuredJson = mode === "translate";
// Chunks diarizados usam text/plain — não são mais JSON
```

**B. Novo prompt para chunks diarizados** (substituir bloco do promptText, linhas 764–780):

```typescript
const promptText =
  mode === "transcribe"
    ? diarizationEnabled
      ? `
You are a professional speech-to-text AI.
Transcribe the audio exactly as spoken in ${targetLanguage}.
${timePrompt}
Do NOT translate. Capture every word. Do not summarize or skip anything.

KNOWN SPEAKERS — use these exact names, no variations:
${speakerProfiles.map((p: SpeakerProfile) => `- ${p.id} = ${p.displayName}`).join("\n")}

Output format rules (strictly follow):
- One line per speaker turn: NAME: text
- Separate speaker turns with ONE blank line
- Group consecutive speech from the same speaker into ONE block
- Do NOT use JSON, markdown, bullet points, or timestamps
- Do NOT add any explanation or header

Example:
PV: Bom dia a todos. Vamos começar a reunião de hoje com os pontos principais.

EMILEINE: Obrigada. Eu gostaria de apresentar o relatório do trimestre.

PV: Ótimo, pode começar.
      `.trim()
      : `
You are a professional speech-to-text AI.
Transcribe the audio exactly as spoken in ${targetLanguage}.
${timePrompt}
Do NOT translate. Capture every word and do not summarize.
Return ONLY the transcription text. Do NOT use JSON or markdown.
      `.trim()
    : `
Translate the spoken audio directly into English.
${timePrompt}
Return JSON with keys: text, language, summary.
    `.trim();
```

**C. Mudar `responseMimeType` e `maxOutputTokens` para chunks diarizados** (linhas 804–810):

```typescript
generationConfig: {
  temperature: 0.2,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: diarizationEnabled ? 8192 : 8192,
  // Diarizado usa text/plain — sem JSON
  responseMimeType: expectsStructuredJson ? "application/json" : "text/plain",
  thinkingConfig: { thinkingBudget: 0 },
},
```

**D. Nova função: `parseDiarizedPlainText`** (adicionar antes de `transcribeWithGemini`):

```typescript
/**
 * Faz parse do formato plain text "SPEAKER: fala\n\nSPEAKER: fala"
 * retornado pelo Gemini em chunks diarizados.
 * Atribui o timestamp de início do chunk a todos os segmentos (sem granularidade intra-chunk).
 */
const parseDiarizedPlainText = (
  rawText: string,
  chunkStartSec: number,
  chunkEndSec: number,
  speakerMap: Map<string, string>
): SpeakerSegment[] => {
  const text = stripMarkdownJsonFences(rawText).trim();
  if (!text) return [];

  // Divide por linha em branco ou por newline simples
  const blocks = text
    .split(/\n{2,}/)
    .flatMap((block) => block.split(/\n/))
    .map((line) => line.trim())
    .filter(Boolean);

  const segments: SpeakerSegment[] = [];
  let currentSpeaker = "";
  let currentLines: string[] = [];

  const flush = () => {
    if (!currentSpeaker || currentLines.length === 0) return;
    const joined = currentLines.join(" ").trim();
    if (joined) {
      segments.push({
        speaker: currentSpeaker,
        startTime: chunkStartSec,
        endTime: chunkEndSec,
        text: joined,
      });
    }
    currentLines = [];
  };

  for (const line of blocks) {
    // Tenta detectar "NOME: fala" — o separador é o primeiro ":"
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0 && colonIdx < 40) {
      const candidateSpeaker = speakerMap.get(line.slice(0, colonIdx).trim())
        || line.slice(0, colonIdx).trim();
      const candidateText = line.slice(colonIdx + 1).trim();

      // Verifica se o candidato é um falante conhecido (ou parece um nome)
      const isKnownSpeaker = speakerMap.has(line.slice(0, colonIdx).trim())
        || Array.from(speakerMap.values()).includes(candidateSpeaker);

      if (isKnownSpeaker && candidateText) {
        if (candidateSpeaker !== currentSpeaker) {
          flush();
          currentSpeaker = candidateSpeaker;
        }
        currentLines.push(candidateText);
        continue;
      }
    }

    // Linha sem speaker reconhecido: acrescenta ao bloco atual
    if (currentSpeaker) {
      currentLines.push(line);
    }
  }

  flush();
  return segments;
};
```

**E. Substituir o bloco de extração de segmentos** (linhas 877–887) para usar o novo parser:

```typescript
if (diarizationEnabled) {
  // Usa parser de plain text em vez de normalizeSegments
  const chunkSegments = parseDiarizedPlainText(
    responseText,   // plain text direto do modelo
    startSec,
    endSec,
    speakerMap
  );
  aggregatedSegments.push(...chunkSegments);

  // fullText: linha por falante para cópia/download
  if (chunkSegments.length > 0) {
    const chunkTextFromSegments = chunkSegments
      .map((s) => `${s.speaker}: ${s.text}`)
      .join("\n\n");
    fullText += `${fullText ? "\n\n" : ""}${chunkTextFromSegments}`;
  }
}
```

**F. Remover o bloco `if (expectsStructuredJson)` para o parse JSON do chunk** quando diarizado:

```typescript
// Antes do bloco de parse, separar caminho diarizado do caminho JSON:
if (diarizationEnabled) {
  // Já processado acima no parseDiarizedPlainText — apenas captura language
  if (index === 0) {
    finalLanguage = targetLanguage;
  }
} else if (expectsStructuredJson) {
  // translate mode — JSON parse normal
  try {
    json = parseJsonFromModelText(responseText, chunkContext);
    chunkText = typeof json?.text === "string" ? json.text.trim() : "";
  } catch (error) {
    chunkText = coerceTextFromResponse(responseText);
  }
  if (chunkText) fullText += `${fullText ? "\n\n" : ""}${chunkText}`;
  if (index === 0) {
    finalLanguage = typeof json?.language === "string" ? json.language : "";
    finalSummary = typeof json?.summary === "string" ? json.summary : "";
  }
} else {
  // transcribe sem diarização — plain text direto
  chunkText = coerceTextFromResponse(responseText);
  if (chunkText) fullText += `${fullText ? "\n\n" : ""}${chunkText}`;
  if (index === 0) finalLanguage = targetLanguage;
}
```

---

### Correção 2 — ALTA: `normalizeSegments` aceitar `start`/`end` além de `startTime`/`endTime`

**Arquivo:** `transcriptionService.ts`, linhas 312–313

O Gemini às vezes retorna `start`/`end` ao invés de `startTime`/`endTime`. Os segmentos são descartados silenciosamente.

```typescript
// ANTES (linha 312–313):
const start = normalizeNumber(segment?.startTime);
const end = normalizeNumber(segment?.endTime);

// DEPOIS:
const start = normalizeNumber(segment?.startTime ?? segment?.start);
const end = normalizeNumber(segment?.endTime ?? segment?.end);
```

Essa fix também beneficia o discovery pass — segmentos com campos alternativos deixam de ser descartados.

---

### Correção 3 — ALTA: Auto-retry com sub-chunk quando MAX_TOKENS

**Arquivo:** `transcriptionService.ts` — dentro do loop `for (let index ...)` em `transcribeWithGemini`

Quando um chunk retorna `MAX_TOKENS`, automaticamente dividir ao meio e reprocessar.

**Implementação:**

Extrair a lógica de request de um chunk para função auxiliar `fetchChunk(startSec, endSec)` e criar `fetchChunkWithRetry(startSec, endSec, depth)`:

```typescript
const fetchChunkWithRetry = async (
  startSec: number,
  endSec: number,
  depth = 0
): Promise<{ responseText: string; finishReason: string }> => {
  const result = await fetchChunk(startSec, endSec);

  if (result.finishReason === "MAX_TOKENS" && depth < 2 && (endSec - startSec) >= 60) {
    const mid = Math.round((startSec + endSec) / 2);
    options.onProgress?.(
      `Chunk MAX_TOKENS — dividindo ${formatTimestamp(startSec)}–${formatTimestamp(endSec)} em sub-chunks...`
    );
    logGeminiDebug("fetchChunkWithRetry - splitting chunk", { startSec, endSec, mid, depth });

    const [r1, r2] = await Promise.all([
      fetchChunkWithRetry(startSec, mid, depth + 1),
      fetchChunkWithRetry(mid, endSec, depth + 1),
    ]);

    return {
      responseText: `${r1.responseText}\n\n${r2.responseText}`,
      finishReason: "STOP", // sub-chunks bem-sucedidos
    };
  }

  return result;
};
```

Processar sub-chunks em **paralelo** (ambos já estão no arquivo que o Gemini tem em memória — sem re-upload necessário).

> **Nota:** o arquivo já foi uploadado uma vez para o Gemini (`fileUri`). Sub-chunks do mesmo arquivo reutilizam o mesmo `fileUri` — não há custo extra de upload.

---

### Correção 4 — MÉDIA: Limitar segmentos do recovery do Discovery

**Arquivo:** `transcriptionService.ts`, função `recoverDiscoveryFromRawText`

O recovery atualmente pode retornar 157 segmentos (como no log). Para o modal de nomeação, precisamos apenas de **1–2 segmentos por speaker** (amostras para preview de áudio).

Adicionar filtragem no retorno da função `discoverSpeakers` após o recovery:

```typescript
// Após recovery bem-sucedido (linha 690):
if (recovered) {
  // Filtrar: max 2 segmentos por speaker (para preview no modal)
  const filteredSegments = filterTopSegmentsPerSpeaker(recovered.segments, 2);

  return {
    ...recovered,
    segments: filteredSegments,
  };
}
```

Nova função helper:

```typescript
const filterTopSegmentsPerSpeaker = (
  segments: SpeakerSegment[],
  maxPerSpeaker: number
): SpeakerSegment[] => {
  const countMap = new Map<string, number>();
  return segments.filter((seg) => {
    const count = countMap.get(seg.speaker) || 0;
    if (count >= maxPerSpeaker) return false;
    countMap.set(seg.speaker, count + 1);
    return true;
  });
};
```

---

## Resumo das mudanças por arquivo

### `services/transcriptionService.ts`

| # | Onde | O que muda |
|---|------|-----------|
| C1-A | linha 716 | Remove `diarizationEnabled` de `expectsStructuredJson` |
| C1-B | linhas 764–780 | Prompt de chunk diarizado → plain text `NOME: fala` |
| C1-C | linhas 804–810 | `responseMimeType: "text/plain"` para chunks diarizados |
| C1-D | nova função | `parseDiarizedPlainText()` para parse do plain text |
| C1-E | linhas 877–887 | Usa `parseDiarizedPlainText` em vez de `normalizeSegments` |
| C1-F | linhas 848–886 | Separar caminhos: diarizado / translate / plain transcribe |
| C2 | linhas 312–313 | `normalizeSegments`: aceita `start`/`end` além de `startTime`/`endTime` |
| C3 | loop do chunk | Extrair `fetchChunk` + `fetchChunkWithRetry` com split automático |
| C4 | linha 690 | Filtrar recovery: max 2 segmentos por speaker |

---

## O que NÃO muda

- Upload do arquivo (File API resumível) — idêntico
- Discovery pass e recovery regex — mantidos (com Correção 4 de filtragem)
- `normalizeSegments` — mantida para discovery (com Correção 2)
- Chunks sem diarização — caminho inalterado
- OpenAI e HuggingFace providers — não afetados
- Modal de identificação de falantes — não afetado
- `TranscriptionView` — não afetado
- `App.tsx` — não afetado

---

## Impacto esperado após as correções

| Situação atual | Situação após fix |
|---------------|------------------|
| Chunk 2: 37.537 chars de JSON → MAX_TOKENS → parse falha | Chunk 2: ~8.000–12.000 chars de plain text → STOP → parse trivial |
| JSON com `start`/`end` descarta segmentos silenciosamente | `start`/`end` aceitos como alias de `startTime`/`endTime` |
| Chunk com MAX_TOKENS → erro fatal, interrompe tudo | MAX_TOKENS → auto-split em sub-chunks → continua |
| Recovery retorna 157 segmentos (memória desnecessária) | Recovery retorna max 12 segmentos (2 por speaker × 6) |

---

## Ordem de implementação sugerida

1. **C2** — `normalizeSegments` (2 linhas, zero risco) — testar que segmentos com `start`/`end` passam
2. **C4** — filtrar recovery (1 função nova + 3 linhas) — testar no arquivo de exemplo
3. **C1** — mudar formato do chunk diarizado (maior mudança — fazer por partes):
   - C1-A e C1-C primeiro (mudar `expectsStructuredJson` e `responseMimeType`)
   - C1-D (nova função `parseDiarizedPlainText`)
   - C1-B (novo prompt)
   - C1-E e C1-F (novo fluxo de parse)
4. **C3** — auto-retry de sub-chunk (extrair função + retry logic)

---

*Plano criado em 2026-03-21 com base na análise dos logs de execução real.*
