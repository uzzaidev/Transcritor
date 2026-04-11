# 1. 🎯 Visão Geral do Projeto

Este projeto implementa um sistema de vendas automatizado utilizando múltiplos agentes de IA orquestrados pela biblioteca `swarm-ai`. Ele simula uma equipe de vendas com diferentes especializações (Gerente, Qualificador de Leads, Tratador de Objeções, Fechador, Pesquisador) que interagem com um usuário (potencial cliente) via terminal. O objetivo é guiar o cliente pelo funil de vendas, responder perguntas (usando pesquisa web via Tavily) e, idealmente, fechar a venda. O público-alvo são desenvolvedores ou empresas que desejam criar ou experimentar chatbots de vendas/atendimento baseados em múltiplos agentes.

# 2. 📝 Resumo Ultracondensado

*   **Linguagem:** Python
*   **Framework Principal:** `swarm-ai` (para orquestração de agentes)
*   **APIs Externas:** OpenAI API (Modelos GPT-4o), Tavily API (Pesquisa Web)
*   **Dependências:** `swarm-ai`, `python-dotenv`, `tavily-python`
*   **Funcionalidade:** Simula uma equipe de vendas multiagente interagindo via terminal.
*   **Agentes:** Manager, Lead Qualifier, Objection Handler, Closer, Researcher.
*   **Recursos:** Delegação de tarefas entre agentes, pesquisa web integrada.
*   **Configuração:** Requer chaves de API OpenAI e Tavily via arquivo `.env`.
*   **Teste:** Inclui script `test.py` para demonstrar transferência básica entre agentes.

# 3. 🗺️ Arquitetura & Fluxo do Código

| Componente          | Linguagem/Tipo | Responsabilidade                                                                 | Relações                                                                 |
| :------------------ | :------------- | :------------------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| `sales_agents.py` | Python         | Define e inicializa os agentes de vendas, configura a interação e o loop principal | Importa `Swarm`, `Agent`, `TavilyClient`, `dotenv`. Usa `.env`, define agentes e funções de transferência/pesquisa. |
| `.env`              | Configuração   | Armazena as chaves das APIs OpenAI e Tavily                                      | Lido por `sales_agents.py` via `python-dotenv`.                          |
| `test.py`           | Python         | Script simples para testar a funcionalidade básica de transferência entre agentes | Importa `Swarm`, `Agent`. Demonstra `client.run` com transferência.      |
| `manager` (Agent)   | Python (swarm) | Supervisiona e delega tarefas para outros agentes, decide fim da conversa        | Chama funções `transfer_to_*`, `end_conversation`. É o ponto de entrada. |
| `lead_qualifier` (Agent)| Python (swarm)| Qualifica leads com base em critérios (ex: BANT), interage de forma concisa       | Chamado pelo `manager`.                                                  |
| `objection_handler` (Agent)| Python (swarm)| Trata objeções dos clientes usando empatia e conhecimento do produto            | Chamado pelo `manager`.                                                  |
| `closer` (Agent)    | Python (swarm) | Tenta fechar a venda usando o framework CLOSER de Alex Hormozi                  | Chamado pelo `manager`.                                                  |
| `researcher` (Agent)| Python (swarm) | Realiza pesquisas na web usando a API Tavily para obter informações             | Chamado pelo `manager`, usa a função `web_search`.                       |
| `web_search()`      | Python (func)  | Função que interage com a API Tavily para buscar na web                          | Usada pelo agente `researcher`.                                          |
| `transfer_to_*()` | Python (func)  | Funções que retornam a instância do agente de destino para o `swarm`            | Usadas pelo `manager` para delegar.                                      |
| `end_conversation()`| Python (func)  | Sinaliza o fim da interação quando o cliente está pronto para comprar            | Usada pelo `manager`.                                                    |

