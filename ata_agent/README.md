# Agente de ATAs (Python)

Fluxo: **IMAP** (e-mail com anexo de áudio) → **Gemini** (transcrição + geração de ata) → **SMTP** (envio para sócios).

## Configuração

1. Copie `.env.example` da raiz do repositório (ou use `ata_agent/.env` com os mesmos nomes de variável).
2. Instale dependências:

```bash
cd ata_agent
python -m pip install -r requirements.txt
```

3. Gmail / Workspace: ative IMAP, use **senha de app** ou OAuth conforme política da empresa.

## Uso

```bash
# Uma passada: processa e-mails não lidos que batem com o gatilho de assunto
python -m ata_agent run-once

# Loop a cada N segundos (padrão 120)
python -m ata_agent daemon --interval 120
```

Variáveis importantes: `GEMINI_API_KEY`, `IMAP_*`, `SMTP_*`, `EMAIL_SUBJECT_TRIGGER`, `ATA_RECIPIENTS`.

## Integração

- Transcrição alinhada ao fluxo de upload de ficheiros do projeto `gemini-whisper` (Gemini Files API + `generateContent`).
- Template opcional: `ATA_TEMPLATE_PATH` apontando para um `.md` em `Template de atas/`.
