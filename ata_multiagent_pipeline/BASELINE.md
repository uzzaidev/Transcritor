# Baseline Operacional

Data da validacao: 2026-04-28

## Estado validado

- App `gemini-whisper` compila com sucesso.
- App `gemini-whisper` passa nos testes locais.
- Pipeline `ata_multiagent_pipeline` executa preflight com SMTP autenticado.
- Regressao com casos reais passa com 6 casos e 0 falhas.
- Regressao de derivados passa com 6 casos e 0 falhas.
- `ata_agent` passa nos testes locais.
- `web` passa nos testes locais e no build com Node LTS.
- `ata_agent` autentica no IMAP e executa `run-once` sem mensagens pendentes.

## Comandos validados

```bash
python -m ata_multiagent_pipeline.preflight
python -m ata_multiagent_pipeline.real_world_regression
python -m ata_multiagent_pipeline.derived_artifacts_regression
```

```bash
cd ata_agent
python -m pytest
```

```bash
cd gemini-whisper
npm run test
npm run build
```

```bash
cd web
npm run test
npm run build
```

```bash
cd ata_agent
python -m ata_agent run-once --json
```

## Resultado esperado da baseline

- `smtp_login_verified: true`
- regressao real com `failed_cases: 0`
- regressao de derivados com `failed_cases: 0`
- `ata_agent`: 9 testes passando
- `gemini-whisper`: 8 testes passando
- `web`: 5 testes passando
- `ata_agent run-once --json`: `[]` quando nao ha e-mails pendentes com trigger

## Escopo funcional atual

- Geracao manual de ATA pela UI.
- Geracao automatica de ATA pos-transcricao.
- Perfis por projeto no app.
- Preflight, reprocessamento e limpeza pela UI.
- Geracao de sprint, dashboards e auditoria final.
- Envio real por SMTP ja validado anteriormente.
- Dashboard web compilando e testado localmente.
- Entrada IMAP configurada e login validado.

## Bloqueios para 100%

- Neon provisionado e `DATABASE_URL`.
- Credenciais `DASHBOARD_BASIC_AUTH_*`.
- Primeiro e-mail real com trigger `[TRANSCRICAO]` e anexo de audio.
