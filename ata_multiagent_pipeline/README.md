# ATA Multiagent Pipeline

Pipeline multiagente para:
- transformar transcrição em ata estruturada
- validar a ata contra regras operacionais
- gerar artefatos derivados de sprint e dashboards
- montar o e-mail final com a ata formatada
- enviar a ata por SMTP seguro
- consolidar publicação via Git com integração serializada

## Uso

```bash
python -m ata_multiagent_pipeline.cli ata_multiagent_pipeline/examples/sample_event.json
```

## Saídas geradas

O pipeline grava artefatos em `generated/ata_pipeline/`:
- `atas/`
- `sprints/`
- `dashboards/`
- `email/`
- `logs/`