```mermaid
graph LR
    subgraph sales_agents.py
        U[Usuário Input] --> M(Manager Agent);
        M -- Delega --> LQ(Lead Qualifier Agent);
        M -- Delega --> OH(Objection Handler Agent);
        M -- Delega --> C(Closer Agent);
        M -- Delega --> R(Researcher Agent);
        M -- Decide --> E(End Conversation);
        R -- Chama --> WS[web_search()];
        WS -- Usa API --> T(Tavily API);
        M -- Usa API --> OAI(OpenAI API gpt-4o);
        LQ -- Usa API --> OAI;
        OH -- Usa API --> OAI;
        C -- Usa API --> OAI;
        R -- Usa API --> OAI;
        ENV[.env] --> M;
    end

    subgraph test.py
        TU[User Input Test] --> TA(Agent A);
        TA -- Transfer --> TB(Agent B);
        TA -- Usa API --> TOAI(OpenAI API);
        TB -- Usa API --> TOAI;
    end

    style ENV fill:#lightgrey,stroke:#333,stroke-width:2px
    style T fill:#lightblue,stroke:#333,stroke-width:2px
    style OAI fill:#lightgreen,stroke:#333,stroke-width:2px
    style TOAI fill:#lightgreen,stroke:#333,stroke-width:2px
```

**Fluxo (`sales_agents.py`):**
1.  Carrega as chaves de API do arquivo `.env`.
2.  Inicializa o cliente `Swarm` e o cliente `Tavily`.
3.  Define os 5 Agentes (`manager`, `lead_qualifier`, `objection_handler`, `closer`, `researcher`), cada um com suas instruções, modelo (`gpt-4o`) e funções disponíveis (transferência, pesquisa, fim).
4.  Inicia um loop `while True` que aguarda a entrada do usuário.
5.  A cada entrada, chama `client.run` direcionado ao `manager`.
6.  O `swarm` gerencia a conversa:
    *   O `manager` recebe a mensagem.
    *   Com base nas instruções e na conversa, o `manager` decide qual ação tomar:
        *   Chamar uma função de transferência (`transfer_to_*`) para delegar a outro agente.
        *   Chamar `transfer_to_researcher` se precisar de pesquisa web (que usará `web_search` e Tavily).
        *   Chamar `end_conversation` se a venda for concluída.
        *   Responder diretamente (menos comum, pois a instrução é delegar).
    *   O agente delegado processa a informação e responde. A conversa pode voltar ao `manager` ou continuar com o agente delegado dependendo da configuração e fluxo do `swarm`.
7.  A resposta final da interação é impressa no console.

**Fluxo (`test.py`):**
1.  Inicializa o cliente `Swarm`.
2.  Define `Agent A` (com função `transfer_to_agent_b`) e `Agent B`.
3.  Envia uma única mensagem para `Agent A` pedindo para falar com `Agent B`.
4.  `Agent A` chama `transfer_to_agent_b`.
5.  `Agent B` recebe o controle e responde à solicitação original (buscar notícias) conforme suas instruções ("inglês do século 18").
6.  A resposta final de `Agent B` é impressa.

# 4. 🔧 Guia de Instalação, Configuração & Execução

**Pré-requisitos:**

*   Python 3.x instalado.
*   Gerenciador de pacotes `pip`.
*   Conta na OpenAI com chave de API e acesso ao modelo `gpt-4o`.
*   Conta na Tavily com chave de API (plano gratuito pode ser suficiente para testes).
*   Sistema Operacional compatível (Windows, macOS, Linux).

**Passo a passo de setup:**

1.  **Clonar/Baixar o código:** Obtenha os arquivos `sales_agents.py`, `test.py` e `.env` (ou crie-o).
2.  **Instalar dependências:** Abra um terminal na pasta do projeto e execute:
    ```bash
    pip install swarm-ai python-dotenv tavily-python
    ```
3.  **Configurar API Keys:**
    *   Obtenha suas chaves de API nos painéis da OpenAI e Tavily.
    *   Abra o arquivo `.env` em um editor de texto.
    *   Insira suas chaves:
        ```dotenv
        OPENAI_API_KEY=sk-SUA_CHAVE_OPENAI_AQUI
        TAVILY_API_KEY=tvly-SUA_CHAVE_TAVILY_AQUI
        ```
    *   Salve o arquivo `.env`. **Nunca compartilhe este arquivo ou suas chaves de API.**

