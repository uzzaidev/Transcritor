# Checklist Producao - Transcritor

Data: 2026-05-04

Status geral: `100% pronto localmente para o fluxo principal`

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
- [x] `.env` raiz completo para execucao local.
- [x] `web/.env.local` configurado localmente para runtime do dashboard.

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
- [x] `DATABASE_URL`
- [x] `DASHBOARD_BASIC_AUTH_USER`
- [x] `DASHBOARD_BASIC_AUTH_PASSWORD`

## C. Banco

- [x] Neon provisionado.
- [x] Schema aplicado (`cd web && npm run db:push`).
- [x] Tabela `pipeline_events` existente e consultavel.

## D. Seguranca

- [x] Dashboard protegido por Basic Auth.
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
- [x] E2E real `IMAP -> Gemini -> ATA -> SMTP -> Neon` validado com e-mail real de entrada.

## F. Testes

- [x] `cd ata_agent && python -m pytest` - 9 passed.
- [x] `cd gemini-whisper && npm run test` - 8 passed.
- [x] `cd web && npm run test` - 5 passed.
- [x] `cd gemini-whisper && npm run build`
- [x] `cd web && npm run build`
- [x] `cd web && npm run db:push`
- [x] Consulta direta `pipeline_events` no Neon: ok.
- [x] Dashboard sem auth retorna 401.
- [x] Dashboard `/api/health` com auth retorna ok.
- [x] `python -m ata_multiagent_pipeline.preflight`
- [x] `python -m ata_multiagent_pipeline.real_world_regression`
- [x] `python -m ata_multiagent_pipeline.derived_artifacts_regression`
- [x] `cd ata_agent && python -m ata_agent run-once --json` com IMAP autenticado e 0 mensagens pendentes.
- [x] `cd ata_agent && python -m ata_agent run-once --json` com 1 e-mail real processado, `status_validacao=ok` e `delivery_success=true`.

## G. Go-live interno

- [x] `ata_agent` rodando `run-once` com IMAP autenticado.
- [x] Dashboard `web` online com auth em validacao local temporaria.
- [x] `/api/health` com status ok em ambiente rodando.
- [x] Primeiro evento confirmado em `pipeline_events`.
- [x] Primeiro envio real a partir de e-mail de entrada validado.
