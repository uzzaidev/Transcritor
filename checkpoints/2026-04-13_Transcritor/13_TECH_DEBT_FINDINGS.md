# 13 — Dívida Técnica e Riscos

**Checkpoint:** 2026-04-13
**Projeto:** Transcritor (Uzz.Ai — Ferramentas)

---

## P0 — Quick Wins (alta urgência, baixo esforço)

### 1. `requirements.txt` ausente em `ata_multiagent_pipeline/`

**Severidade:** Alta
**Evidência:** `ata_multiagent_pipeline/` não tem `requirements.txt` nem `pyproject.toml`
**Problema:** Impossível instalar o módulo de forma reproduzível; a dependência `openai` (e outras) são instaladas manualmente sem versão fixada.
**Fix:** Criar `ata_multiagent_pipeline/requirements.txt` com todas as dependências e versões pinadas.
**Esforço:** 1h

### 2. Dois SDKs Gemini redundantes no Electron

**Severidade:** Média
**Evidência:** `gemini-whisper/package.json` → `@google/genai ^1.41.0` + `@google/generative-ai ^0.24.1`
**Problema:** `geminiService.ts` usa o SDK legado (`@google/generative-ai`). `transcriptionService.ts` usa o novo (`@google/genai`). Duplicação de bundle e manutenção.
**Fix:** Migrar `geminiService.ts` para o novo SDK ou removê-lo se obsoleto.
**Esforço:** 2h

### 3. `package-lock.json` órfão na raiz do projeto

**Severidade:** Baixa
**Evidência:** `/package-lock.json` presente na raiz sem `package.json` correspondente
**Problema:** Artefato confuso — pode sugerir dependências que não existem.
**Fix:** Deletar o `package-lock.json` da raiz ou investigar sua origem.
**Esforço:** 15min

### 4. Variáveis de ambiente sem validação de presença em `web/`

**Severidade:** Média
**Evidência:** `web/lib/db.ts` → `neon(process.env.DATABASE_URL!)` — uso de `!` (non-null assertion)
**Problema:** Se `DATABASE_URL` estiver ausente, o erro só aparece em runtime, não na inicialização.
**Fix:** Adicionar validação no `lib/db.ts`:
```typescript
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}
```
**Esforço:** 30min

---

## P1 — Medium Wins (urgência média, impacto alto)

### 5. Zero testes automatizados

**Severidade:** Alta
**Evidência:** Nenhum arquivo de teste encontrado em nenhum módulo
**Problema:** Qualquer refatoração ou mudança pode quebrar funcionalidades silenciosamente. Pipeline de e-mail sem testes é arriscado.
**Fix:** Ver `12_TESTS_COVERAGE_MAP.md` para plano detalhado.
**Esforço:** 31h (P0 + P1 de testes)

### 6. `App.tsx` monolítico (1000+ linhas)

**Severidade:** Média
**Evidência:** `gemini-whisper/App.tsx` — componente raiz com todo o estado e lógica
**Problema:** Difícil de manter, testar e entender. State de queue, provider, API keys, defaults tudo junto.
**Fix:** Extrair em hooks customizados:
- `useQueue()` — gerencia QueueItem[]
- `useSettings()` — API keys, provider, localStorage
- `useAtaPipeline()` — integração com Electron IPC
**Esforço:** 8h

### 7. `pipeline_events` sem INSERT implementado

**Severidade:** Alta
**Evidência:** `web/db/schema.ts` tem a tabela, mas nenhum módulo Python popula o banco
**Problema:** Dashboard de observabilidade mostra sempre zero eventos. Feature incompleta.
**Fix:** Adicionar chamada ao Neon no `ata_agent/orchestrator.py` após delivery bem-sucedido.
**Esforço:** 4h (requer adicionar `psycopg2` ou `asyncpg` ao `ata_agent/requirements.txt`)

### 8. Sem retry em falhas SMTP

**Severidade:** Alta
**Evidência:** `ata_agent/email/smtp_dispatcher.py` — sem mecanismo de retry
**Problema:** Se o servidor SMTP estiver temporariamente indisponível, o e-mail é perdido sem possibilidade de reenvio.
**Fix:** Adicionar retry com backoff exponencial (3 tentativas):
```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=30))
def send_ata_email(settings, state):
    ...
```
**Esforço:** 2h

### 9. API Keys em localStorage (Electron)

**Severidade:** Média
**Evidência:** `gemini-whisper/components/SettingsModal.tsx` → `localStorage.setItem()`
**Problema:** API Keys salvas em localStorage do Electron são armazenadas em texto claro em disco (`~/.config/gemini-whisper/Local Storage/`).
**Fix:** Usar `electron-store` com `encryptionKey` ou o keychain nativo do OS via `keytar`.
**Esforço:** 4h

