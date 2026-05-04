# Runbook Operacional - Transcritor

Data: 2026-05-04

## Objetivo

Operar o fluxo canonico com confiabilidade:

IMAP -> Gemini -> ATA -> SMTP -> `pipeline_events` (Neon) -> dashboard `web`.

## 1) Pre-requisitos

- Python 3.10+
- Node.js 20+
- Conta de e-mail com IMAP/SMTP configurado
- Banco Neon provisionado

## 2) Instalacao

### `ata_agent`

```bash
cd ata_agent
python -m pip install -r requirements.txt
```

### `gemini-whisper`

```bash
cd gemini-whisper
npm install
```

### `web`

```bash
cd web
npm install
```

## 3) Configuracao

1. Copie `.env.example` para `.env` na raiz.
2. Preencha chaves e credenciais.
3. No `web`, use `web/.env.local` ou deixe o app ler as variaveis da raiz.
4. Aplique schema:

```bash
cd web
npm run db:push
```

Guia detalhado humano: `PASSO_A_PASSO_CONFIGURACAO_CHAVES.md`.

## 4) Modo seguro (recomendado na primeira validacao)

- `ata_multiagent_pipeline` com `--dry-run-email`.
- Não habilitar flags perigosas:
  - `PIPELINE_GIT_ENABLED=0`
  - `PIPELINE_GIT_ALLOW_PUSH=0`
  - `PIPELINE_DESTRUCTIVE_GIT_OPS=0`
  - `PIPELINE_SCRIPTOPS_ENABLED=0`
- Usar destinatarios de teste em `ATA_RECIPIENTS`.

## 5) Execucao

### Pipeline canonico (`ata_agent`)

```bash
cd ata_agent
python -m ata_agent run-once --json
# ou daemon
python -m ata_agent daemon --interval 120
```

### Dashboard

```bash
cd web
npm run dev
```

- Abrir `/` com credenciais Basic Auth.
- Healthcheck: `GET /api/health`.

## 6) Como validar que esta funcionando

1. `ata_agent` processa e retorna estado com `delivery_success`.
2. `pipeline_events` recebe eventos novos.
3. Dashboard mostra total e ultimos eventos.
4. `/api/health` retorna `status=ok`.

## 7) Reacao a falhas comuns

### `IMAP_USER / IMAP_PASSWORD` ausentes
- Corrigir `.env` e reiniciar o `ata_agent`.

### Falha SMTP
- Conferir `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER/SMTP_PASSWORD`, `ATA_FROM_EMAIL`.
- Validar App Password Google.
- O agente ja aplica retry com backoff.

### Erro Gemini (429/5xx)
- Retry ja ativo.
- Se persistir, reduzir volume/lote e reexecutar.

### Dashboard 401
- Definir `DASHBOARD_BASIC_AUTH_USER` e `DASHBOARD_BASIC_AUTH_PASSWORD`.

### Dashboard sem eventos
- Confirmar `DATABASE_URL` no `.env` raiz.
- Confirmar tabela `pipeline_events` criada (`web db:push`).
- Rodar `ata_agent run-once` e verificar logs.

## 8) O que e automatico vs manual

Automatico:
- Polling IMAP
- Retry SMTP/Gemini
- Persistencia de eventos (com `DATABASE_URL`)
- Atualizacao de dashboard via leitura do banco

Manual:
- Configuracao de chaves/credenciais
- Provisionamento de Neon
- Definicao de politica de envio real
- Habilitacao de flags perigosas (somente com autorizacao)

## 9) Pendencias atuais

- Falta validar o primeiro E2E real com e-mail `[TRANSCRICAO]` e audio anexado.
- Autenticacao do web e Basic Auth simples, intencional para uso interno.
- Anti-duplicidade global via Neon/job id segue como melhoria do roadmap expandido.
