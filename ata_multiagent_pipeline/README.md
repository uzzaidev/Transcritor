# ATA Multiagent Pipeline

Pipeline multiagente para:
- transformar transcrição em ata estruturada
- validar a ata contra regras operacionais
- gerar artefatos derivados de sprint e dashboards
- montar o e-mail final com a ata formatada no corpo
- enviar a ata por SMTP seguro
- consolidar publicação via Git com integração serializada

## Uso

```bash
python -m ata_multiagent_pipeline.cli ata_multiagent_pipeline/examples/sample_event.json
```

O CLI aceita `event.json` em `utf-8` ou `utf-8 with BOM`, o que evita falhas comuns no Windows.

Comandos operacionais:

```bash
python -m ata_multiagent_pipeline.cli reprocess-latest
python -m ata_multiagent_pipeline.cli reprocess-latest --dry-run-email
python -m ata_multiagent_pipeline.cli cleanup-generated
```

O modo `--dry-run-email` gera todos os artefatos e valida a entrega sem disparar SMTP real.

## Preflight

Antes de ativar o envio automático real, rode:

```bash
python -m ata_multiagent_pipeline.preflight
```

O relatório confirma se o pipeline encontrou:
- `OPENAI_API_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`

Ele também informa:
- se o SMTP está em `dry-run`
- se já existe evento pronto para reprocessamento em `generated/ata_pipeline/runtime_events/`

## Configuração

Use o arquivo [/.env](C:/Users/USER/Downloads/Transcritor%20de%20ata%20e%20enviador%20de%20e-mails/.env) na raiz do workspace.

Para Gmail/Google Workspace, preencha:
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`

O envio automático da ATA pela app depende de:
- defaults da ATA preenchidos no Settings
- `Gerar ATA automaticamente` ativado
- SMTP configurado na raiz

## Saídas geradas

O pipeline grava artefatos em `generated/ata_pipeline/`:
- `atas/`
- `sprints/`
- `dashboards/`
- `email/`
- `logs/`