### 10. Auth ausente no web dashboard

**Severidade:** Alta (dependendo do ambiente de deploy)
**Evidência:** `web/app/layout.tsx` — sem middleware de autenticação
**Problema:** Se deployado no Vercel sem restrições, dados de pipeline ficam públicos.
**Fix:** Adicionar middleware NextAuth.js ou Clerk antes do v2 deploy.
**Esforço:** 8h

### 11. Full table scan em `pipeline_events`

**Severidade:** Média
**Evidência:** `web/app/page.tsx` → `db.select().from(pipelineEvents)` sem LIMIT
**Problema:** Com volume crescente de eventos, query fica lenta.
**Fix:**
```typescript
// Adicionar paginação + índices
const events = await db
  .select()
  .from(pipelineEvents)
  .orderBy(desc(pipelineEvents.createdAt))
  .limit(50);
```
E adicionar índice: `idx_pipeline_events_created_at`
**Esforço:** 2h

---

## P2 — Long Term

### 12. Sem CI/CD

**Severidade:** Média
**Evidência:** `.github/` não encontrado
**Problema:** Sem pipeline de CI, não há verificação automática de código.
**Fix:** GitHub Actions com: lint, type check, tests (quando existirem).
**Esforço:** 6h

### 13. `Whisper de voz/` e `web_sales_agent/` são módulos legados

**Severidade:** Baixa
**Evidência:** 119 arquivos `.txt` de transcrições antigas + scripts Python legados
**Problema:** Poluem o repositório com arquivos que não fazem parte do produto.
**Fix:** Mover para branch/repositório separado ou adicionar ao `.gitignore`.
**Esforço:** 1h

### 14. Logging não estruturado

**Severidade:** Média
**Evidência:** `ata_agent/` usa `print()` sem timestamps, níveis ou IDs de correlação
**Problema:** Difícil de agregar/pesquisar logs em produção.
**Fix:** `structlog` ou `logging` com JSON formatter + correlation_id por pipeline run.
**Esforço:** 4h

### 15. Sem tratamento de arquivos de áudio corrompidos

**Severidade:** Média
**Evidência:** `ata_agent/gemini_client.py` — sem validação de arquivo antes do upload
**Problema:** Upload de arquivo corrompido pode causar erros crypticos da API Gemini.
**Fix:** Validar extensão + verificar se o arquivo é legível antes do upload.
**Esforço:** 2h

---

## TODOs/FIXMEs Encontrados no Código

```bash
# Busca executada:
# grep -r "TODO\|FIXME\|HACK\|XXX" . --include="*.py" --include="*.ts" --include="*.tsx"
```

**NÃO ENCONTRADO** nenhum TODO/FIXME explícito no código-fonte.

> Os principais "TODOs" são os itens de roadmap documentados em `PLANO_PIPELINE_MULTIAGENTE.md` (Sprints 3-5).

---

## Arquivos Maiores (Candidatos a Split)

| Arquivo | Tamanho Estimado | Problema |
|---------|-----------------|---------|
| `gemini-whisper/App.tsx` | ~1000 linhas | Monolítico — ver item #6 |
| `gemini-whisper/electron/main.cjs` | ~150 linhas | Aceitável |
| `ata_agent/gemini_client.py` | ~250 linhas | Aceitável |
| `PROCESSO-*.md` (5 arquivos) | 8K-24K cada | Documentação — OK |

---

## Resumo Priorizado

| Prioridade | Item | Esforço |
|-----------|------|---------|
| P0 | `requirements.txt` no multiagent | 1h |
| P0 | Remover SDK Gemini duplicado | 2h |
| P0 | Validar `DATABASE_URL` no boot | 30min |
| P1 | Testes (P0+P1 do plano de testes) | 31h |
| P1 | INSERT em `pipeline_events` | 4h |
| P1 | Retry SMTP | 2h |
| P1 | Paginação + índice no dashboard | 2h |
| P1 | Refatorar `App.tsx` em hooks | 8h |
| P1 | Auth no web dashboard | 8h |
| P2 | GitHub Actions CI | 6h |
| P2 | Logging estruturado | 4h |
| P2 | Arquivar legados | 1h |
| **Total estimado** | | **~70h** |

---

## Perguntas em Aberto

1. **Legados (`Whisper de voz/`):** Esses arquivos de transcrição têm valor histórico ou podem ser deletados do repositório?
2. **ScriptOps segurança:** Scripts externos executados via `scriptops.py` têm alguma validação de conteúdo ou sandboxing?
3. **`PIPELINE_DESTRUCTIVE_GIT_OPS`:** O que exatamente pode ser destruído? É seguro ter essa opção disponível?
