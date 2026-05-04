# Passo a Passo - Configuracao de Chaves (Humano)

Data: 2026-05-04

Este guia cobre somente configuracao manual de credenciais e acessos.

## 1) Preparar arquivo de ambiente

1. Na raiz do repositorio, copie:
   - `cp .env.example .env`
2. Abra `.env` e preencha:
   - `GEMINI_API_KEY`
   - `OPENAI_API_KEY` (se usar multiagent)
   - `IMAP_USER`
   - `IMAP_PASSWORD`
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_USER` (ou `SMTP_USERNAME`)
   - `SMTP_PASSWORD`
   - `ATA_FROM_EMAIL` (ou `SMTP_FROM_EMAIL`)
   - `ATA_RECIPIENTS`
   - `DATABASE_URL`
   - `DASHBOARD_BASIC_AUTH_USER`
   - `DASHBOARD_BASIC_AUTH_PASSWORD`

## 2) Gmail (IMAP/SMTP)

1. Ative verificacao em 2 etapas na conta Google.
2. Gere uma App Password.
3. Use a App Password em:
   - `IMAP_PASSWORD`
   - `SMTP_PASSWORD`
4. Defina:
   - `IMAP_USER` com a caixa que recebe os audios.
   - `SMTP_USER` com a conta de envio.
   - `ATA_FROM_EMAIL` com remetente valido.

## 3) Neon (web + eventos)

1. Crie/provisione banco Neon.
2. Copie connection string para `DATABASE_URL` no `.env`.
3. Aplique schema do web:
   - `cd web`
   - confirme `DATABASE_URL` no `.env` da raiz ou em `web/.env.local`
   - `npm run db:push`

## 4) Proteger dashboard web

1. Defina no `.env`:
   - `DASHBOARD_BASIC_AUTH_USER`
   - `DASHBOARD_BASIC_AUTH_PASSWORD`
2. Inicie o web:
   - `cd web && npm run dev`
3. Ao abrir `/`, use usuario/senha do Basic Auth.

Sem essas variaveis, o dashboard fica bloqueado por padrao.

## 5) Chaves no Electron (gemini-whisper)

1. Abra o app:
   - `cd gemini-whisper && npm run electron:dev`
2. Clique em `Settings`.
3. Preencha:
   - OpenAI API Key (se usar provider OpenAI)
   - Hugging Face Token (se usar provider Hugging Face)
4. Clique `Save Changes`.

Observacao:
- Em Electron, as chaves agora sao salvas via armazenamento seguro do SO (safeStorage), quando disponivel.
- Se o app informar que secure storage esta indisponivel, as chaves ficam somente em memoria da sessao.

## 6) Validacao rapida

1. Testes:
   - `cd ata_agent && python -m pytest`
   - `cd gemini-whisper && npm run test`
   - `cd web && npm run test`
2. Healthcheck web:
   - `GET /api/health`
3. Execucao pipeline:
   - `cd ata_agent && python -m ata_agent run-once --json`
4. Confirme evento em `pipeline_events` no Neon.

## 7) Nao ativar sem aprovacao

Manter em `0` ate autorizacao explicita:
- `PIPELINE_GIT_ENABLED`
- `PIPELINE_GIT_ALLOW_PUSH`
- `PIPELINE_DESTRUCTIVE_GIT_OPS`
- `PIPELINE_SCRIPTOPS_ENABLED`