**Como executar:**

*   **Sistema Principal de Vendas:**
    1.  Abra um terminal na pasta do projeto.
    2.  Execute o script principal:
        ```bash
        python sales_agents.py
        ```
    3.  Interaja com o "Sales Manager" digitando mensagens no terminal e pressionando Enter. A conversa continuará até que o manager decida encerrá-la ou você interrompa o script (Ctrl+C).
*   **Script de Teste:**
    1.  Abra um terminal na pasta do projeto.
    2.  Execute o script de teste:
        ```bash
        python test.py
        ```
    3.  Observe a saída que demonstra a transferência entre `Agent A` e `Agent B`.

**FAQ rápido de erros comuns:**

*   **`AuthenticationError` (OpenAI ou Tavily):** Verifique se as chaves `OPENAI_API_KEY` e `TAVILY_API_KEY` no `.env` estão corretas, válidas e se as contas associadas estão ativas e com saldo/limite.
*   **`ModuleNotFoundError`:** Certifique-se de que as dependências (`swarm-ai`, `python-dotenv`, `tavily-python`) foram instaladas corretamente.
*   **Erro de Rate Limit (OpenAI/Tavily):** Você pode ter excedido os limites de uso das APIs. Verifique seus planos e limites nos respectivos painéis. Espere antes de tentar novamente ou considere um upgrade.
*   **Agente não encontrado / Erro de transferência:** Verifique se os nomes dos agentes nas funções `transfer_to_*` correspondem exatamente aos nomes definidos nos `Agent(...)`. Erros na lógica do `swarm` podem ocorrer.
*   **`AttributeError` ou `NameError`:** Verifique se todas as funções e variáveis estão definidas antes de serem usadas, especialmente as funções de transferência e os próprios agentes.

# 5. 📊 Métricas-chave & KPIs Monitoráveis

| Métrica                       | Onde medir                                       | Faixa típica       | Importância                                            |
| :---------------------------- | :----------------------------------------------- | :----------------- | :----------------------------------------------------- |
| Custo por Conversa            | Painel OpenAI + Painel Tavily                    | $0.05 - $1.00+ USD*| Crítica (Controlar custos operacionais)                |
| Latência por Turno (Agente)   | Medir tempo em `client.run` ou logs do `swarm`   | 2 - 15 seg         | Alta (Experiência do usuário em tempo real)          |
| Tempo Total da Conversa       | Medir tempo do início ao fim do loop `while`   | 1 - 15 min         | Média (Eficiência geral do funil)                      |
| Taxa de Erro API (OpenAI/Tavily)| Monitorar exceções nas chamadas das libs       | < 2%               | Alta (Confiabilidade do sistema)                       |
| Taxa de Qualificação (Leads)  | Contagem manual ou log do `lead_qualifier`       | Variável           | Alta (Eficiência da qualificação)                      |
| Taxa de Tratamento de Objeções| Contagem manual ou log do `objection_handler`    | Variável           | Alta (Capacidade de superar barreiras)                 |
| Taxa de Fechamento            | Contagem manual ou log do `closer`/`end_conversation` | Variável           | Crítica (Resultado final do negócio)                   |
| % de Uso Pesquisa Web         | Log de chamadas `web_search` / Tavily dashboard  | Variável           | Média (Entender necessidade de informação externa)     |

*(*) Estimativa altamente variável dependendo da duração da conversa, número de turnos, uso de pesquisa web e complexidade das interações com `gpt-4o`.

# 6. 💡 Insights Avançados & Boas Práticas

