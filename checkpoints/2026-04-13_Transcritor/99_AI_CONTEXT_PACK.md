# 99 — AI Context Pack

**Versão:** 1.0
**Checkpoint:** 2026-04-13
**Commit:** `8fecf62d6322f011ccecdcdbf49042503f56fa4e`
**Branch:** `main`

> Este arquivo é o ponto de entrada para qualquer IA ou desenvolvedor que precise trabalhar neste projeto. Leia este arquivo primeiro.

---

## O QUE É ESTE PROJETO

O **Transcritor** é uma ferramenta da Uzz.Ai para automatizar o ciclo completo de reuniões:

**Áudio de reunião → Transcrição → ATA estruturada → Envio por e-mail**

O projeto tem 4 módulos ativos:

| # | Módulo | Linguagem | O que faz |
|---|--------|-----------|-----------|
| 1 | `ata_agent/` | Python | Monitora Gmail (IMAP), transcreve com Gemini, gera ATA, envia por SMTP |
| 2 | `ata_multiagent_pipeline/` | Python | Versão avançada com OpenAI Agents, validação com score, Git integration |
| 3 | `gemini-whisper/` | TypeScript + Electron | App desktop para upload manual/gravação + geração de ATA via UI |
| 4 | `web/` | TypeScript + Next.js | Dashboard de observabilidade (muito inicial — v1) |

---

## FLUXO PRINCIPAL (ata_agent)

```
E-mail recebido com assunto "[TRANSCRICAO]" e anexo de áudio
  → IMAP fetch (Gmail)
  → Upload para Gemini Files API
  → Transcrição (Gemini 2.5 Flash)
  → Extração JSON (decisões, ações, kaizens, riscos)
  → Geração de ATA em Markdown
  → Resumo executivo
  → Validação (≥ 120 chars + contém "decis" ou "topic")
  → Envio por e-mail (SMTP, Gmail) para ATA_RECIPIENTS
  → Marcar e-mail como lido
```

---

## FLUXO ALTERNATIVO (gemini-whisper + ata_multiagent_pipeline)

```
Usuário abre o app Electron
  → Upload de arquivo de áudio / gravação ao vivo
  → Transcrição (Gemini 2.5 Flash via inlineData OU OpenAI Whisper)
  → Diarização opcional (identificação de speakers)
  → Usuário preenche: projeto, sprint, participantes, destinatários
  → Clica "Gerar ATA"
  → Electron IPC → spawn Python ata_multiagent_pipeline
  → OpenAI extrai estrutura + gera ATA
  → SMTP envia para destinatários
  → Artefatos salvos em generated/ata_pipeline/
```

---

## STACK RESUMIDA

```
ata_agent/       → Python 3.10+ | requests, python-dotenv | stdlib: imaplib, smtplib
multiagent/      → Python 3.10+ | openai, python-dotenv (requirements.txt AUSENTE)
gemini-whisper/  → TypeScript | React 19 | Electron 34 | Vite 6 | @google/genai
web/             → TypeScript | Next.js 15 | Drizzle ORM | Neon PostgreSQL | Tailwind 3
```

---

## CONFIGURAÇÃO EM 5 MINUTOS

```bash
# 1. Copiar e preencher .env
cp .env.example .env
# Preencher: GEMINI_API_KEY, IMAP_USER/PASSWORD, SMTP_USER/PASSWORD, ATA_RECIPIENTS

# 2. Rodar o pipeline de e-mail
cd ata_agent
pip install -r requirements.txt
python -m ata_agent run-once

# 3. Rodar o app desktop
cd gemini-whisper
npm install
npm run electron:dev

# 4. Rodar o dashboard web
cd web
cp .env.example .env.local   # Adicionar DATABASE_URL do Neon
npm install
npm run db:push               # Criar tabela pipeline_events
npm run dev                   # http://localhost:3000
```

---

## ARQUIVOS MAIS IMPORTANTES

