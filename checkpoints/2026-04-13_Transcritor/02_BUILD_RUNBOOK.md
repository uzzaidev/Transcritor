# 02 — Build & Run Runbook

**Checkpoint:** 2026-04-13
**Projeto:** Transcritor (Uzz.Ai — Ferramentas)

---

## Pré-requisitos Globais

| Requisito | Versão mínima | Verificação |
|-----------|--------------|-------------|
| Python | 3.10+ | `python --version` |
| Node.js | 18+ | `node --version` |
| npm | 8+ | `npm --version` |
| Git | 2.x | `git --version` |
| Conta Gmail | App Password habilitada | — |
| Gemini API Key | — | console.cloud.google.com |
| OpenAI API Key | — | platform.openai.com (apenas multiagent) |
| Neon PostgreSQL | — | neon.tech (apenas web/) |

---

## Configuração de Ambiente

### 1. Copiar .env (compartilhado — raiz)

```bash
cp .env.example .env
```

Preencha os campos:
```env
# IA
GEMINI_API_KEY=sua_chave_aqui
GEMINI_MODEL=gemini-2.5-flash

# IMAP (leitura de e-mails)
IMAP_USER=seu@gmail.com
IMAP_PASSWORD=senha_de_app_gmail
IMAP_FOLDER=INBOX
EMAIL_SUBJECT_TRIGGER=[TRANSCRICAO]

# SMTP (envio de ATA)
SMTP_USER=seu@gmail.com
SMTP_PASSWORD=senha_de_app_gmail
ATA_FROM_EMAIL=seu@gmail.com
ATA_RECIPIENTS=destino@email.com,outro@email.com

# Neon (apenas web/)
DATABASE_URL=postgresql://user:pass@host.neon.tech/dbname
```

> **IMPORTANTE:** Gmail exige "Senha de App" (não a senha normal).
> Ativar em: conta Google → Segurança → Verificação em 2 etapas → Senhas de app

---

## Módulo 1: `ata_agent/` (Pipeline principal)

### Instalação

```bash
cd ata_agent
pip install -e .
# ou via requirements:
pip install -r requirements.txt
```

### Executar uma vez (processar e-mails na caixa de entrada)

```bash
python -m ata_agent run-once
```

### Executar como daemon (polling a cada 120 segundos)

```bash
python -m ata_agent daemon --interval 120
```

### Configuração com template customizado

```bash
# Definir no .env:
ATA_TEMPLATE_PATH=../Template de atas/08-ATA-CONTATO-CLIENTE-TEMPLATE-R00.md

# Depois executar normalmente
python -m ata_agent run-once
```

### Estrutura de saída

- IDs de mensagens processadas: `.cache/ata_agent/processed.json`
- Logs: stdout (sem arquivo de log estruturado — ver 11_OBSERVABILITY.md)
- E-mail enviado via SMTP para `ATA_RECIPIENTS`

---

## Módulo 2: `ata_multiagent_pipeline/` (Pipeline multi-agente)

### Instalação

```bash
cd ata_multiagent_pipeline
cp .env.example .env
# Editar .env com chaves OpenAI + SMTP

pip install openai python-dotenv
# Nota: requirements.txt do módulo NÃO ENCONTRADO — ver 13_TECH_DEBT_FINDINGS.md
```

### Executar com evento JSON

```bash
python -m ata_multiagent_pipeline examples/sample_event.json
```

### Reprocessar último evento

```bash
python -m ata_multiagent_pipeline reprocess-latest
```

### Limpar artefatos gerados

```bash
python -m ata_multiagent_pipeline cleanup-generated
```

### Verificar pré-condições (SMTP, OpenAI, runtime)

```bash
python -m ata_multiagent_pipeline preflight
# (via Electron IPC: ata-pipeline:preflight)
```

### Input esperado (`sample_event.json`)

```json
{
  "tipo_evento": "nova_reuniao",
  "arquivo_fonte": "path_to_transcript.txt",
  "projeto": "PROJECT_NAME",
  "sprint": "Sprint-2025-W10",
  "participantes": ["Nome1", "Nome2"],
  "transcript_text": "Conteúdo da transcrição...",
  "destinatarios": ["email@example.com"]
}
```

