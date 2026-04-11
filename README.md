# Transcritor de ata e enviador de e-mails

Monorepo com **pipeline Python** (e-mail → Gemini → ata → SMTP), **app web** (Next.js + Tailwind + Neon) e a app existente **gemini-whisper** (Electron).

## Documentação de plano

- `PLANO_AGENTE_ATAS.md` — fluxo do agente e decisões fechadas.
- `PLANO_PIPELINE_MULTIAGENTE.md` — papéis dos agentes, contrato de dados e sprints.
- `PROCESSO-*.md` — processos operacionais do vault (atas, sprint, Git, dashboards, scripts).

## Agente Python (`ata_agent/`)

1. Copie `.env.example` para `.env` na **raiz do repositório** e preencha credenciais.
2. Instale dependências e execute a partir da pasta `ata_agent/`:

```bash
cd ata_agent
pip install -r requirements.txt
python -m ata_agent run-once
# ou loop:
python -m ata_agent daemon --interval 120
```

Requer **Python 3.10+** no PATH. A transcrição usa a **Gemini Files API** (alinhada ao `gemini-whisper`), não o Whisper local.

## Web (`web/`)

Next.js 15, tema centralizado em `web/theme/tokens.ts` → `tailwind.config.ts`, Postgres na **Neon** via `DATABASE_URL`.

```bash
cd web
cp .env.example .env.local
npm install
npm run db:push
npm run dev
```

Autenticação: não incluída na v1.

## Templates de ata

Pasta `Template de atas/`. Opcional: `ATA_TEMPLATE_PATH` no `.env` apontando para um `.md` específico.