▸ **Segurança:** Usar `.env` é aceitável para desenvolvimento. Em produção, prefira gerenciadores de segredos (AWS Secrets Manager, Azure Key Vault, GCP Secret Manager, HashiCorp Vault) ou variáveis de ambiente seguras injetadas durante o deploy. Adicione `.env` ao `.gitignore`. Valide e sanitize inputs do usuário para prevenir injection nos prompts, embora o risco seja menor com APIs como OpenAI.
▸ **Escalabilidade:** A biblioteca `swarm-ai` visa facilitar a criação de sistemas multiagente, mas a escalabilidade depende da sua arquitetura e dos limites das APIs (OpenAI, Tavily). O loop `while True` síncrono em `sales_agents.py` limita a um usuário por vez. Para múltiplos usuários concorrentes, seria necessário refatorar para um framework web (Flask, FastAPI) com processamento assíncrono (Celery, asyncio) e gerenciar o estado de cada conversa separadamente. Implemente retries com backoff para lidar com erros transitórios das APIs.
▸ **Versionamento & CI/CD:** Use Git. Um pipeline de CI/CD (GitHub Actions, GitLab CI, Jenkins) pode automatizar linting (ex: `flake8`, `black`), instalação de dependências e execução de testes básicos (`test.py` ou testes de unidade mais robustos) a cada commit/push.
▸ **Observabilidade:** Adicione logging (`import logging`) detalhado para rastrear qual agente está ativo, os prompts enviados, as respostas recebidas, as chamadas de função (transferências, pesquisa), latências e erros. A `swarm-ai` pode oferecer seus próprios mecanismos de logging/tracing que devem ser explorados. Considere plataformas de observabilidade de LLMs se a complexidade aumentar.
▸ **Modelos/Serviços Externos:** Dependência crítica das APIs OpenAI (`gpt-4o`) e Tavily. Monitore custos, limites de taxa (RPM, TPM), disponibilidade (páginas de status) e possíveis alterações/depreciações nos modelos/APIs. Tenha planos de contingência (ex: usar outros modelos, limitar uso de pesquisa web). As instruções dos agentes (prompts) são cruciais e podem precisar de ajustes frequentes (`prompt engineering`).
▸ **Estratégias de Testes:** Testes de unidade para funções puras (se houver). Testes de integração para o fluxo `sales_agents.py` são essenciais, mas caros e não determinísticos. Use mocks para simular as APIs OpenAI e Tavily e testar a lógica de transferência e as instruções básicas dos agentes. O `test.py` serve como um teste de integração mínimo. Crie cenários de teste específicos (ex: cliente com objeção de preço, cliente indeciso) para avaliar o comportamento dos agentes.

# 7. 🚀 Aplicações Criativas & Dicas Avançadas

▸ **Engenharia de Software:** Criar um time de agentes para auxiliar no desenvolvimento: um agente `Requirements Analyst` (coleta requisitos), um `Architect` (sugere design), um `Coder` (escreve snippets), um `Tester` (sugere casos de teste) e um `Reviewer` (analisa código).
▸ **Tecnologia (TI - Suporte):** Implementar um help desk automatizado com agentes especializados: `Tier 1 Support` (triagem inicial, FAQs), `Troubleshooter` (diagnóstico guiado), `Knowledge Base Researcher` (busca documentação interna/externa via Tavily/RAG) e `Escalation Manager` (direciona para humanos).
▸ **Medicina (Educação/Simulação):** Simular interações médico-paciente para treinamento, com um agente `Patient Simulator` (apresenta sintomas), um `Doctor Agent` (faz perguntas, diagnostica) e um `Medical Researcher` (busca informações médicas relevantes).
▸ **Educação (Tutoria):** Desenvolver um tutor adaptativo com agentes: `Subject Expert` (explica conceitos), `Quiz Master` (cria e avalia perguntas), `Study Planner` (sugere cronograma) e `Motivation Coach` (incentiva o aluno).
▸ **Negócios (Recursos Humanos):** Automatizar a triagem inicial de currículos e entrevistas preliminares com agentes: `Job Spec Analyzer`, `Resume Screener`, `Initial Interviewer` (faz perguntas básicas por texto) e `Candidate Ranker`.
▸ **Jogos/Entretenimento:** Criar NPCs (Non-Player Characters) mais dinâmicos e interativos em jogos, onde diferentes "facetas" da personalidade ou funções do NPC são representadas por agentes distintos que colaboram para gerar comportamento e diálogo complexos.
▸ **Finanças Pessoais:** Um assistente financeiro com agentes: `Budget Tracker`, `Investment Researcher` (usa Tavily para notícias e análises), `Goal Planner` e `Debt Advisor`.

