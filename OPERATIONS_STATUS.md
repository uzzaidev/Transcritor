# OPERATIONS STATUS

Last update: 2026-04-28

## Estado Atual

Foco operacional: fechar o produto completo `IMAP -> Gemini -> ATA -> SMTP -> pipeline_events (Neon) -> dashboard web`.

Status estimado:
- Projeto completo de producao: `92% pronto localmente`
- Restante para 100%: `8%`
- Principal bloqueio: credenciais/decisoes externas para IMAP, Neon, destinatarios e Basic Auth.

Git:
- Branch: `main`
- Commit local mais recente: `ad99a6e feat: strengthen ata pipeline validation and ui ops`
- Estado remoto: branch local esta `ahead 1`; falta `git push origin main` quando autorizado.

## Validado em 2026-04-28

- Python 3.12 disponivel.
- Node LTS 24.15.0 instalado e ativo.
- `ata_multiagent_pipeline` preflight com SMTP autenticado.
- `ata_multiagent_pipeline` regressao real com 6 casos e 0 falhas.
- `ata_multiagent_pipeline` regressao de derivados com 6 casos e 0 falhas.
- `ata_agent` testes: 9 passed.
- `gemini-whisper` testes: 8 passed.
- `gemini-whisper` build: ok.
- `web` testes: 5 passed.
- `web` build: ok.

## Entregas Concluidas

- `ata_agent` como pipeline canonico IMAP/Gemini/ATA/SMTP com CLI `run-once` e `daemon`.
- `ata_multiagent_pipeline` com geracao de ATA, validacao, derivados, auditoria, e-mail, preflight e regressoes.
- `gemini-whisper` integrado ao pipeline de ATA com operacao assistida na UI.
- `web` com dashboard inicial, Basic Auth e healthcheck.
- Logs, snapshots, dry-run e validacoes locais.
- Documentacao operacional, checklists e runbook.

## Riscos Remanescentes

- E2E real ainda nao foi validado com caixa IMAP recebendo audio.
- Neon real ainda nao foi validado porque `DATABASE_URL` esta ausente.
- Dashboard em ambiente real ainda nao foi validado com Basic Auth configurado.
- `git push origin main` ainda nao foi executado por falta de autorizacao explicita.
- `npm install` reporta vulnerabilidades em dependencias transitivas; nao foi aplicado `npm audit fix --force` para evitar mudancas quebradoras.

## Acoes Humanas Necessarias

- Informar/configurar `IMAP_USER` e `IMAP_PASSWORD`.
- Informar/configurar `ATA_RECIPIENTS`.
- Provisionar Neon e configurar `DATABASE_URL`.
- Definir `DASHBOARD_BASIC_AUTH_USER` e `DASHBOARD_BASIC_AUTH_PASSWORD`.
- Confirmar se o primeiro teste IMAP real deve enviar e-mail de verdade ou rodar em dry-run.
- Autorizar `git push origin main` quando quiser publicar os commits locais.

## Proximo Passo Operacional

1. Completar `.env` com IMAP, recipients, Neon e Basic Auth.
2. Rodar `cd web && npm run db:push`.
3. Rodar `cd ata_agent && python -m ata_agent run-once --json`.
4. Abrir `web` e confirmar evento em `pipeline_events`.
5. Fazer teste real com um e-mail `[TRANSCRICAO]` contendo audio.
