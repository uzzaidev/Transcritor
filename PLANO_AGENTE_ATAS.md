# Plano de Implementação: Agente Transcritor e Gerador de Atas

Este documento descreve a arquitetura e os passos necessários para criar um agente automatizado de transcrição de áudios e geração de atas de reunião, a partir de gatilhos via e-mail.

## Objetivo

Criar um agente (ou fluxo de automação) que seja capaz de:
1. Identificar a chegada de um novo e-mail baseado em um assunto/código específico.
2. Capturar o arquivo de áudio (ou link) contido neste e-mail.
3. Processar o áudio usando a base existente do **Gemini Whisper** (`Whisper de voz` / APIs do Google) para gerar a transcrição completa.
4. Processar a transcrição através de um LLM com um _Template_ de Ata de Reunião pré-definido.
5. Enviar a ata de reunião gerada por e-mail para a lista de destinatários (ex: sócios).

## Arquitetura Proposta

### 1. Módulo de Gatilho e Entrada (Email Listener)
- **Como funciona:** Um script Python executando continuamente (ou um serviço como n8n/Make.com) que se conecta à caixa de entrada via protocolo IMAP.
- **Ação:** Ele buscará por e-mails não lidos cujo assunto corresponda a uma regra específica (ex: `[TRANSCRICAO] Reunião de Diretoria`).
- **Extração:** Baixa o áudio anexado e armazena em uma pasta temporária (ou extrai a URL de um drive).

### 2. Módulo de Transcrição (Gemini Whisper)
- **Como funciona:** Integração com as ferramentas que você já possui no projeto (`transcrever_arquivo_otimizado.py`).
- **Ação:** O áudio capturado no passo anterior será processado em "chunks" se for muito grande e passado para a API de reconhecimento de fala da Google.

### 3. Módulo de Geração da Ata (LLM)
- **Como funciona:** Utilização da API do Gemini (ou Claude/OpenAI).
- **Ação:** Enviar o texto bruto da transcrição acompanhado de um _prompt_ estruturado:
  > "Aja como um assistente executivo. Extraia as seguintes informações desta transcrição: Tópicos Discutidos, Decisões Tomadas, Próximos Passos (Action Items) e Responsáveis. Formate como uma Ata de Reunião profissional."

### 4. Módulo de Saída (Email Dispatcher)
- **Como funciona:** Script Python utilizando a biblioteca `smtplib` em conjunto com um servidor SMTP seguro (Gmail, SendGrid, etc.).
- **Ação:** Pega a Ata formatada, coloca no corpo do e-mail (ou como PDF em anexo) e despacha para os sócios, mantendo a coerência com o assunto original.

---

## Perguntas Abertas (Para Decisão)

1. **Abordagem de Infraestrutura:** Você prefere que **100% disso seja programado em Python** ou prefere usar uma **ferramenta no-code/low-code** (como o n8n ou Make.com) para conectar o Gmail à sua base em Python?
2. **Serviço de Email:** Qual e-mail nós usaremos para Ler e Enviar as atas? (ex: Gmail pessoal, Google Workspace da empresa, Outlook?)
3. **Template da Ata:** Você já tem um template preferido ou devo criar um padrão estruturado em Tópicos, Decisões e Ações?

---

## Decisões fechadas (execução)

| Tema | Decisão |
|------|---------|
| **Gatilho / infra** | **100% Python** para leitura IMAP, processamento e envio SMTP. n8n/Make permanecem opcionais no futuro se quiser UI visual para o mesmo fluxo. |
| **E-mail** | Entrada IMAP configuravel (atual: Hostinger) e saida SMTP configuravel (atual: Gmail/Workspace ou equivalente). Outros provedores usam a mesma interface (`ata_agent/email/`), trocando host/porta. |
| **Transcrição** | **Gemini** (upload de arquivo + `generateContent`), alinhado ao fluxo da pasta `gemini-whisper`. Whisper local em `Whisper de voz/` continua disponível para uso manual/offline. |
| **Template** | Padrão interno em `ata_agent/prompts/` + possibilidade de apontar `ATA_TEMPLATE_PATH` para um arquivo em `Template de atas/`. |
| **Camada web** | Projeto **Next.js + React + Tailwind** em `web/`, tokens de cor no `tailwind.config.ts`, **Neon** para persistencia leve (runs do pipeline) e **Basic Auth** para uso interno. |

Implementação: pacote `ata_agent/` (CLI) e app `web/`. Detalhes operacionais multiagente: `PLANO_PIPELINE_MULTIAGENTE.md`.
