# OPERATIONS STATUS

Last update: 2026-04-13

## Estado Atual

Foco: `ata_agent` como pipeline canonico, com baseline operacional para uso interno continuo.

Fases concluidas:
- FASE 0 - Inventario e seguranca de execucao
- FASE 1 - Reprodutibilidade
- FASE 2 - Persistencia de eventos no Neon (ata_agent)
- FASE 3 - Confiabilidade de envio/chamadas criticas
- FASE 4 - Testes minimos obrigatorios
- FASE 5 - Seguranca minima (dashboard auth + chaves Electron fora do localStorage)
- FASE 6 - Observabilidade (logs padronizados + dashboard de eventos com paginacao)
- FASE 7 - Refatoracao controlada do `gemini-whisper/App.tsx`
- FASE 8 - Documentacao operacional final

## Entregas Fase 5

- `web` com autenticacao basica obrigatoria via middleware:
  - `DASHBOARD_BASIC_AUTH_USER`
  - `DASHBOARD_BASIC_AUTH_PASSWORD`
- Dashboard bloqueado por padrao quando credenciais nao estao configuradas.
- `gemini-whisper` com armazenamento seguro de chaves via Electron `safeStorage`:
  - IPC: `settings:secure-capabilities`, `settings:secure-load`, `settings:secure-save`
  - Chaves nao persistem mais em `localStorage`.
  - Quando secure storage nao esta disponivel, chaves ficam somente em memoria da sessao.

## Entregas Fase 6

- `ata_agent` com logs padronizados:
  - timestamp
  - nivel
  - contexto (`ctx`)
  - correlation id (`corr`) por execucao de mensagem
- Dashboard `web` com:
  - total de eventos
  - listagem de ultimos eventos
  - status/success
  - tipo de evento
  - timestamp
  - order by `created_at desc`
  - limite e paginacao por query string
- Healthcheck simples:
  - `GET /api/health`

## Entregas Fase 7

- `gemini-whisper/App.tsx` reduzido de 1313 para 948 linhas.
- Extracao de responsabilidades para arquivos dedicados:
  - `gemini-whisper/hooks/useAppSettings.ts`
  - `gemini-whisper/hooks/useAtaPipeline.ts`
  - `gemini-whisper/utils/pipelineHelpers.ts`
  - `gemini-whisper/utils/speakerUtils.ts`
- Comportamento preservado e build/testes validados.

## Entregas Fase 8

- Documentacao final criada/atualizada:
  - `README.md`
  - `RUNBOOK_OPERACIONAL.md`
  - `CHECKLIST_PRODUCAO.md`
  - `CHECKLIST_HUMANO.md`
  - `PASSO_A_PASSO_CONFIGURACAO_CHAVES.md`

## Testes e Validacao

Executado com sucesso:
- `cd ata_agent && python -m pytest` (9 passed)
- `cd gemini-whisper && npm run test` (8 passed)
- `cd web && npm run test` (5 passed)
- `cd gemini-whisper && npm run build`
- `cd web && npm run build`

## Riscos Remanescentes

- Falta validacao E2E com credenciais reais em ambiente de homologacao.

## Acoes Humanas Necessarias

- Preencher credenciais reais no `.env`.
- Provisionar e validar `DATABASE_URL` no Neon.
- Definir usuarios de acesso ao dashboard (`DASHBOARD_BASIC_AUTH_*`).
- Validar fluxo real Gmail IMAP/SMTP com conta de teste.
- Manter flags GitOps/ScriptOps em `0` ate autorizacao explicita.

## Guia Humano de Chaves

- `PASSO_A_PASSO_CONFIGURACAO_CHAVES.md`
