# Transcritor (Uzz.Ai - Ferramentas)

Monorepo com pipeline de ATA por e-mail, app desktop de transcricao e dashboard web.

## Modulos Ativos

- `ata_agent/` (Python): pipeline canonico IMAP -> Gemini -> ATA -> SMTP
- `ata_multiagent_pipeline/` (Python): pipeline avancado com extracao e derivados
- `gemini-whisper/` (Electron + React): app desktop de upload/gravacao/transcricao
- `web/` (Next.js + Neon): dashboard inicial de observabilidade

## Instalacao Rapida Confiavel

### 1) Preparar env da raiz

```bash
cp .env.example .env
```

Preencha no minimo:
- `GEMINI_API_KEY`
- `IMAP_USER`, `IMAP_PASSWORD`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_PASSWORD`
- `SMTP_USER` (ou `SMTP_USERNAME`)
- `ATA_FROM_EMAIL` (ou `SMTP_FROM_EMAIL`)
- `ATA_RECIPIENTS`
- `DATABASE_URL` (para `web/`)
- `OPENAI_API_KEY` (se usar `ata_multiagent_pipeline/`)

### 2) Instalar e executar `ata_agent` (pipeline principal)

```bash
cd ata_agent
python -m pip install -r requirements.txt
python -m ata_agent run-once
# ou:
python -m ata_agent daemon --interval 120
```

### 3) Instalar e executar `ata_multiagent_pipeline`

```bash
cd ata_multiagent_pipeline
python -m pip install -r requirements.txt
python -m ata_multiagent_pipeline.cli examples/sample_event.json
python -m ata_multiagent_pipeline.preflight
```

### 4) Instalar e executar `gemini-whisper`

```bash
cd gemini-whisper
cp .env.example .env.local
npm install
npm run electron:dev
```

### 5) Instalar e executar `web`

```bash
cd web
cp .env.example .env.local
npm install
npm run db:push
npm run dev
```

## Testes Minimos

```bash
cd ata_agent
python -m pip install -r requirements-dev.txt
python -m pytest
```

```bash
cd gemini-whisper
npm run test
```

```bash
cd web
npm run test
```

## Flags Sensiveis (nao ativar por padrao)

Manter estas variaveis em `0` ate autorizacao explicita humana:
- `PIPELINE_GIT_ENABLED`
- `PIPELINE_GIT_ALLOW_PUSH`
- `PIPELINE_DESTRUCTIVE_GIT_OPS`
- `PIPELINE_SCRIPTOPS_ENABLED`

## Legado e Experimental

Diretorios fora dos 4 modulos ativos devem ser tratados como legado/experimental, exceto quando houver necessidade operacional explicita:
- `Whisper de voz/`
- `web_sales_agent/`
- `Template de atas/`

Status operacional atual e pendencias: `OPERATIONS_STATUS.md`.

Guia humano para configuracao de chaves: `PASSO_A_PASSO_CONFIGURACAO_CHAVES.md`.

Runbook operacional: `RUNBOOK_OPERACIONAL.md`.

Checklist de producao: `CHECKLIST_PRODUCAO.md`.

Checklist humano de decisoes manuais: `CHECKLIST_HUMANO.md`.