| Arquivo | Por que é importante |
|---------|---------------------|
| `ata_agent/ata_agent/orchestrator.py` | Lógica central do pipeline principal |
| `ata_agent/ata_agent/gemini_client.py` | Toda a interação com a Gemini API |
| `ata_agent/ata_agent/config.py` | Como as configurações são carregadas |
| `ata_agent/ata_agent/contracts.py` | Contrato de dados `PipelineState` |
| `ata_multiagent_pipeline/agents.py` | `AtaAgent` e `ExtractorAgent` OpenAI |
| `ata_multiagent_pipeline/contracts.py` | Contratos ricos (Decision, ActionItem, etc.) |
| `gemini-whisper/App.tsx` | Estado global + orquestração do Electron app |
| `gemini-whisper/services/transcriptionService.ts` | Transcrição via Gemini/OpenAI |
| `gemini-whisper/electron/main.cjs` | IPC handlers + spawn Python |
| `web/db/schema.ts` | Schema do banco (tabela `pipeline_events`) |
| `.env.example` | Todas as variáveis de configuração |

---

## VARIÁVEIS DE AMBIENTE OBRIGATÓRIAS

```env
# IA
GEMINI_API_KEY=          # Para ata_agent/ e gemini-whisper/
OPENAI_API_KEY=          # Apenas para ata_multiagent_pipeline/

# Gmail (IMAP)
IMAP_USER=               # Conta Gmail que recebe os áudios
IMAP_PASSWORD=           # App Password (não a senha normal!)
EMAIL_SUBJECT_TRIGGER=   # Default: [TRANSCRICAO]

# Gmail (SMTP)
SMTP_USER=               # Pode ser a mesma conta
SMTP_PASSWORD=           # App Password
ATA_FROM_EMAIL=          # Remetente visível
ATA_RECIPIENTS=          # Lista separada por vírgula

# Neon (apenas web/)
DATABASE_URL=            # postgresql://user:pass@host.neon.tech/db
```

---

## O QUE ESTÁ FUNCIONANDO

- Pipeline `ata_agent/` completo (IMAP → Gemini → SMTP)
- App Electron com upload de arquivos e transcrição
- App Electron com geração de ATA via pipeline Python
- Identificação de speakers (diarização) via Gemini prompt
- Template de ATA configurável via `ATA_TEMPLATE_PATH`
- Dashboard Next.js (minimal — mostra apenas total de eventos)

---

## O QUE NÃO ESTÁ FUNCIONANDO / INCOMPLETO

| Item | Status | Detalhe |
|------|--------|---------|
| `pipeline_events` INSERT | ❌ Não implementado | Nenhum Python popula o banco Neon |
| Auth no dashboard | ❌ Não implementado | `web/` é público |
| Retry SMTP | ❌ Não implementado | Falhas de e-mail são perdidas |
| Testes automatizados | ❌ Zero testes | Ver `12_TESTS_COVERAGE_MAP.md` |
| `requirements.txt` multiagent | ❌ Ausente | Instalar `openai` manualmente |
| Git integration (gitops) | ⚠️ Implementado | `PIPELINE_GIT_ENABLED=0` (desabilitado) |
| Script ops | ⚠️ Implementado | `PIPELINE_SCRIPTOPS_ENABLED=0` (desabilitado) |
| Gravação ao vivo (ContextRecorder) | ⚠️ Parcial | Componente presente mas integração incompleta |

---

## DECISÕES DE ARQUITETURA (FECHADAS)

**Do `PLANO_AGENTE_ATAS.md`:**
1. **100% Python para o pipeline de e-mail** — sem dependência de Node.js no servidor
2. **Gemini Files API** (não Whisper local) para transcrição no `ata_agent/`
3. **Gmail App Password** (não OAuth2) para IMAP/SMTP — mais simples para uso interno
4. **Neon PostgreSQL** + Drizzle ORM para o dashboard web
5. **Next.js 15 App Router** para o dashboard (sem Pages Router)
6. **Electron** para desktop (não Tauri, não web app) — permite acesso ao filesystem e Python

