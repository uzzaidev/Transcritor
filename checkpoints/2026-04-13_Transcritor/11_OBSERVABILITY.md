# 11 — Observabilidade e Operação

**Checkpoint:** 2026-04-13
**Projeto:** Transcritor (Uzz.Ai — Ferramentas)

---

## Resumo

| Área | Status | Detalhe |
|------|--------|---------|
| Logging | ⚠️ Parcial | stdout/stderr apenas; sem log estruturado |
| Error Tracking | ❌ Ausente | Sem Sentry, Rollbar ou similar |
| APM/Metrics | ❌ Ausente | Sem Datadog, New Relic, Prometheus |
| Health Checks | ❌ Ausente | Sem endpoint `/health` |
| Alertas | ❌ Ausente | Falhas silenciosas (sem notificação) |
| Dashboard | ⚠️ Mínimo | `web/` exibe apenas contagem total de eventos |

---

## A. Logging

### `ata_agent/` (Python)

**Evidência:** `ata_agent/ata_agent/orchestrator.py`

- **Método:** `print()` statements para stdout
- **Formato:** Texto livre, sem timestamps, sem níveis (INFO/ERROR/DEBUG)
- **Destino:** stdout → terminal / systemd journal (se rodando como serviço)
- **Persistência:** Nenhuma (sem arquivo de log)

**Exemplo típico:**
```
[ata_agent] Processando mensagem: <uid@gmail.com>
[ata_agent] Transcrevendo áudio: reuniao_sprint.mp3
[ata_agent] ATA gerada (1240 chars)
[ata_agent] E-mail enviado para: destino@empresa.com
```

### `ata_multiagent_pipeline/` (Python)

**Evidência:** `ata_multiagent_pipeline/logging_utils.py` (arquivo presente)

- **Método:** Utilitário próprio — presença de `logging_utils.py` sugere uso de `logging` stdlib
- **Destino:** `generated/ata_pipeline/logs/` (arquivos por execução)
- **Formato:** Mais estruturado que o `ata_agent/`, mas sem schema fixo confirmado

### `gemini-whisper/` (Electron/React)

- **Método:** `console.log`, `console.error`
- **Destino:** DevTools do Electron (janela de debug)
- **Persistência:** Nenhuma

### `web/` (Next.js)

- **Método:** Next.js default logging (erros de build/runtime)
- **Destino:** Vercel Logs (se deployado no Vercel)
- **Persistência:** Via Vercel (30 dias no plano free)

---

## B. Error Handling

### `ata_agent/`

**Evidência:** `ata_agent/ata_agent/orchestrator.py`

```python
try:
    process_job(job, settings, client)
except Exception as e:
    print(f"[ERROR] Falha ao processar job {job.message_id}: {e}")
    # Pipeline continua para o próximo job
```

- **Comportamento:** Erros por job são capturados e logados, mas não relançados
- **Falhas de SMTP:** Sem retry — o e-mail é perdido
- **Falhas de Gemini:** Sem retry — o job é marcado como falha

### `ata_multiagent_pipeline/`

- `ValidationResult` com score de qualidade (threshold: `PIPELINE_MIN_VALIDATION_SCORE=80`)
- `DeliveryResult` com campo `success` e `error`
- `PipelineResult` agrega resultados de todas as etapas

### `gemini-whisper/` (React)

- `ProcessStatus.ERROR` para items com falha na fila
- Botão de retry na UI (via `onRetry` prop do `FileQueue`)
- **Sem Error Boundaries React** — erros não capturados podem quebrar a UI inteira

---

## C. Métricas e APM

**NÃO ENCONTRADO** nenhum sistema de métricas ou APM.

- Sem Prometheus endpoints
- Sem Datadog agent
- Sem New Relic
- Sem OpenTelemetry

---

## D. Error Tracking (Sentry, etc.)

**NÃO ENCONTRADO** nenhum SDK de error tracking.

Erros de produção no `ata_agent/` são silenciosos (apenas stdout).

---

## E. Dashboard de Observabilidade (`web/`)

**Evidência:** `web/app/page.tsx`

**Estado atual:**
- Exibe apenas o total de registros em `pipeline_events`
- Um único número na tela
- Sem filtros, sem detalhes por evento, sem gráficos, sem status de saúde

**Dados disponíveis no schema:**
- `event_type` — tipo do evento
- `success` — boolean de sucesso
- `created_at` — timestamp
- `payload` — dados completos (JSONB)

**O que poderia exibir (não implementado):**
- Taxa de sucesso
- Volume por dia/semana
- Lista de eventos recentes com detalhes
- Tempo médio de processamento
- Erros recentes

---

## F. Health Checks

**NÃO ENCONTRADO** nenhum endpoint de health check.

| Componente | Health Check |
|-----------|-------------|
| `web/` Next.js | Nenhum (`/health` não existe) |
| `ata_agent/` | Nenhum (CLI, não servidor) |
| Neon PostgreSQL | Não verificado na inicialização |
| Gmail IMAP | Não verificado antes do processamento |

---

## G. Alertas

**NÃO ENCONTRADO** nenhum sistema de alertas.

- Sem alerta de falha de pipeline
- Sem alerta de quota Gemini esgotada
- Sem alerta de falha de e-mail
- Sem alerta de erro de conexão ao banco

---

## H. Tempo de Execução por Etapa

Estimativas baseadas no fluxo identificado (não medidas reais):

| Etapa | Tempo Estimado | Gargalo |
|-------|---------------|---------|
| IMAP fetch | 1-3s | Latência de rede |
| Gemini upload (áudio) | 5-30s | Depende do tamanho |
| wait_file_active | 5-60s | Processamento Gemini |
| generateContent (x4) | 10-40s | Latência Gemini |
| SMTP send | 1-5s | Latência de rede |
| **Total por reunião** | **~30-140s** | — |

---

## I. Recomendações de Observabilidade (Priorizado)

### P0 — Crítico
1. **Sentry** no `ata_agent/` — capturar exceptions com stack trace
   ```python
   import sentry_sdk
   sentry_sdk.init(dsn="...", traces_sample_rate=0.1)
   ```

### P1 — Importante
2. **Logging estruturado** no `ata_agent/` com `structlog` ou `logging` stdlib + JSON formatter
3. **Health endpoint** no `web/`: `GET /api/health` retornando `{ db: ok, timestamp }`)
4. **Dashboard melhorado**: tabela de eventos recentes com status, tipo, timestamp

### P2 — Nice to have
5. **Métricas de volume**: gráfico de ATAs geradas por semana no dashboard
6. **Alertas por e-mail** quando pipeline falha (irônico: usar SMTP para alertar falha de SMTP)

---

## Perguntas em Aberto

1. **Logs do daemon:** Em produção (rodando como serviço systemd), os `print()` são capturados pelo journald?
2. **Quota Gemini:** Há algum mecanismo para detectar quota esgotada e parar o daemon?
3. **`pipeline_events` sem INSERT:** Se o banco não está sendo populado, o dashboard é apenas um placeholder?
