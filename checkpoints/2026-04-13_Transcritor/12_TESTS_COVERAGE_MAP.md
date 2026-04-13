# 12 — Mapa de Cobertura de Testes

**Checkpoint:** 2026-04-13
**Projeto:** Transcritor (Uzz.Ai — Ferramentas)

---

## Resumo Executivo

| Módulo | Framework | Testes Unit | Testes Integração | Testes E2E | Cobertura |
|--------|-----------|-------------|-------------------|-----------|-----------|
| `ata_agent/` | Nenhum | ❌ 0 | ❌ 0 | ❌ 0 | **0%** |
| `ata_multiagent_pipeline/` | Nenhum | ❌ 0 | ❌ 0 | ❌ 0 | **0%** |
| `gemini-whisper/` (React) | Nenhum | ❌ 0 | ❌ 0 | ❌ 0 | **0%** |
| `web/` (Next.js) | Nenhum | ❌ 0 | ❌ 0 | ❌ 0 | **0%** |
| **TOTAL** | — | **0** | **0** | **0** | **0%** |

> ⚠️ **O projeto não possui NENHUM teste automatizado.**

---

## A. Testes Existentes

### Scripts de Teste Manual (`gemini-whisper/scripts/`)

**Evidência:** `gemini-whisper/scripts/testGen.js`, `testGenAlpha.js`, `listModels.js`

- **Tipo:** Scripts Node.js avulsos para chamadas manuais à API Gemini
- **Não são testes automatizados** — sem assertions, sem framework
- **Propósito:** Desenvolvimento/debug da integração Gemini

### `web_sales_agent/test.py`

**Evidência:** `web_sales_agent/test.py`

- **Módulo:** LEGADO (`web_sales_agent/` é experimental)
- **Tipo:** Script Python manual, sem pytest fixtures ou assertions formais

---

## B. Gaps de Cobertura por Módulo

### `ata_agent/` — Gaps Críticos

| Componente | Função | Risco sem Teste |
|-----------|--------|----------------|
| `orchestrator.py` | `run_once()` | Pipeline principal sem teste — bugs silenciosos |
| `orchestrator.py` | `validate_ata()` | Lógica de validação (min 120 chars, "decis"/"topic") |
| `gemini_client.py` | `parse_structured_extractions()` | JSON parsing pode falhar com respostas inesperadas |
| `gemini_client.py` | `build_ata_markdown()` | Geração de ATA com template |
| `store.py` | `is_processed()` / `mark_processed()` | Anti-duplicidade pode ter bugs de concorrência |
| `email/imap_listener.py` | `fetch_audio_jobs()` | Extração de anexos pode falhar com e-mails edge cases |
| `email/smtp_dispatcher.py` | `send_ata_email()` | Formatação de e-mail |

### `ata_multiagent_pipeline/` — Gaps Críticos

| Componente | Função | Risco sem Teste |
|-----------|--------|----------------|
| `agents.py` | `AtaAgent.generate()` | Geração de ATA |
| `agents.py` | `ExtractorAgent.extract()` | Extração JSON estruturado |
| `contracts.py` | Serialização/deserialização | Contratos de dados |
| `preflight.py` | `check_all()` | Verificações de pré-condição |
| `orchestrator.py` | Pipeline completo | Fluxo end-to-end |

### `gemini-whisper/` — Gaps Críticos

| Componente | Função | Risco sem Teste |
|-----------|--------|----------------|
| `services/transcriptionService.ts` | `transcribeWithGemini()` | Lógica de transcrição |
| `services/ataPipelineService.ts` | `runPipeline()` | IPC para Python |
| `utils/audioSlicer.ts` | Chunking de áudio | Bugs de segmentação |
| `utils/costCalculator.ts` | Cálculo de custo | Erros de cálculo de preço |
| `components/AtaGenerationModal.tsx` | Validação de formulário | UX crítica |

### `web/` — Gaps

| Componente | Função | Risco sem Teste |
|-----------|--------|----------------|
| `app/page.tsx` | Renderização do dashboard | Regressões de UI |
| `lib/db.ts` | Conexão ao Neon | Falhas de conexão |
| `db/schema.ts` | Schema correto | Mudanças acidentais |

---

## C. Configuração Necessária por Módulo

### Para `ata_agent/` (pytest)

```bash
pip install pytest pytest-cov pytest-mock

# Criar estrutura:
# ata_agent/tests/
# ata_agent/tests/__init__.py
# ata_agent/tests/test_orchestrator.py
# ata_agent/tests/test_gemini_client.py
# ata_agent/tests/test_store.py
# ata_agent/tests/test_imap_listener.py

pytest ata_agent/tests/ -v --cov=ata_agent --cov-report=html
```

### Para `gemini-whisper/` (Vitest)

```bash
cd gemini-whisper
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom

# Adicionar ao package.json:
# "test": "vitest"

npm test
```

### Para `web/` (Vitest + Next.js)

```bash
cd web
npm install -D vitest @testing-library/react @testing-library/jest-dom

npm test
```

---

## D. Testes Prioritários para Implementar

### P0 — Crítico (bloqueiam confiança no pipeline)

1. **`validate_ata(text)`** — unit test puro, sem mocks necessários
   ```python
   def test_validate_ata_min_length():
       assert validate_ata("x" * 119) == False
       assert validate_ata("x" * 119 + " decisão") == True
   
   def test_validate_ata_requires_keyword():
       assert validate_ata("x" * 120) == False
       assert validate_ata("x" * 120 + " decisão") == True
       assert validate_ata("x" * 120 + " topico") == True
   ```

2. **`store.py` — anti-duplicidade**
   ```python
   def test_mark_and_check_processed(tmp_path):
       store = Store(cache_dir=tmp_path)
       assert store.is_processed("msg123") == False
       store.mark_processed("msg123")
       assert store.is_processed("msg123") == True
   ```

3. **`parse_structured_extractions()`** — mock Gemini, verificar parsing JSON

### P1 — Importante

4. **`build_ata_markdown()`** — verificar geração com e sem template
5. **`AtaGenerationModal` form validation** — campos obrigatórios
6. **`costCalculator.ts`** — cálculo de custo com valores conhecidos

### P2 — Nice to have

7. **Pipeline e2e com mock Gmail** — simular e-mail recebido
8. **Snapshot tests dos componentes React** — regressões de UI

---

## E. Estimativa de Esforço

| Tarefa | Estimativa |
|--------|-----------|
| Setup pytest + fixtures básicas (`ata_agent/`) | 4h |
| Testes das funções puras (validate, store, costCalc) | 6h |
| Testes com mocks (gemini_client, smtp, imap) | 10h |
| Setup Vitest (`gemini-whisper/`) | 3h |
| Testes de componentes React críticos | 8h |
| **Total P0 + P1** | **~31h** |

---

## Perguntas em Aberto

1. **Mock da Gemini API:** Como mockar chamadas HTTP para `generativelanguage.googleapis.com` nos testes? `responses` lib ou `unittest.mock`?
2. **Testes de integração IMAP:** Há uma caixa de e-mail de teste configurável?
3. **CI/CD:** Sem GitHub Actions ou similar. Os testes rodarão em CI quando implementados?
