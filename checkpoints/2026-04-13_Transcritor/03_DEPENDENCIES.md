# 03 — Dependências

**Checkpoint:** 2026-04-13
**Projeto:** Transcritor (Uzz.Ai — Ferramentas)

---

## Módulo 1: `ata_agent/` (Python)

**Evidência:** `ata_agent/requirements.txt` + `ata_agent/pyproject.toml`

### Dependências de Runtime

| Pacote | Versão | Propósito |
|--------|--------|-----------|
| `requests` | >=2.31.0 | HTTP calls à Gemini Files API |
| `python-dotenv` | >=1.0.1 | Carregamento do `.env` |

### Dependências de Stdlib (sem instalação)

| Módulo | Uso |
|--------|-----|
| `imaplib` | Conexão IMAP (Gmail) |
| `smtplib` | Envio SMTP (Gmail) |
| `email` | Parse/compose de e-mails MIME |
| `json` | Serialização de estado |
| `pathlib` | Manipulação de paths |
| `threading` | Daemon loop (run-mode daemon) |
| `hashlib` | Fingerprint de mensagens processadas |
| `base64` | Codificação de anexos de áudio |
| `time` | Sleep entre polls |
| `dataclasses` | PipelineState contract |

### Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `python -m ata_agent run-once` | Processa e-mails uma vez e encerra |
| `python -m ata_agent daemon --interval N` | Poll contínuo a cada N segundos |
| `ata-agent run-once` | Atalho via entry point (`pyproject.toml`) |

---

## Módulo 2: `ata_multiagent_pipeline/` (Python)

**Evidência:** `ata_multiagent_pipeline/.env.example` + imports nos arquivos fonte

> ⚠️ **ATENÇÃO — requirements.txt NÃO ENCONTRADO neste módulo**. Dependências inferidas pelo código-fonte.

### Dependências Inferidas (INFERÊNCIA — não confirmado em lockfile)

| Pacote | Evidência | Propósito |
|--------|-----------|-----------|
| `openai` | `agents.py` imports | Chamadas à API OpenAI (gpt-4o-mini) |
| `python-dotenv` | `config.py` | Carregamento do `.env` |
| `smtplib` + `email` | `emailing.py` | Envio de e-mails |
| `subprocess` | `scriptops.py` | Execução de scripts externos |
| `git` (via subprocess) | `gitops.py` | Operações Git |

### Scripts Disponíveis (CLI)

| Comando | Descrição |
|---------|-----------|
| `python -m ata_multiagent_pipeline <event.json>` | Executa pipeline com evento |
| `python -m ata_multiagent_pipeline reprocess-latest` | Reprocessa último evento salvo |
| `python -m ata_multiagent_pipeline cleanup-generated` | Limpa artefatos em `generated/` |

---

## Módulo 3: `gemini-whisper/` (Node.js/Electron)

**Evidência:** `gemini-whisper/package.json`

### Dependências de Runtime

| Pacote | Versão | Propósito |
|--------|--------|-----------|
| `@google/genai` | ^1.41.0 | Gemini 2.5 Flash (novo SDK) |
| `@google/generative-ai` | ^0.24.1 | Gemini SDK legado (geminiService.ts) |
| `react` | ^19.2.4 | UI framework |
| `react-dom` | ^19.2.4 | DOM renderer |
| `lucide-react` | ^0.563.0 | Ícones SVG |
| `electron` | ^34.x | Shell desktop |

### Dependências de Desenvolvimento

| Pacote | Versão | Propósito |
|--------|--------|-----------|
| `vite` | ^6.0.0 | Bundler/dev server |
| `@vitejs/plugin-react` | latest | React Fast Refresh |
| `typescript` | ^5.x | Type checking |
| `electron-builder` | latest | Gerador de instaladores |
| `concurrently` | latest | Rodar Vite + Electron em paralelo |
| `wait-on` | latest | Aguardar porta 5173 antes de abrir Electron |
| `tailwindcss` | ^3.4.x | CSS utilitário |
| `autoprefixer` | latest | PostCSS |
| `postcss` | latest | PostCSS |

### Scripts Disponíveis

| Script | Comando | Descrição |
|--------|---------|-----------|
| `dev` | `vite` | Frontend apenas (browser) |
| `build` | `vite build` | Build frontend |
| `electron:dev` | `concurrently "vite" "wait-on tcp:5173 && electron ."` | Desktop dev |
| `electron:build` | `vite build && electron-builder` | Instalador de produção |

---

## Módulo 4: `web/` (Next.js)

**Evidência:** `web/package.json`

### Dependências de Runtime

| Pacote | Versão | Propósito |
|--------|--------|-----------|
| `next` | ^15.1.6 | Framework web (App Router + Turbopack) |
| `react` | ^19.0.0 | UI framework |
| `react-dom` | ^19.0.0 | DOM renderer |
| `drizzle-orm` | ^0.38.3 | ORM type-safe para PostgreSQL |
| `@neondatabase/serverless` | ^0.10.4 | Adapter Neon HTTP (WebSocket/HTTP) |

### Dependências de Desenvolvimento

| Pacote | Versão | Propósito |
|--------|--------|-----------|
| `drizzle-kit` | latest | CLI migrations (db:generate, db:push) |
| `typescript` | ^5.x | Type checking |
| `tailwindcss` | ^3.4.x | CSS utilitário |
| `postcss` | latest | PostCSS |
| `autoprefixer` | latest | CSS compat |
| `eslint` | latest | Linting |
| `@types/react` | latest | Tipos React |
| `@types/node` | latest | Tipos Node |

### Scripts Disponíveis

| Script | Comando | Descrição |
|--------|---------|-----------|
| `dev` | `next dev --turbopack` | Dev server com Turbopack |
| `build` | `next build` | Build de produção |
| `start` | `next start` | Servidor de produção |
| `db:generate` | `drizzle-kit generate` | Gera migration SQL |
| `db:push` | `drizzle-kit push` | Aplica schema ao banco |
| `lint` | `next lint` | ESLint |

---

## Resumo de Configurações

### Typescript (`web/tsconfig.json` + `gemini-whisper/tsconfig.json`)
- `strict: true` em ambos
- `paths` aliases: NÃO ENCONTRADO em nenhum dos dois
- `moduleResolution`: bundler (web), node16 (gemini-whisper — inferência)

### ESLint (`web/.eslintrc.json`)
- Extends: `next/core-web-vitals`, `next/typescript`
- Configuração mínima — sem regras customizadas

### Tailwind (`web/tailwind.config.ts`)
- Content paths: `./app/**/*.{ts,tsx}`, `./components/**/*.{ts,tsx}`
- Theme estendido com tokens do `web/theme/tokens.ts`
- Sem plugins adicionais

### Drizzle (`web/drizzle.config.ts`)
- Dialect: `postgresql`
- Schema: `./db/schema.ts`
- Migrations dir: não configurado explicitamente (usa padrão `drizzle/`)

---

## Perguntas em Aberto

1. **`ata_multiagent_pipeline/`** — Não há `requirements.txt`. Deveria ter um para instalar `openai` e outras dependências.
2. **`@google/generative-ai` vs `@google/genai`** — Dois SDKs Gemini instalados. O legado (`geminiService.ts`) pode ser removido?
3. **Versão do Electron** — `^34.3.0` — há atualizações de segurança pendentes?
