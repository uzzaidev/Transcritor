# Checklist Humano - Decisoes e Acoes Manuais

Data: 2026-04-13

## 1) Decisoes obrigatorias

- [ ] Qual caixa de e-mail sera usada para entrada (IMAP)?
- [ ] Quais destinatarios estao autorizados para receber ATA?
- [ ] Trigger `[TRANSCRICAO]` aceita qualquer remetente ou lista permitida?
- [ ] Dashboard sera apenas interno?
- [ ] Quem recebe credenciais de Basic Auth do dashboard?
- [ ] Primeiros envios serao dry-run ou reais?

## 2) Credenciais e acessos

- [ ] Gerar App Password Google
- [ ] Preencher `.env` raiz
- [ ] Preencher `web/.env.local`
- [ ] Configurar variaveis no ambiente de execucao (se houver deploy interno)

## 3) Banco de dados

- [ ] Provisionar Neon (staging/producao)
- [ ] Definir `DATABASE_URL`
- [ ] Rodar `web db:push`

## 4) Validacao operacional

- [ ] Rodar `ata_agent run-once --json`
- [ ] Confirmar eventos em `pipeline_events`
- [ ] Validar dashboard com auth
- [ ] Validar `/api/health`

## 5) Politicas de risco

- [ ] Confirmar que flags GitOps/ScriptOps continuam desativadas
- [ ] Aprovar explicitamente antes de qualquer ativacao:
  - [ ] `PIPELINE_GIT_ENABLED`
  - [ ] `PIPELINE_GIT_ALLOW_PUSH`
  - [ ] `PIPELINE_DESTRUCTIVE_GIT_OPS`
  - [ ] `PIPELINE_SCRIPTOPS_ENABLED`

## 6) Operacao continua

- [ ] Definir responsavel por monitorar falhas SMTP/Gemini
- [ ] Definir janela de revisao de eventos no dashboard
- [ ] Definir rotina de rotacao de chaves e senhas
- [ ] Definir procedimento de incidentes (quem aciona quem)

## 7) Referencias

- `RUNBOOK_OPERACIONAL.md`
- `PASSO_A_PASSO_CONFIGURACAO_CHAVES.md`
- `CHECKLIST_PRODUCAO.md`
