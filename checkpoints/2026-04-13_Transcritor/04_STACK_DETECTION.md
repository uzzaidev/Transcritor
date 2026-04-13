# 04 — Stack Detection

**Checkpoint:** 2026-04-13
**Projeto:** Transcritor (Uzz.Ai — Ferramentas)

---

## Resultado da Detecção Automática

```yaml
stack_detection:
  tipo_projeto: monorepo_fullstack   # 4 sub-módulos independentes
  linguagem_principal: Python + TypeScript
  framework_principal:
    - Python: sem framework web (stdlib pura: imaplib, smtplib, asyncio)
    - Desktop: Electron 34 + React 19 + Vite 6
    - Web: Next.js 15 (App Router) + Turbopack
  package_manager:
    python: pip (pyproject.toml via hatchling)
    node: npm (package-lock.json raiz + submodules)
  versao_runtime:
    python: ">=3.10"
    node: ">=18" (inferência pelos packages usados)
  database:
    tipo: Neon PostgreSQL (serverless)
    orm: Drizzle ORM 0.38.3
    adaptador: "@neondatabase/serverless 0.10.4"
  build_tool:
    desktop: Vite 6 (vite.config.ts em gemini-whisper/)
    web: Next.js Turbopack (embutido em Next 15)
    python: pyproject.toml (build via pip install -e .)
  test_framework: NÃO ENCONTRADO — ausência total de testes automatizados
  estilo:
    framework: Tailwind CSS 3.4.x (web/ e gemini-whisper/)
    tokens: web/theme/tokens.ts (design system próprio)
  deploy_provavel:
    web: Vercel (next.config.ts sem customização de saída)
    python: Processo local / servidor próprio (daemon)
    desktop: electron-builder (instalador local)
    database: Neon (DATABASE_URL no .env)
```

---

## Módulos Identificados

| Módulo | Pasta | Linguagem | Tipo | Responsabilidade |
|--------|-------|-----------|------|-----------------|
| ATA Agent | `ata_agent/` | Python 3.10+ | Backend/CLI | IMAP → Gemini → SMTP (pipeline simples) |
| ATA Multiagent Pipeline | `ata_multiagent_pipeline/` | Python 3.10+ | Backend/CLI | IMAP → OpenAI Agents → Git → SMTP (pipeline avançado) |
| Gemini Whisper | `gemini-whisper/` | TypeScript + Electron | Desktop App | Transcrição de áudio + geração de ATA (UI) |
| Web Dashboard | `web/` | TypeScript + Next.js | Web App | Dashboard de observabilidade de eventos |
| Legacy Transcripts | `Whisper de voz/` | Python (legado) | Scripts | Scripts de transcrição em lote — LEGADO |
| Web Sales Agent | `web_sales_agent/` | Python | Script | Agente de vendas experimental — LEGADO |

---

## Evidências de Detecção

### Python
- **Evidência:** `ata_agent/pyproject.toml` → `requires-python = ">=3.10"`
- **Evidência:** `ata_agent/requirements.txt` → `requests>=2.31.0, python-dotenv>=1.0.1`
- **Evidência:** `ata_multiagent_pipeline/__init__.py` + imports em `agents.py`, `cli.py`

### Electron/React/Vite
- **Evidência:** `gemini-whisper/package.json` → `"main": "electron/main.cjs"` + `"electron": "^34.3.0"` + `"vite": "^6.0.0"`
- **Evidência:** `gemini-whisper/vite.config.ts` (arquivo presente)

### Next.js 15
- **Evidência:** `web/package.json` → `"next": "^15.1.6"` + `"scripts": { "dev": "next dev --turbopack" }`
- **Evidência:** `web/app/layout.tsx` + `web/app/page.tsx` (App Router)

### Drizzle + Neon
- **Evidência:** `web/db/schema.ts` → `import { pgTable } from "drizzle-orm/pg-core"` + `@neondatabase/serverless`
- **Evidência:** `web/drizzle.config.ts` → `dialect: "postgresql"`
- **Evidência:** `.env.example` → `DATABASE_URL=` (Neon connection string)

### Tailwind CSS
- **Evidência:** `gemini-whisper/vite.config.ts` + `web/tailwind.config.ts` + `web/postcss.config.mjs`

### Gemini API
- **Evidência:** `gemini-whisper/package.json` → `"@google/genai": "^1.41.0"` + `"@google/generative-ai": "^0.24.1"`
- **Evidência:** `.env.example` → `GEMINI_API_KEY=` + `GEMINI_MODEL=gemini-2.5-flash`

### OpenAI (multiagent)
- **Evidência:** `ata_multiagent_pipeline/.env.example` → `OPENAI_API_KEY=` + `PIPELINE_OPENAI_MODEL=gpt-4o-mini`

---

## Perguntas em Aberto

1. **Package manager:** Raiz do projeto tem `package-lock.json` isolado. Qual é o propósito? NÃO ENCONTRADO `package.json` na raiz — pode ser artefato.
2. **Python versão exata:** `pyproject.toml` especifica `>=3.10` mas versão em uso no ambiente de prod não está documentada.
3. **OpenAI SDK:** `ata_multiagent_pipeline/agents.py` usa OpenAI, mas `requirements.txt` do módulo não foi encontrado. Instalado via `pip install openai` global?
