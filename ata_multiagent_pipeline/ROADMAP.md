# Roadmap de Implementacao

Atualizado em: 2026-04-28

## Status Geral

- [x] Sprint 1 - Orquestracao base, contrato de dados, locks e logs estruturados.
- [x] Sprint 2 - Geracao, extracao e normalizacao da ATA.
- [x] Sprint 3 - Validacao, sprint, dashboards e auditoria final.
- [x] Sprint 4 - Integrador de entrega, artefatos de e-mail e dispatcher SMTP.
- [x] Sprint 5 - Git integrador e ScriptOps implementados como recursos protegidos por flags.

Status do modulo `ata_multiagent_pipeline`: `93%`.

## O que ja esta funcionando

- [x] Receber evento JSON com transcricao ou arquivo fonte.
- [x] Gerar ATA em Markdown com frontmatter.
- [x] Extrair decisoes, acoes, kaizens e riscos.
- [x] Validar score minimo e bloquear downstream em caso de erro.
- [x] Gerar sprint e dashboards em paralelo.
- [x] Montar corpo de e-mail em texto e HTML.
- [x] Bloquear reenvio duplicado.
- [x] Registrar logs e snapshots JSON da execucao.
- [x] Pular envio SMTP quando nao houver configuracao.
- [x] Pular Git quando a publicacao estiver desabilitada.
- [x] Executar preflight com verificacao real de SMTP.
- [x] Executar regressao com casos reais.
- [x] Executar regressao de sprint, dashboards e metricas.
- [x] Integrar operacao assistida com `gemini-whisper`.

## Pendencias Reais

### Fase 1 - Entrada real

- [x] Configurar e autenticar caixa de entrada IMAP.
- [ ] Validar processamento completo com e-mail real contendo audio. BLOQUEADO por falta de mensagem de teste.
- [x] Conectar o pipeline ao fluxo atual do projeto `gemini-whisper`.
- [ ] Definir pasta canonica para templates finais de ATA.
- [ ] Mapear destinatarios por projeto, sprint ou tipo de reuniao. BLOQUEADO por decisao de negocio.

### Fase 2 - Qualidade da extracao

- [x] Melhorar prompts e merge para extracao estruturada.
- [x] Melhorar deducao de responsaveis, prazos e severidade.
- [x] Corrigir/mitigar problemas de encoding herdados de fontes antigas.
- [x] Adicionar testes com exemplos reais de reuniao.

### Fase 3 - Operacao assistida

- [x] Criar reprocessamento do ultimo evento.
- [x] Criar modo dry-run para envio de e-mail.
- [x] Adicionar painel simples de status da execucao na UI.
- [x] Configurar preflight e observabilidade basica.

### Fase 4 - Publicacao controlada

- [x] Manter Git/ScriptOps protegidos por flags.
- [ ] Habilitar Git por ambiente com branch dedicada. BLOQUEADO por autorizacao humana.
- [ ] Adicionar checklist pre-push automatico.
- [ ] Criar rollback guiado para falhas operacionais reais.
- [ ] Formalizar aprovacao humana antes do push em producao.

## Como validar manualmente

```bash
python -m ata_multiagent_pipeline.preflight
python -m ata_multiagent_pipeline.real_world_regression
python -m ata_multiagent_pipeline.derived_artifacts_regression
```

Para a UI:

```bash
cd gemini-whisper
npm run test
npm run build
```
