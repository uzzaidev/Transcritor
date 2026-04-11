# Roadmap de Implementacao

## Status Geral

- [x] Sprint 1 - Orquestracao base, contrato de dados, locks e logs estruturados
- [x] Sprint 2 - Geracao, extracao e normalizacao da ATA
- [x] Sprint 3 - Validacao, sprint, dashboards e auditoria final
- [x] Sprint 4 - Integrador de entrega, artefatos de e-mail e dispatcher SMTP
- [x] Sprint 5 - Git integrador, ScriptOps e snapshot final do pipeline

## O que ja esta funcionando

- [x] Receber evento JSON com transcricao ou arquivo fonte
- [x] Gerar ATA em Markdown com frontmatter
- [x] Extrair decisoes, acoes, kaizens e riscos
- [x] Validar score minimo e bloquear downstream em caso de erro
- [x] Gerar sprint e dashboards em paralelo
- [x] Montar corpo de e-mail em texto e HTML
- [x] Bloquear reenvio duplicado
- [x] Registrar logs e snapshots JSON da execucao
- [x] Pular envio SMTP quando nao houver configuracao
- [x] Pular Git quando a publicacao estiver desabilitada

## Proxima Sequencia Recomendada

### Fase 1 - Integracao com entrada real

- [ ] Ler automaticamente novos audios ou transcricoes da caixa de entrada
- [ ] Conectar o pipeline ao fluxo atual do projeto `gemini-whisper`
- [ ] Definir pasta canonica para templates finais de ATA
- [ ] Mapear destinatarios por projeto, sprint ou tipo de reuniao

### Fase 2 - Qualidade da extracao

- [ ] Trocar fallback generico por prompts mais ricos para extracao estruturada
- [ ] Melhorar deducao de responsaveis, prazos e severidade
- [ ] Corrigir problemas de encoding herdados de fontes antigas
- [ ] Adicionar testes com exemplos reais de reuniao

### Fase 3 - Operacao assistida

- [ ] Criar comando de reprocessamento por ATA
- [ ] Criar modo dry-run para envio de e-mail
- [ ] Adicionar painel simples de status da execucao
- [ ] Configurar politicas de retry com observabilidade

### Fase 4 - Publicacao controlada

- [ ] Habilitar Git por ambiente com branch de integracao dedicada
- [ ] Adicionar checklist pre-push automatico
- [ ] Criar rollback guiado para falhas operacionais
- [ ] Formalizar aprovacao humana antes do push em producao

## Como validar manualmente

1. Configurar variaveis em um `.env` baseado em `.env.example`.
2. Executar `python -m ata_multiagent_pipeline.cli ata_multiagent_pipeline/examples/sample_event.json`.
3. Conferir os artefatos em `generated/ata_pipeline/`.
4. Validar `generated/ata_pipeline/logs/result_*.json`.
5. Habilitar SMTP e repetir o teste para validar entrega real.
