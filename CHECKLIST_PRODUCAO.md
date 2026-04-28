# Checklist Producao - Transcritor

Data: 2026-04-28

Status geral: `94% pronto localmente`

Legenda:
- `[x]` concluido/validado nesta maquina
- `[ ]` pendente
- `BLOQUEADO` depende de credencial, conta externa ou decisao humana

## A. Ambiente

- [x] Python 3.10+ instalado e validado com Python 3.12.
- [x] Node.js 20+ instalado e validado com Node 24.15.0.
- [x] Dependencias instaladas em `ata_agent`.
- [x] Dependencias instaladas em `gemini-whisper`.
- [x] Dependencias instaladas em `web`.
- [ ] `.env` raiz completo. BLOQUEADO: faltam banco e credenciais de dashboard.
- [ ] `web/.env.local` completo. BLOQUEADO: faltam `DATABASE_URL` e credenciais de dashboard, se nao vierem da raiz.

## B. Credenciais

- [x] `GEMINI_API_KEY`
- [x] `OPENAI_API_KEY`
- [x] `IMAP_USER`
- [x] `IMAP_PASSWORD`
- [x] `SMTP_HOST`
- [x] `SMTP_PORT`
- [x] `SMTP_USER`/`SMTP_USERNAME`
- [x] `SMTP_PASSWORD`
- [x] `ATA_FROM_EMAIL`/`SMTP_FROM_EMAIL`
- [x] `ATA_RECIPIENTS`
- [ ] `DATABASE_URL` BLOQUEADO
- [ ] `DASHBOARD_BASIC_AUTH_USER` BLOQUEADO
- [ ] `DASHBOARD_BASIC_AUTH_PASSWORD` BLOQUEADO

## C. Banco

- [ ] Neon provisionado. BLOQUEADO: precisa de `DATABASE_URL`.
- [ ] Schema aplicado (`cd web && npm run db:push`). BLOQUEADO: precisa de `DATABASE_URL`.
- [ ] Tabela `pipeline_events` existente. BLOQUEADO: precisa validar no Neon real.

## D. Seguranca

- [ ] Dashboard protegido por Basic Auth. BLOQUEADO: faltam credenciais `DASHBOARD_BASIC_AUTH_*`.
- [x] Flags perigosas em `0`:
- [x] `PIPELINE_GIT_ENABLED=0`
- [x] `PIPELINE_GIT_ALLOW_PUSH=0`
- [x] `PIPELINE_DESTRUCTIVE_GIT_OPS=0`
- [x] `PIPELINE_SCRIPTOPS_ENABLED=0`
- [x] Chaves no Electron em secure storage quando disponivel.

## E. Confiabilidade

- [x] Retry SMTP configurado no pipeline canonico.
- [x] Retry Gemini configurado no pipeline canonico.
- [x] Dry-run e preflight do `ata_multiagent_pipeline` executados.
- [x] Regressao com casos reais executada com 0 falhas.
- [x] Regressao de derivados executada com 0 falhas.
- [ ] E2E real `IMAP -> Gemini -> ATA -> SMTP -> Neon`. BLOQUEADO: falta Neon e e-mail real de entrada para processamento completo.

## F. Testes

- [x] `cd ata_agent && python -m pytest` - 9 passed.
- [x] `cd gemini-whisper && npm run test` - 8 passed.
- [x] `cd web && npm run test` - 5 passed.
- [x] `cd gemini-whisper && npm run build`
- [x] `cd web && npm run build`
- [x] `python -m ata_multiagent_pipeline.preflight`
- [x] `python -m ata_multiagent_pipeline.real_world_regression`
- [x] `python -m ata_multiagent_pipeline.derived_artifacts_regression`
- [x] `cd ata_agent && python -m ata_agent run-once --json` com IMAP autenticado e 0 mensagens pendentes.

## G. Go-live interno

- [x] `ata_agent` rodando `run-once` com IMAP autenticado.
- [ ] Dashboard `web` online com auth. BLOQUEADO: faltam Basic Auth e ambiente de execucao.
- [ ] `/api/health` com status ok em ambiente rodando. Pendente de execucao do servidor.
- [ ] Primeiro evento confirmado em `pipeline_events`. BLOQUEADO: falta Neon.
- [ ] Primeiro envio real a partir de e-mail de entrada validado. BLOQUEADO: falta e-mail real com trigger/anexo e politica de envio.