### Estrutura de saída gerada

```
generated/ata_pipeline/
├── atas/          # ATAs em Markdown
├── sprints/       # Artefatos de sprint
├── dashboards/    # Atualizações de dashboard
├── email/         # Payloads de e-mail (text + HTML)
├── logs/          # Logs de execução
└── runtime_events/ # Candidatos a reprocessamento
```

---

## Módulo 3: `gemini-whisper/` (App Desktop Electron)

### Instalação

```bash
cd gemini-whisper
npm install
```

### Desenvolvimento (Vite + Electron ao vivo)

```bash
npm run electron:dev
# Abre janela Electron com hot-reload via Vite na porta 5173
```

### Só frontend (sem Electron)

```bash
npm run dev
# Browser em http://localhost:5173
```

### Build de produção (instalador)

```bash
npm run electron:build
# Gera instalador em release/
```

### Variáveis de ambiente no app

As chaves de API são configuradas **via UI** no botão "⚙ Settings":
- `GEMINI_API_KEY` — salvo em localStorage
- `OPENAI_API_KEY` — salvo em localStorage (se provider = OpenAI)

O app lê o `.env` do diretório do workspace para o pipeline Python (via Electron IPC).

### Requisito Python no Electron

O `electron/main.cjs` localiza o Python automaticamente:
- Procura `venv/bin/python`, `venv/Scripts/python`, `python3`, `python` no PATH
- **Evidência:** `gemini-whisper/electron/main.cjs`

---

## Módulo 4: `web/` (Next.js 15 Dashboard)

### Instalação

```bash
cd web
npm install
```

### Configurar banco de dados

```bash
cp .env.example .env.local
# Adicionar DATABASE_URL do Neon

# Criar tabelas (push do schema Drizzle)
npm run db:push
```

### Desenvolvimento

```bash
npm run dev
# Disponível em http://localhost:3000 (com Turbopack)
```

### Build de produção

```bash
npm run build
npm start
```

### Deploy no Vercel

```bash
vercel --prod
# Definir DATABASE_URL nas variáveis de ambiente do projeto no Vercel
```

### Migrations (Drizzle)

```bash
# Gerar arquivo de migration
npm run db:generate

# Aplicar ao banco
npm run db:push
```

---

## Fluxo de Uso Completo

```
1. Usuário envia áudio por e-mail com assunto "[TRANSCRICAO]"
   ↓
2. ata_agent daemon detecta (IMAP polling)
   ↓
3. Gemini 2.5 Flash transcreve o áudio
   ↓
4. Gemini extrai estrutura (decisões, ações, kaizens, riscos)
   ↓
5. Gemini gera ATA formatada em Markdown
   ↓
6. Validação (min 120 chars, contém "decis" ou "topic")
   ↓
7. ATA enviada por e-mail (SMTP) para ATA_RECIPIENTS
   ↓
8. Evento registrado no Neon (pipeline_events)
   ↓
9. Dashboard web/ exibe o evento
```

**Alternativa via Electron:**
```
1. Usuário abre gemini-whisper
   ↓
2. Upload de arquivo de áudio ou gravação ao vivo
   ↓
3. Transcrição via Gemini 2.5 Flash (inlineData base64)
   ↓
4. Identificação de speakers (modal)
   ↓
5. Geração de ATA via IPC → Python (ata_multiagent_pipeline)
   ↓
6. E-mail enviado + artefatos salvos em generated/
```

---

## Perguntas em Aberto

1. **requirements.txt ausente** no `ata_multiagent_pipeline/` — qual é o comando exato de instalação para produção?
2. **Variável `PIPELINE_GIT_ENABLED`** — foi testada em produção ou ainda está em desenvolvimento?
3. **Neon Database** — a tabela `pipeline_events` é populada pelo `ata_agent/` ou apenas pelo `ata_multiagent_pipeline/`? Código de inserção não encontrado no `ata_agent/`.