# 8. 🧠 Perguntas de Checagem de Compreensão

1.  Qual o papel do agente `manager` no script `sales_agents.py`?
    <details><summary>Ver Resposta</summary>Ele atua como o orquestrador central, recebendo a entrada do usuário e delegando a tarefa para o agente especialista mais apropriado (Qualifier, Handler, Closer, Researcher) ou encerrando a conversa.</details>
2.  Quais APIs externas são utilizadas e por quê?
    <details><summary>Ver Resposta</summary>A API da OpenAI (especificamente o modelo `gpt-4o`) é usada para dar inteligência e capacidade de conversação aos agentes. A API da Tavily é usada pelo agente `researcher` para realizar pesquisas na web em tempo real.</details>
3.  Como a transferência de controle entre agentes é realizada?
    <details><summary>Ver Resposta</summary>Através de funções Python (ex: `transfer_to_qualifier`) que são passadas para a lista `functions` do agente `manager`. Quando o `manager` decide delegar, ele "chama" (sinaliza para o `swarm`) a função apropriada, e a biblioteca `swarm` gerencia a passagem do controle para o agente retornado pela função.</details>
4.  Qual a finalidade do arquivo `test.py`?
    <details><summary>Ver Resposta</summary>Serve como um exemplo mínimo e um teste rápido para verificar se a configuração básica do `swarm` e a funcionalidade de transferência entre dois agentes simples estão funcionando corretamente.</details>
5.  Por que o agente `researcher` precisa da API Tavily?
    <details><summary>Ver Resposta</summary>Para buscar informações atualizadas ou específicas na web que não estão no conhecimento intrínseco do modelo de linguagem, permitindo que a equipe de vendas responda a perguntas mais factuais ou sobre eventos recentes.</details>
6.  Quais informações precisam ser configuradas no arquivo `.env`?
    <details><summary>Ver Resposta</summary>A chave da API da OpenAI (`OPENAI_API_KEY`) e a chave da API da Tavily (`TAVILY_API_KEY`).</details>

# 9. 📚 Referências & Links Úteis

*   **Swarm Documentation:** [https://developer.swarms.world/](https://developer.swarms.world/) (ou documentação específica da lib `swarm-ai` se houver um link melhor)
*   **OpenAI API Documentation:** [https://platform.openai.com/docs/](https://platform.openai.com/docs/)
*   **Tavily API Documentation:** [https://docs.tavily.com/](https://docs.tavily.com/)
*   **python-dotenv:** [https://github.com/theskumar/python-dotenv](https://github.com/theskumar/python-dotenv)
*   **Alex Hormozi CLOSER Framework (Referência conceitual):** (Busque por "Alex Hormozi CLOSER framework" - não há um link canônico único)

# 10. 📑 Índice de Seções

*   [1. 🎯 Visão Geral do Projeto](#1--visão-geral-do-projeto)
*   [2. 📝 Resumo Ultracondensado](#2--resumo-ultracondensado)
*   [3. 🗺️ Arquitetura & Fluxo do Código](#3--arquitetura--fluxo-do-código)
*   [4. 🔧 Guia de Instalação, Configuração & Execução](#4--guia-de-instalação-configuração--execução)
*   [5. 📊 Métricas-chave & KPIs Monitoráveis](#5--métricas-chave--kpis-monitoráveis)
*   [6. 💡 Insights Avançados & Boas Práticas](#6--insights-avançados--boas-práticas)
*   [7. 🚀 Aplicações Criativas & Dicas Avançadas](#7--aplicações-criativas--dicas-avançadas)
*   [8. 🧠 Perguntas de Checagem de Compreensão](#8--perguntas-de-checagem-de-compreensão)
*   [9. 📚 Referências & Links Úteis](#9--referências--links-úteis)
*   [10. 📑 Índice de Seções](#10--índice-de-seções)

✅ Checklist de Conformidade Tabela §3 alinhada

✅ KPIs com faixa típica

✅ Mermaid incluso (se útil)

<!-- Fim do documento gerado -->