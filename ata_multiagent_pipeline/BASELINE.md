# Baseline Operacional

Data da validação: 2026-04-12

## Estado validado
- App `gemini-whisper` compila com sucesso.
- Pipeline `ata_multiagent_pipeline` executa com sucesso.
- Preflight confirma SMTP configurado e autenticado.
- Extração heurística valida responsáveis e prazos sem regressão.

## Comandos validados
```bash
cd gemini-whisper
npm run build
```

```bash
python -m ata_multiagent_pipeline.preflight
python -m ata_multiagent_pipeline.cli .\generated\ata_pipeline\runtime_events\heuristica_event.json --dry-run-email
```

## Resultado esperado da baseline
- `smtp_login_verified: true`
- `status_validacao: validado`
- `validation_result.score: 100`
- `delivery_result.provider: smtp-dry-run`
- ação `Tailwind` com prazo `2026-04-13`
- ação `Neon` com prazo `2026-04-15`
- participante normalizado como `Equipe técnica`

## Escopo funcional atual
- Geração manual de ATA pela UI.
- Geração automática de ATA pós-transcrição.
- Perfis por projeto no app.
- Preflight, reprocessamento e limpeza pela UI.
- Geração de sprint, dashboards e auditoria final.
- Envio real por SMTP já validado anteriormente.

## Próxima etapa segura
Fechar testes reais da Sprint 2 com um conjunto de transcrições reais, corrigindo apenas heurísticas e merge quando houver evidência concreta de erro.
