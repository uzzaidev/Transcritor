# ATA Multiagent Pipeline

Pipeline multiagente para:
- transformar transcricao em ata estruturada
- validar a ata contra regras operacionais
- gerar artefatos de sprint/dashboard
- montar payload de e-mail
- enviar por SMTP
- integrar com Git e ScriptOps somente quando autorizado

## Instalacao

Requisito: Python 3.10+.

```bash
cd ata_multiagent_pipeline
python -m pip install -r requirements.txt
```

Observacao: hoje o modulo usa apenas bibliotecas da stdlib Python em runtime. O `requirements.txt` existe para manter um ponto de instalacao reproduzivel.

## Configuracao

O pipeline carrega variaveis de ambiente nesta ordem:
1. `/.env` (raiz do repositorio)
2. `/ata_multiagent_pipeline/.env`
3. `/web_sales_agent/.env`
4. `/gemini-whisper/.env.local`

Variaveis principais:
- `OPENAI_API_KEY`
- `PIPELINE_OPENAI_MODEL` (default `gpt-4o-mini`)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_PASSWORD`
- `SMTP_USERNAME` **ou** `SMTP_USER`
- `SMTP_FROM_EMAIL` **ou** `ATA_FROM_EMAIL`
- `SMTP_FROM_NAME`, `SMTP_USE_TLS`, `SMTP_DRY_RUN`

Flags sensiveis (manter desativadas por padrao):
- `PIPELINE_GIT_ENABLED=0`
- `PIPELINE_GIT_ALLOW_PUSH=0`
- `PIPELINE_DESTRUCTIVE_GIT_OPS=0`
- `PIPELINE_SCRIPTOPS_ENABLED=0`

## Uso

```bash
python -m ata_multiagent_pipeline.cli ata_multiagent_pipeline/examples/sample_event.json
```

Comandos operacionais:

```bash
python -m ata_multiagent_pipeline.cli reprocess-latest
python -m ata_multiagent_pipeline.cli reprocess-latest --dry-run-email
python -m ata_multiagent_pipeline.cli cleanup-generated
```

O modo `--dry-run-email` gera todos os artefatos e valida a entrega sem disparar SMTP real.

## Regressao com casos reais

Antes de mexer em heuristicas de extracao, merge ou validacao, rode:

```bash
python -m ata_multiagent_pipeline.real_world_regression
```

Essa bateria executa casos reais em `dry-run` e grava relatorios em `generated/ata_pipeline/regression/`.

Ela destaca:
- falhas de execucao
- score de validacao
- saidas genericas
- responsaveis indefinidos
- sinais de texto degradado

## Regressao de sprint e dashboards

Para validar a consistencia entre ATA, sprint, dashboards e metricas:

```bash
python -m ata_multiagent_pipeline.derived_artifacts_regression
```

Essa bateria valida:
- presenca dos artefatos derivados
- contagem de acoes e decisoes no sprint
- consistencia do dashboard de metricas
- auditoria final do pipeline

## Preflight

Antes de envio real:

```bash
python -m ata_multiagent_pipeline.preflight
```

O relatorio valida:
- `OPENAI_API_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME_OR_SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL_OR_ATA_FROM_EMAIL`

E tambem mostra:
- status de `smtp_dry_run`
- ultimo evento de `generated/ata_pipeline/runtime_events/`

## Saidas

Artefatos em `generated/ata_pipeline/`:
- `atas/`
- `sprints/`
- `dashboards/`
- `email/`
- `logs/`