---

## ROADMAP ATIVO (Sprints pendentes)

**Extraído de `PLANO_PIPELINE_MULTIAGENTE.md`:**

| Sprint | Status | Objetivo |
|--------|--------|----------|
| Sprint 1 | ✅ Concluído | Pipeline base (IMAP → Gemini → SMTP) |
| Sprint 2 | ✅ Concluído | Multi-agent com OpenAI + contratos |
| Sprint 3 | 🔄 Pendente | Validator com score + vault rules |
| Sprint 4 | 🔄 Pendente | Anti-duplicidade via Neon + job IDs |
| Sprint 5 | 🔄 Pendente | Git integration completa + ScriptOps |

---

## PONTOS DE ATENÇÃO PARA NOVA IA/DEV

### 1. O banco Neon não está sendo populado
`web/app/page.tsx` lê `pipeline_events`, mas nenhum código Python faz INSERT. O dashboard mostrará zero eventos até isso ser implementado.

### 2. O trigger do pipeline é o assunto do e-mail
Qualquer pessoa que mande e-mail para `IMAP_USER` com `[TRANSCRICAO]` no assunto vai disparar o pipeline. Não há autenticação do remetente.

### 3. `ata_agent/` e `ata_multiagent_pipeline/` são independentes
São dois pipelines separados. O `ata_agent/` usa Gemini. O `multiagent/` usa OpenAI. O Electron pode chamar apenas o `multiagent/` via IPC.

### 4. O Electron resolve o Python automaticamente
`electron/main.cjs` procura o Python em: `venv/bin/python`, `venv/Scripts/python`, `python3`, `python`. Funciona desde que o Python esteja no PATH ou em um venv na pasta do workspace.

### 5. Templates de ATA são arquivos Markdown
`Template de atas/` tem 12 templates para diferentes tipos de reunião. Configurado via `ATA_TEMPLATE_PATH` no `.env`. Template padrão está em `ata_agent/ata_agent/prompts/template_default.md`.

---

## LINKS DOS DOCUMENTOS COMPLETOS

| Arquivo | Conteúdo |
|---------|---------|
| [01_REPO_TREE.txt](01_REPO_TREE.txt) | Árvore de diretórios completa |
| [02_BUILD_RUNBOOK.md](02_BUILD_RUNBOOK.md) | Como instalar e rodar cada módulo |
| [03_DEPENDENCIES.md](03_DEPENDENCIES.md) | Todas as dependências por módulo |
| [04_STACK_DETECTION.md](04_STACK_DETECTION.md) | Stack detectada com evidências |
| [05_ROUTES_FROM_CODE.md](05_ROUTES_FROM_CODE.md) | Rotas HTTP, IPC, CLI commands |
| [06_COMPONENTS_CATALOG.md](06_COMPONENTS_CATALOG.md) | Todos os componentes e serviços |
| [07_DATA_ACCESS_MAP.md](07_DATA_ACCESS_MAP.md) | Mapa de acesso a dados por fonte |
| [08_DATABASE_SCHEMA.md](08_DATABASE_SCHEMA.md) | Schema Neon PostgreSQL + Drizzle |
| [09_AUTH_AND_AUTHZ.md](09_AUTH_AND_AUTHZ.md) | Autenticação e segurança |
| [10_INTEGRATIONS.md](10_INTEGRATIONS.md) | Gemini, OpenAI, Gmail, Neon, Git |
| [11_OBSERVABILITY.md](11_OBSERVABILITY.md) | Logging, monitoring, health checks |
| [12_TESTS_COVERAGE_MAP.md](12_TESTS_COVERAGE_MAP.md) | 0% cobertura — plano de testes |
| [13_TECH_DEBT_FINDINGS.md](13_TECH_DEBT_FINDINGS.md) | Dívida técnica priorizada |
| [14_ARCHITECTURE_DIAGRAMS.md](14_ARCHITECTURE_DIAGRAMS.md) | Diagramas Mermaid de arquitetura |
