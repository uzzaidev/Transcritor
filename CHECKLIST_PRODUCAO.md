# Checklist Producao - Transcritor

Data: 2026-04-13

## A. Ambiente

- [ ] Python 3.10+ instalado
- [ ] Node.js 20+ instalado
- [ ] Dependencias instaladas (`ata_agent`, `gemini-whisper`, `web`)
- [ ] `.env` raiz preenchido
- [ ] `web/.env.local` preenchido

## B. Credenciais

- [ ] `GEMINI_API_KEY`
- [ ] `OPENAI_API_KEY` (se usar multiagent)
- [ ] `IMAP_USER`
- [ ] `IMAP_PASSWORD` (App Password)
- [ ] `SMTP_USER`/`SMTP_USERNAME`
- [ ] `SMTP_PASSWORD` (App Password)
- [ ] `ATA_FROM_EMAIL`/`SMTP_FROM_EMAIL`
- [ ] `ATA_RECIPIENTS`
- [ ] `DATABASE_URL`
- [ ] `DASHBOARD_BASIC_AUTH_USER`
- [ ] `DASHBOARD_BASIC_AUTH_PASSWORD`

## C. Banco

- [ ] Neon provisionado
- [ ] Schema aplicado (`cd web && npm run db:push`)
- [ ] Tabela `pipeline_events` existente

## D. Seguranca

- [ ] Dashboard protegido por Basic Auth
- [ ] Flags perigosas em `0`:
  - [ ] `PIPELINE_GIT_ENABLED=0`
  - [ ] `PIPELINE_GIT_ALLOW_PUSH=0`
  - [ ] `PIPELINE_DESTRUCTIVE_GIT_OPS=0`
  - [ ] `PIPELINE_SCRIPTOPS_ENABLED=0`
- [ ] Chaves no Electron em secure storage (quando disponivel)

## E. Confiabilidade

- [ ] Retry SMTP configurado (defaults ou ajustado)
- [ ] Retry Gemini configurado (defaults ou ajustado)
- [ ] Dry-run inicial executado em ambiente de teste

## F. Testes

- [ ] `cd ata_agent && python -m pytest`
- [ ] `cd gemini-whisper && npm run test`
- [ ] `cd web && npm run test`
- [ ] `cd gemini-whisper && npm run build`
- [ ] `cd web && npm run build`

## G. Go-live interno

- [ ] `ata_agent` rodando (`run-once` ou `daemon`)
- [ ] Dashboard `web` online com auth
- [ ] `/api/health` com status ok
- [ ] Primeiro evento confirmado em `pipeline_events`
- [ ] Primeiro envio real validado para destinatarios aprovados
