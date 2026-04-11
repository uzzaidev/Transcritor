---
tipo: template-contato-cliente
versao: R00
created: 2025-11-25T15:00
updated: 2025-11-25T15:00
tags:
  - template
  - cliente
  - vendas
  - contato
  - insights
  - discovery
dg-publish: true
---

# 📞 **TEMPLATE: ATA DE CONTATO COM CLIENTE**

> **Objetivo:** Documentar contatos com clientes, extrair insights de vendas e mapear perfil/necessidades para desenvolvimento de relacionamento comercial

---

## 📖 **ÍNDICE**

1. [O QUE É](#o-que-é)
2. [QUANDO USAR](#quando-usar)
3. [ESTRUTURA DO TEMPLATE](#estrutura)
4. [COMO USAR (PASSO A PASSO)](#como-usar)
5. [TEMPLATE PRONTO](#template-pronto)
6. [EXEMPLOS PRÁTICOS](#exemplos)

---

<a name="o-que-é"></a>
## 🔍 **1. O QUE É A ATA DE CONTATO COM CLIENTE?**

### **📊 DEFINIÇÃO**

A Ata de Contato com Cliente é um documento estruturado para **registrar e analisar** cada interação comercial, transformando conversas em:
- ✅ **Perfil detalhado do cliente**
- ✅ **Mapeamento de necessidades e dores**
- ✅ **Insights para vendas futuras**
- ✅ **Histórico de relacionamento**
- ✅ **Estratégias de abordagem**

### **🎯 PROPÓSITO**

- **Vendas:** Identificar dores, objeções e oportunidades
- **Produto:** Entender necessidades reais do mercado
- **Marketing:** Mapear linguagem e argumentos que funcionam
- **Sucesso do Cliente:** Criar base para relacionamento duradouro

---

<a name="quando-usar"></a>
## 🕐 **2. QUANDO USAR?**

### **✅ USE PARA:**

1. **Primeira reunião** com prospect
2. **Demos e apresentações** de produto
3. **Reuniões de descoberta** (discovery calls)
4. **Follow-ups** importantes
5. **Negociações** de contrato
6. **Reuniões de alinhamento** com clientes ativos
7. **Conversas de renovação** ou upsell
8. **Feedback sessions** com clientes

### **❌ NÃO USE PARA:**

1. Conversas puramente operacionais
2. Suporte técnico rotineiro
3. Mensagens rápidas de WhatsApp
4. Contatos administrativos simples

---

<a name="estrutura"></a>
## 🏗️ **3. ESTRUTURA DO TEMPLATE**

### **📋 SEÇÕES OBRIGATÓRIAS**

#### **A) METADADOS E CLASSIFICAÇÃO**
- Tipo de contato (discovery, demo, negociação, etc.)
- Estágio do funil
- Produto/serviço discutido
- Prioridade do lead

#### **B) PERFIL DO CLIENTE**
- Dados da empresa
- Contexto do negócio
- Stakeholders envolvidos
- Sistemas e ferramentas atuais

#### **C) DESCOBERTA DE NECESSIDADES**
- Dores identificadas
- Quantificação do problema
- Impacto no negócio
- Urgência da solução

#### **D) APRESENTAÇÃO E PROPOSTA**
- O que foi apresentado
- Reações do cliente
- Objeções levantadas
- Interesse demonstrado

#### **E) INSIGHTS E APRENDIZADOS**
- Técnicas que funcionaram
- Argumentos eficazes
- Padrões identificados
- Oportunidades futuras

#### **F) PRÓXIMOS PASSOS**
- Ações definidas
- Responsáveis
- Prazos
- Critérios de sucesso

---

<a name="como-usar"></a>
## 🛠️ **4. COMO USAR (PASSO A PASSO)**

### **ANTES DO CONTATO (15 MIN)**

1. **Pesquisa Prévia:**
   - LinkedIn da empresa e stakeholders
   - Site e redes sociais
   - Notícias recentes
   - Concorrentes

2. **Preparação:**
   - Definir objetivos do contato
   - Preparar perguntas de descoberta
   - Revisar materiais de apresentação
   - Testar ferramentas (se demo)

### **DURANTE O CONTATO (TEMPO REAL)**

1. **Anotações Rápidas:**
   - Dores mencionadas
   - Números e métricas
   - Objeções
   - Reações positivas/negativas

2. **Observações:**
   - Linguagem usada
   - Tom de voz
   - Nível de engajamento
   - Decisores presentes

### **APÓS O CONTATO (30 MIN)**

1. **Documentação Completa:**
   - Preencher template
   - Transcrever anotações
   - Categorizar insights
   - Definir próximos passos

2. **Análise:**
   - Avaliar fit do cliente
   - Identificar padrões
   - Extrair aprendizados
   - Atualizar CRM

---

<a name="template-pronto"></a>
## 📄 **5. TEMPLATE PRONTO (COPIAR/COLAR)**

```markdown
---
tipo: contato-cliente
subtipo: [discovery|demo|negociacao|follow-up|renovacao|upsell|feedback]
status: [agendado|realizado|cancelado|remarcado]
cliente: "[[Nome da Empresa]]"
contato_principal: "[[Nome do Contato]]"
produto: [CHATBOT|SITE-BUILDER|NUTRITRAIN|UZZBIM|OUTRO]
estagio_funil: [lead|qualificado|proposta|negociacao|fechado|perdido]
prioridade: [alta|media|baixa]
data_contato: YYYY-MM-DD
hora_inicio: HH:MM
hora_fim: HH:MM
duracao: 00h00m
canal: [presencial|google-meet|zoom|whatsapp|telefone|email]
participantes_uzzai: 
  - "[[Nome 1]]"
  - "[[Nome 2]]"
participantes_cliente:
  - "[[Nome 1]]"
  - "[[Nome 2]]"
valor_potencial: R$ 0
probabilidade_fechamento: 0%
proxima_acao: ""
prazo_proxima_acao: YYYY-MM-DD
responsavel_followup: "[[Nome]]"
tags:
  - cliente
  - vendas
  - [produto]
  - [segmento]
created: YYYY-MM-DDTHH:MM
updated: YYYY-MM-DDTHH:MM
versao: R00
dg-publish: false
---

# 📞 **ATA DE CONTATO** — `= this.cliente`

> **Tipo:** `= this.subtipo` | **Data:** `= dateformat(this.data_contato, "dd/MM/yyyy")` | **Duração:** `= this.duracao` | **Estágio:** `= this.estagio_funil`

---

## 📊 **DASHBOARD EXECUTIVO**

### 🎯 **Resumo do Contato**

| Métrica | Valor |
|---------|-------|
| **Cliente** | `= this.cliente` |
| **Contato Principal** | `= this.contato_principal` |
| **Tipo de Contato** | `= this.subtipo` |
| **Produto Discutido** | `= this.produto` |
| **Estágio do Funil** | `= this.estagio_funil` |
| **Valor Potencial** | `= this.valor_potencial` |
| **Probabilidade** | `= this.probabilidade_fechamento` |
| **Próxima Ação** | `= this.proxima_acao` |
| **Prazo** | `= dateformat(this.prazo_proxima_acao, "dd/MM/yyyy")` |

### 📈 **Score de Qualificação (BANT)**

| Critério | Score (1-5) | Observações |
|----------|-------------|-------------|
| **Budget** (Orçamento) | [1-5] | [Tem orçamento? Quanto?] |
| **Authority** (Autoridade) | [1-5] | [É decisor? Quem mais decide?] |
| **Need** (Necessidade) | [1-5] | [Dor é real? Urgente?] |
| **Timeline** (Prazo) | [1-5] | [Quando precisa? Há urgência?] |

**Score Total BANT**: [X]/20

### 🎨 **Fit do Cliente**

| Dimensão | Avaliação | Justificativa |
|----------|-----------|---------------|
| **Fit de Produto** | 🟢🟡🔴 | [Nosso produto resolve a dor?] |
| **Fit de Mercado** | 🟢🟡🔴 | [Cliente está no nosso ICP?] |
| **Fit Financeiro** | 🟢🟡🔴 | [Ticket é viável para ambos?] |
| **Fit Cultural** | 🟢🟡🔴 | [Valores e forma de trabalho alinham?] |

---

## 🏢 **PERFIL DO CLIENTE**

### **📋 Dados da Empresa**

| Campo | Informação |
|-------|------------|
| **Nome da Empresa** | [Nome completo] |
| **Segmento** | [Indústria/Nicho] |
| **Tamanho** | [Nº funcionários / Faturamento] |
| **Localização** | [Cidade, Estado] |
| **Site** | [URL] |
| **Redes Sociais** | [LinkedIn, Instagram, etc.] |

### **👥 Stakeholders Envolvidos**

| Nome | Cargo | Papel na Decisão | Contato |
|------|-------|------------------|---------|
| [Nome] | [Cargo] | [Decisor/Influenciador/Usuário] | [Email/Tel] |
| [Nome] | [Cargo] | [Decisor/Influenciador/Usuário] | [Email/Tel] |

### **💼 Contexto do Negócio**

**Situação Atual:**
> [Descrição de 2-3 linhas sobre o momento da empresa, desafios, objetivos]

**Principais Objetivos:**
- [Objetivo 1]
- [Objetivo 2]
- [Objetivo 3]

**Sistemas e Ferramentas Atuais:**
- [Sistema 1]: [Como usam / Satisfação]
- [Sistema 2]: [Como usam / Satisfação]
- [Sistema 3]: [Como usam / Satisfação]

---

## 🎯 **DESCOBERTA DE NECESSIDADES**

### **💔 Dores Identificadas**

> [!danger] **DOR PRINCIPAL**
>
> **📝 Descrição:** [Qual é a dor principal mencionada?]
>
> **📊 Quantificação:** 
> - Tempo perdido: [X horas/dia ou X dias/mês]
> - Custo atual: [R$ X/mês ou R$ X/ano]
> - Oportunidades perdidas: [X vendas/mês ou R$ X/mês]
>
> **💰 Impacto no Negócio:**
> - [Como isso afeta o resultado da empresa?]
> - [Quais consequências diretas?]
>
> **⏰ Urgência:** [Alta/Média/Baixa] - [Por quê?]
>
> **📚 Citação Original:**
> > "[Citação literal do cliente sobre a dor]"
> > — [Nome do contato]

### **🔍 Dores Secundárias**

1. **[Dor 2]**
   - Descrição: [Breve descrição]
   - Impacto: [Como afeta]
   - Urgência: [Alta/Média/Baixa]

2. **[Dor 3]**
   - Descrição: [Breve descrição]
   - Impacto: [Como afeta]
   - Urgência: [Alta/Média/Baixa]

### **🎯 Objetivos do Cliente**

**Curto Prazo (0-3 meses):**
- [Objetivo 1]
- [Objetivo 2]

**Médio Prazo (3-6 meses):**
- [Objetivo 1]
- [Objetivo 2]

**Longo Prazo (6-12 meses):**
- [Objetivo 1]
- [Objetivo 2]

---

## 💬 **RESUMO DA CONVERSA**

### **[00:00-XX:XX] — Abertura e Rapport**

> [!abstract] **Resumo**
>
> [Como foi a abertura? Clima da conversa? Conexão estabelecida?]

**Principais Pontos:**
- [Ponto 1]
- [Ponto 2]

### **[XX:XX-XX:XX] — Descoberta de Necessidades**

> [!abstract] **Resumo**
>
> [Quais perguntas foram feitas? Como o cliente respondeu?]

**Perguntas Eficazes:**
1. **"[Pergunta 1]"** → Resposta: [Resumo da resposta]
2. **"[Pergunta 2]"** → Resposta: [Resumo da resposta]
3. **"[Pergunta 3]"** → Resposta: [Resumo da resposta]

**Informações Reveladas:**
- [Informação importante 1]
- [Informação importante 2]
- [Informação importante 3]

### **[XX:XX-XX:XX] — Apresentação da Solução**

> [!abstract] **Resumo**
>
> [O que foi apresentado? Como o cliente reagiu?]

**O Que Foi Apresentado:**
- [Feature/Benefício 1]
- [Feature/Benefício 2]
- [Feature/Benefício 3]

**Reações do Cliente:**
- ✅ **Positivas:** [O que gerou interesse?]
- ⚠️ **Neutras:** [O que não impressionou?]
- ❌ **Negativas:** [O que gerou dúvida/resistência?]

**Demonstração:**
- [x] Realizada | [ ] Não realizada
- **O que foi mostrado:** [Descrição]
- **Feedback:** [Como o cliente reagiu]

### **[XX:XX-XX:XX] — Objeções e Tratamento**

> [!warning] **Objeções Levantadas**

**OBJEÇÃO 1: "[Objeção literal]"**
- **Tipo:** [Preço/Produto/Timing/Confiança]
- **Resposta Dada:** [Como foi tratada]
- **Resultado:** [Resolvida/Parcialmente/Não resolvida]

**OBJEÇÃO 2: "[Objeção literal]"**
- **Tipo:** [Preço/Produto/Timing/Confiança]
- **Resposta Dada:** [Como foi tratada]
- **Resultado:** [Resolvida/Parcialmente/Não resolvida]

### **[XX:XX-XX:XX] — Proposta e Próximos Passos**

> [!success] **Encaminhamentos**

**Proposta Apresentada:**
- **Plano:** [Qual plano foi oferecido]
- **Valor:** [R$ X/mês ou R$ X/ano]
- **Condições:** [Forma de pagamento, trial, etc.]

**Reação à Proposta:**
- [Como o cliente reagiu ao valor/proposta?]

**Próximos Passos Definidos:**
1. [Ação 1] - Responsável: [Nome] - Prazo: [Data]
2. [Ação 2] - Responsável: [Nome] - Prazo: [Data]
3. [Ação 3] - Responsável: [Nome] - Prazo: [Data]

---

## 💎 **INSIGHTS E APRENDIZADOS**

### **🔴 INSIGHTS CRÍTICOS**

> [!danger] **I-001: [Título do Insight]**
>
> **📝 Descrição:** [Insight importante sobre vendas, produto ou mercado]
>
> **🎯 Aplicabilidade:** [Como usar em futuros contatos]
>
> **💰 Impacto Potencial:** [Qual o valor deste insight]

### **🟡 INSIGHTS DE VENDAS**

> [!warning] **V-001: [Técnica/Argumento que Funcionou]**
>
> **📝 O Que Foi:** [Descrição da técnica/argumento]
>
> **✅ Por Que Funcionou:** [Análise do sucesso]
>
> **🔄 Como Replicar:** [Passos para usar novamente]

### **🟢 INSIGHTS DE PRODUTO**

> [!tip] **P-001: [Necessidade/Feature Solicitada]**
>
> **📝 Descrição:** [O que o cliente pediu/sugeriu]
>
> **🎯 Relevância:** [Outros clientes têm essa necessidade?]
>
> **⚙️ Viabilidade:** [É possível implementar?]

### **📊 Padrões Identificados**

**Linguagem do Cliente:**
- Palavras-chave usadas: [palavra1, palavra2, palavra3]
- Termos técnicos: [termo1, termo2]
- Metáforas/Comparações: [exemplo1, exemplo2]

**Gatilhos de Interesse:**
- ✅ O que mais chamou atenção: [Feature/Benefício]
- ✅ Argumentos eficazes: [Argumento 1, Argumento 2]
- ✅ Cases que ressoaram: [Case 1, Case 2]

**Gatilhos de Resistência:**
- ❌ O que gerou dúvida: [Ponto 1, Ponto 2]
- ❌ Comparações com concorrentes: [Concorrente X, Y]
- ❌ Objeções recorrentes: [Objeção 1, Objeção 2]

---

## 🎯 **ANÁLISE ESTRATÉGICA**

### **💪 Pontos Fortes da Abordagem**

- [O que funcionou bem neste contato?]
- [Quais técnicas foram eficazes?]
- [O que deve ser replicado?]

### **⚠️ Pontos de Melhoria**

- [O que poderia ter sido feito diferente?]
- [Quais oportunidades foram perdidas?]
- [O que precisa ser ajustado?]

### **🎯 Estratégia de Follow-up**

**Abordagem Recomendada:**
- [Como abordar no próximo contato?]
- [Quais materiais enviar?]
- [Quais argumentos reforçar?]

**Timeline de Follow-up:**
- **Dia 1:** [Ação imediata após reunião]
- **Dia 3:** [Primeiro follow-up]
- **Dia 7:** [Segundo follow-up]
- **Dia 14:** [Terceiro follow-up]

### **🎁 Materiais de Apoio a Enviar**

- [ ] Proposta comercial
- [ ] Case de sucesso similar
- [ ] Vídeo demo específico
- [ ] Documentação técnica
- [ ] Trial/Ambiente de teste
- [ ] Planilha de ROI
- [ ] Outros: [especificar]

---

## 📝 **ENCAMINHAMENTOS**

### 🔥 **AÇÕES CRÍTICAS**

- [ ] **A-001: [Ação]** [[Responsável]] ⏫ 📅 YYYY-MM-DD 🏷️ #cliente #follow-up
  - Contexto: [Por que é crítica]
  - Critério de sucesso: [Como saber que foi bem feita]

### ⚡ **AÇÕES IMPORTANTES**

- [ ] **A-002: [Ação]** [[Responsável]] 🔼 📅 YYYY-MM-DD 🏷️ #cliente
  - Contexto: [Contexto da ação]
  - Critério de sucesso: [Resultado esperado]

### 🔵 **AÇÕES NORMAIS**

- [ ] **A-003: [Ação]** [[Responsável]] 🔽 📅 YYYY-MM-DD 🏷️ #cliente
  - Contexto: [Contexto da ação]

---

## 🔗 **INTEGRAÇÕES**

### **📋 Projetos Relacionados**
- **[[Projeto X]]**: [Como se relaciona]
- **[[Projeto Y]]**: [Como se relaciona]

### **👥 Pessoas Envolvidas**
- **[[Nome 1]]**: [Papel no follow-up]
- **[[Nome 2]]**: [Papel no follow-up]

### **📊 CRM/Pipeline**
- **Status no CRM:** [Atualizado/Pendente]
- **Próxima Etapa:** [Qual etapa do funil]
- **Probabilidade:** [%]

---

## 📚 **RECURSOS E REFERÊNCIAS**

### **📖 Documentos Relacionados**
- [[Link para proposta]]
- [[Link para case similar]]
- [[Link para documentação técnica]]

### **🎥 Gravação**
- [ ] Reunião gravada
- [ ] Transcrição disponível
- Link: [URL ou caminho do arquivo]

### **📝 Citações Importantes**

> "[Citação importante 1]"
> 
> — [Nome do contato], [Cargo]

> "[Citação importante 2]"
> 
> — [Nome do contato], [Cargo]

---

## ✅ **CHECKLIST DE QUALIDADE**

### **📊 Completude da Documentação**
- [ ] Perfil do cliente completo
- [ ] Dores identificadas e quantificadas
- [ ] Objeções documentadas e tratadas
- [ ] Próximos passos claros e com prazos
- [ ] Insights extraídos e categorizados

### **🎯 Qualificação do Lead**
- [ ] Score BANT calculado
- [ ] Fit do cliente avaliado
- [ ] Valor potencial estimado
- [ ] Probabilidade de fechamento definida
- [ ] Estratégia de follow-up planejada

### **📋 Ações de Follow-up**
- [ ] Ações criadas no CRM
- [ ] Responsáveis definidos
- [ ] Prazos estabelecidos
- [ ] Materiais preparados
- [ ] Próximo contato agendado

---

**📊 Última Atualização**: `= this.updated`  
**👤 Responsável Follow-up**: `= this.responsavel_followup`  
**🎯 Próxima Ação**: `= this.proxima_acao` | **📅 Prazo**: `= dateformat(this.prazo_proxima_acao, "dd/MM/yyyy")`

---

## 🔖 **TAGS DE BUSCA**

#cliente #vendas #contato #discovery #[produto] #[segmento] #[estagio-funil]
```

---

<a name="exemplos"></a>
## 💡 **6. EXEMPLOS PRÁTICOS**

### **EXEMPLO 1: DISCOVERY CALL - COWORKING**

**Tipo:** Discovery Call  
**Produto:** Chatbot  
**Resultado:** Qualificado - Demo agendada

**Dor Principal Identificada:**
- Perdem 1-2h/dia respondendo WhatsApp
- Interrompe atendimento presencial
- Perdem vendas fora do horário

**Técnica que Funcionou:**
- Pergunta de quantificação: "Quantas horas por dia vocês gastam com atendimentos?"
- Resposta: "Mais de 1 hora, às vezes 2"
- Conexão imediata com solução de automação

**Próximo Passo:**
- Demo agendada para mostrar integração com Conexa
- Enviar case da Versace (coworking similar)

---

### **EXEMPLO 2: DEMO - E-COMMERCE**

**Tipo:** Demonstração de Produto  
**Produto:** Chatbot + Integrações  
**Resultado:** Proposta enviada

**Objeção Principal:**
- "Nosso sistema é diferente, vai funcionar?"

**Como Foi Tratada:**
- Mostrou integração nativa com Shopify
- Desenvolvedor explicou API
- Ofereceu ambiente de teste

**Insight Extraído:**
- Integração nativa é diferencial competitivo
- Clientes têm medo de migração/duplicação de dados
- Demonstração técnica aumenta confiança

---

**Template criado em:** 25/11/2025  
**Versão:** R00  
**Autor:** UzzAI Team  
**Baseado em:** Templates R02, Garimpo, IVS SaaS Insights, Técnicas Wesley (Yodai)
