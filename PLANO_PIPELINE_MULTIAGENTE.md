# Plano: pipeline multiagente de ATAs + entrega por e-mail

Documento de referência única, alinhado aos `PROCESSO-*.md`, ao `web_sales_agent` (padrão manager + handoff) e ao `PLANO_AGENTE_ATAS.md`.

## Princípios

- **ATA validada** é fonte primária; sprint e dashboards são derivados.
- **Paralelismo** na análise e derivação; **escrita** e **Git** serializados onde há risco de conflito.
- **E-mail** envia **ata formatada**, não transcrição crua (transcrição só se configurado).
- **Implementação atual** (`ata_agent`): orquestração **determinística em Python** (sem swarm em produção até haver necessidade); o desenho abaixo permanece o contrato lógico entre “agentes”.

## Agentes lógicos e responsabilidades

| Agente | Função |
|--------|--------|
| **Orquestrador** | Entrada do evento, ordem fixa do pipeline, locks lógicos, idempotência de envio. |
| **Transcrição** | Áudio → texto (Gemini Files API, como `gemini-whisper`). |
| **ATA** | Transcrição → rascunho de ata (markdown + frontmatter sugerido). |
| **Extrator** | Decisões, ações, kaizens, riscos, participantes, projeto, sprint (estrutura JSON intermediária). |
| **Normalizador** | Aplica convenções (`#encaminhamento`, `[[Responsável]]`, sprint `Sprint-AAAA-WXX` quando conhecido). |
| **Validador** | Checagens mínimas; falha bloqueia envio e derivados pesados. |
| **Sprint / Dashboards** | Atualização de artefatos do vault (fase posterior; não automatizado no primeiro corte do `ata_agent`). |
| **Integrador de entrega** | Monta assunto, texto e HTML do e-mail a partir da ata. |
| **Email Dispatcher** | SMTP (adapter isolado para troca futura: SendGrid, Graph, etc.). |
| **Integrador Git** | Único commit/push (fase posterior; manual ou script dedicado). |
| **ScriptOps** | Backup, dry-run, rollback para scripts destrutivos (`PROCESSO-Execucao-Scripts.md`). |

## Contrato mínimo de handoff (campos)

- `tipo_evento`, `arquivo_fonte`, `projeto`, `sprint`, `participantes`
- `decisoes[]`, `acoes[]`, `kaizens[]`, `riscos[]`
- `status_validacao`, `arquivos_derivados[]`
- Entrega: `ata_markdown_final`, `ata_resumo_executivo`, `email_subject`, `email_body_text`, `email_body_html`, `destinatarios[]`, `delivery_status`, `delivery_timestamp`

Definição tipada: `ata_agent/contracts.py`.

## Sprints de implementação (checklist)

### Sprint 1 — Base e contrato
- [x] Pacote `ata_agent` com config via `.env`, logs estruturados, CLI `run-once` / `daemon`.
- [x] Contrato de dados (`PipelineState`) e orquestrador linear.
- [ ] Handoffs dinâmicos com `swarm-ai` (opcional; hoje fluxo fixo).

### Sprint 2 — ATA a partir de áudio
- [x] IMAP: assunto/glob, anexos de áudio, marcar como lido após sucesso.
- [x] Transcrição Gemini (upload + `generateContent`).
- [x] Geração de ata + sumário via Gemini com instruções + template opcional em arquivo.

### Sprint 3 — Validação e derivados (vault)
- [ ] Validador com score mínimo e regras dos PROCESSO-*.
- [ ] Agente Sprint e dashboards (Markdown no repositório/vault externo).

### Sprint 4 — Entrega
- [x] Integrador de entrega (texto + HTML simples).
- [x] Dispatcher SMTP + `.env`.
- [ ] Anti-duplicidade persistente (Neon `web` + job id).

### Sprint 5 — Git e ScriptOps
- [ ] Integrador Git (commits pequenos, pull antes de push).
- [ ] ScriptOps (dry-run, snapshot, rollback).

## Onde está no código

| Peça | Local |
|------|--------|
| Orquestração | `ata_agent/ata_agent/orchestrator.py` |
| E-mail entrada/saída | `ata_agent/ata_agent/email/` |
| Gemini | `ata_agent/ata_agent/gemini_client.py` |
| UI / DB Neon | `web/` |
