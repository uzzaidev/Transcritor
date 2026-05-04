# Checklist Humano - Decisoes e Acoes Manuais

Data: 2026-05-04

## 1) Decisoes obrigatorias

- [x] Confirmar qual caixa de e-mail sera usada para entrada IMAP: `contato@uzzai.com.br`.
- [x] Configurar e validar acesso IMAP da caixa de entrada.
- [x] Confirmar destinatarios autorizados para receber ATA no primeiro teste local.
- [x] Confirmar uso do trigger `[TRANSCRICAO]` para o primeiro teste local.
- [x] Dashboard deve ser interno neste primeiro corte.
- [x] Definir usuario e senha de Basic Auth do dashboard.
- [x] Confirmar primeiro e-mail real com anexo e envio automatico.

## 2) Credenciais e acessos

- [x] App Password Google gerada para SMTP.
- [x] `.env` raiz preenchido para OpenAI e SMTP.
- [x] `.env` raiz completo para dashboard e Neon.
- [x] `web/.env.local` configurado localmente para runtime do dashboard.
- [ ] Configurar variaveis no ambiente de execucao, se houver deploy interno.

## 3) Banco de dados

- [x] Provisionar Neon em staging/producao.
- [x] Definir `DATABASE_URL`.
- [x] Rodar `cd web && npm run db:push`.

## 4) Validacao operacional

- [x] Rodar `ata_agent run-once --json` com IMAP real e 0 mensagens pendentes.
- [x] Confirmar tabela `pipeline_events` consultavel no Neon.
- [x] Confirmar primeiro evento real em `pipeline_events`.
- [x] Validar dashboard com auth.
- [x] Validar `/api/health` com o servidor `web` rodando.

## 5) Politicas de risco

- [x] Confirmar que flags GitOps/ScriptOps continuam desativadas.
- [ ] Aprovar explicitamente antes de qualquer ativacao de `PIPELINE_GIT_ENABLED`.
- [ ] Aprovar explicitamente antes de qualquer ativacao de `PIPELINE_GIT_ALLOW_PUSH`.
- [ ] Aprovar explicitamente antes de qualquer ativacao de `PIPELINE_DESTRUCTIVE_GIT_OPS`.
- [ ] Aprovar explicitamente antes de qualquer ativacao de `PIPELINE_SCRIPTOPS_ENABLED`.

## 6) Operacao continua

- [ ] Definir responsavel por monitorar falhas SMTP/Gemini.
- [ ] Definir janela de revisao de eventos no dashboard.
- [ ] Definir rotina de rotacao de chaves e senhas.
- [ ] Definir procedimento de incidentes.

## 7) Referencias

- `RUNBOOK_OPERACIONAL.md`
- `PASSO_A_PASSO_CONFIGURACAO_CHAVES.md`
- `CHECKLIST_PRODUCAO.md`
- `OPERATIONS_STATUS.md`
