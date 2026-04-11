---
tipo: weekly-review
versao: "1.0"
semana: YYYY-WXX
periodo: YYYY-MM-DD a YYYY-MM-DD
sprint: "[[Sprint-YYYY-WXX]]"
created:
  "{ date:YYYY-MM-DD }":
updated:
  "{ date:YYYY-MM-DD }":
autor: "{{author}}"
status: rascunho
tags:
  - weekly-review
  - bullet-journal
  - compilado-semanal
dg-publish: false
---

# 📊 **WEEKLY REVIEW** — Semana XX/YYYY (DD/MM - DD/MM)

> [!abstract] **Propósito desta Weekly Review**
> Consolidar conquistas, decisões e aprendizados da semana para:
> 1. Preparar a reunião geral de segunda-feira
> 2. Identificar padrões e tendências
> 3. Documentar progresso em projetos estratégicos
> 4. Capturar lições aprendidas antes de esquecer

---

## 🤖 **INSTRUÇÕES PARA LLM (Claude/Cursor)**

> [!tip] **Como Usar Este Template**
>
> **Para Claude Code / Cursor:**
> 1. Abra este arquivo no sábado ou domingo
> 2. Execute o comando abaixo para coletar contexto automático
> 3. Analise os documentos listados na seção "Auto-Contexto"
> 4. Preencha as seções seguintes com base nos dados coletados
> 5. Mantenha foco em **insights estratégicos**, não apenas listar atividades
>
> **Comando Sugerido (adapte conforme necessário):**
> ```
> Analise todos os documentos modificados/criados na última semana ({{periodo}})
> nas pastas 40-Reunioes/, 20-Projetos/, 30-Sprints/ e compile:
> 1. Decisões críticas tomadas (ADRs, escolhas estratégicas)
> 2. Conquistas principais (entregas, milestones)
> 3. Kaizens e lições aprendidas
> 4. Bloqueios ativos e riscos emergentes
> 5. Pessoas-chave com quem interagimos
> 6. Próximos passos para a semana seguinte
>
> Gere o conteúdo seguindo a estrutura deste template,
> priorizando qualidade sobre quantidade.
> ```

---

## 📂 **AUTO-CONTEXTO DA SEMANA** (Gerado Automaticamente)

> [!info] **Documentos Relevantes da Semana**
> Esta seção usa Dataview para listar automaticamente o que aconteceu.
> **LLM: Use esta lista como ponto de partida para análise.**

### **ATAs de Reuniões Criadas**

```dataview
TABLE
  tipo AS "Tipo",
  projeto AS "Projeto",
  duracao AS "Duração",
  decisoes_count AS "Decisões",
  efetividade_reuniao AS "Efetividade"
FROM "40-Reunioes"
WHERE tipo = "ata-projeto" OR tipo = "ata-geral"
  AND file.cday >= date({{semana-inicio}})
  AND file.cday <= date({{semana-fim}})
SORT file.cday DESC
```

**Links Diretos:**
- [[40-Reunioes/XX - Nome/YYYY-MM-DD-Titulo.md|Reunião 1]]
- [[40-Reunioes/XX - Nome/YYYY-MM-DD-Titulo.md|Reunião 2]]
- *(LLM: Adicionar automaticamente com base na query acima)*

---

### **Projetos Atualizados**

```dataview
TABLE
  status AS "Status",
  fase AS "Fase",
  responsavel AS "Owner",
  file.mday AS "Última Atualização"
FROM "20-Projetos"
WHERE file.mday >= date({{semana-inicio}})
  AND file.mday <= date({{semana-fim}})
SORT file.mday DESC
```

**Dashboards-Chave:**
- [[CHATBOT-PROJECT-DASHBOARD|Chatbot Dashboard]]
- [[20-Projetos/SITE BUILDER/SITE-BUILDER-PROJECT-DASHBOARD.md|Site Builder Dashboard]]
- *(LLM: Adicionar com base na query acima)*

---

### **Sprint da Semana**

**Sprint Atual:** [[Sprint-YYYY-WXX]]

```dataview
TABLE
  objetivo AS "Objetivo",
  meta_entregas AS "Meta Entregas",
  status AS "Status"
FROM "30-Sprints"
WHERE file.name = "Sprint-YYYY-WXX"
```

---

### **Pessoas com Quem Interagimos**

```dataview
TABLE
  papel AS "Papel",
  participacao AS "% Participação",
  file.inlinks AS "# Menções"
FROM "10-Pessoas"
WHERE file.inlinks
  AND file.mday >= date({{semana-inicio}})
SORT file.inlinks DESC
LIMIT 10
```

**Top 5 Colaboradores:**
- [[Luis Fernando Boff]] — *Tech Lead*
- [[Arthur Brandalise]] — *Dev Frontend*
- *(LLM: Completar com base na query acima)*

---

## 🎯 **CONQUISTAS DA SEMANA**

> [!success] **O que entregamos de valor?**

### **Entregas Principais (Milestones)**

🎯 **M-001 — [Nome do Milestone]**
- **Projeto:** [[20-Projetos/NOME/]]
- **Descrição:** [O que foi entregue]
- **Impacto:** [Alto/Médio/Baixo] — [Justificativa]
- **Participantes:** @[[Pessoa1]], @[[Pessoa2]]

🎯 **M-002 — [Outro Milestone]**
- **Projeto:** [[20-Projetos/NOME/]]
- **Descrição:** [...]
- **Impacto:** [...]

---

### **ATAs Criadas e Efetividade**

| ATA | Projeto | Decisões | Kaizens | Efetividade | Link |
|-----|---------|----------|---------|-------------|------|
| Reunião Técnica Mobile | CHATBOT | 8 | 12 | 10/10 | [[20-Projetos/UzzApp/01 - REUNIÕES PROJETO/2025-11-19-Reuniao-Alinhamento-Tecnico-Mobile\|Link]] |
| *[LLM: Preencher com dados da query acima]* | | | | | |

**Média de Efetividade:** [X/10] *(calculado automaticamente)*

---

### **Dashboards Atualizados**

- ✅ [[CHATBOT-PROJECT-DASHBOARD]] — Última atualização: DD/MM
- ✅ [[SITE-BUILDER-PROJECT-DASHBOARD.md]] — Última atualização: DD/MM
- ✅ [[DASHBOARD-UZZAI-CENTRAL]] — Última atualização: DD/MM
- *(LLM: Adicionar com base em file.mday)*

---

## 💡 **DECISÕES CRÍTICAS (ADRs da Semana)**

> [!important] **Decisões Arquiteturais e Estratégicas**

### **D-001 — [Decisão Crítica 1]**

**Contexto:**
> [Situação que levou à decisão]

**Decisão Tomada:**
> [O que foi decidido]

**Consequências:**
- ✅ **Benefícios:** [Lista]
- ⚠️ **Trade-offs:** [Lista]
- 🔄 **Reversibilidade:** [Alta/Média/Baixa]

**Impacto em Projetos:**
- [[Projeto X]]: [Descrição do impacto]
- [[Projeto Y]]: [Descrição do impacto]

**ADR Relacionado:** [[ADR-YYYYMMDD-slug]]

---

### **D-002 — [Decisão Crítica 2]**

*(LLM: Replicar estrutura acima para cada decisão importante)*

---

## 📚 **KAIZENS & LIÇÕES APRENDIDAS**

> [!quote] **Aprendizados da Semana**
> "O que aprendemos esta semana que não queremos esquecer?"

### **KAIZENS TÉCNICOS**

#### **K-001 — [Lição Técnica 1]**

**Contexto:**
> [Situação específica]

**Aprendizado:**
- ✅ **Fazer:** [O que funcionou]
- ❌ **Evitar:** [O que não funcionou]
- 🔄 **Melhorar:** [Como iterar]

**Regra de Ouro:**
> "[Frase memorável que resume o aprendizado]"

**Aplicação Futura:**
- [[Projeto X]]: [Como aplicar]
- [[Processo Y]]: [Como melhorar]

---

### **KAIZENS PROCESSUAIS**

#### **K-002 — [Lição de Processo]**

*(LLM: Replicar estrutura acima)*

---

### **KAIZENS ESTRATÉGICOS**

#### **K-003 — [Lição Estratégica]**

*(LLM: Replicar estrutura acima)*

---

## 🚨 **BLOQUEIOS & RISCOS ATIVOS**

> [!danger] **Impedimentos que Precisam de Ação**

### **Bloqueios Críticos (Ação Imediata)**

🔴 **B-001 — [Bloqueio Crítico]**
- **Projeto:** [[20-Projetos/NOME/]]
- **Descrição:** [O que está bloqueado]
- **Impacto:** [Alto/Médio] — [Consequência se não resolver]
- **Owner:** @[[Pessoa Responsável]]
- **Próximo Passo:** [Ação concreta + prazo]
- **Status:** ⏳ Aguardando | 🔄 Em Progresso | ✅ Resolvido

---

### **Riscos Emergentes (Monitorar)**

⚠️ **R-001 — [Risco Identificado]**
- **Probabilidade:** [1-5]
- **Impacto:** [1-5]
- **Severidade:** [Calculado: P × I]
- **Descrição:** [Risco potencial]
- **Mitigação Planejada:** [Como prevenir/reduzir]
- **Owner:** @[[Pessoa]]

---

## 📊 **ANALYTICS DA SEMANA**

> [!info] **Métricas Consolidadas**

### **Produtividade Geral**

| Métrica | Valor | Comparação Semana Anterior |
|---------|-------|----------------------------|
| **Reuniões realizadas** | N | ↗️ +X% / ↘️ -X% / → Igual |
| **ATAs criadas** | N | |
| **Decisões críticas** | N | |
| **Kaizens capturados** | N | |
| **Dashboards atualizados** | N | |
| **Bloqueios resolvidos** | N | |
| **Efetividade média reuniões** | X/10 | |

---

### **Distribuição de Tempo por Projeto**

```dataview
TABLE
  sum(rows.duracao_min) AS "Tempo Total (min)"
FROM "40-Reunioes"
WHERE file.cday >= date({{semana-inicio}})
  AND file.cday <= date({{semana-fim}})
GROUP BY projeto
SORT sum(rows.duracao_min) DESC
```

**Interpretação (LLM: Analisar):**
- Projeto X consumiu Y% do tempo → [É esperado? Está alinhado com prioridades?]
- Projeto Z teve pouco foco → [Precisa de mais atenção? Está pausado intencionalmente?]

---

### **Engajamento de Pessoas**

**Top 5 Colaboradores da Semana:**

| Nome | Reuniões | Decisões | Contribuição Principal |
|------|----------|----------|------------------------|
| [[Pessoa 1]] | N | N | [Descrição breve] |
| [[Pessoa 2]] | N | N | [Descrição breve] |
| *(LLM: Completar com dados)* | | | |

---

## 🔄 **PROGRESSO EM PROJETOS ESTRATÉGICOS**

> [!tip] **Status de Alto Nível**

### **[[CHATBOT-PROJECT-DASHBOARD|CHATBOT]]**

**Status:** 🟢 No Prazo | 🟡 Atenção | 🔴 Atrasado

**Progresso da Semana:**
- ✅ [Conquista 1]
- ✅ [Conquista 2]
- ⏳ [Em andamento]

**Decisões Importantes:**
- [[#D-001]] — [Breve resumo]

**Bloqueios:**
- [[#B-001]] — [Se houver]

**Próxima Semana:**
- [ ] [Prioridade 1]
- [ ] [Prioridade 2]

---

### **[[20-Projetos/SITE BUILDER/SITE-BUILDER-PROJECT-DASHBOARD.md|SITE BUILDER]]**

*(LLM: Replicar estrutura acima para cada projeto ativo)*

---

### **[[DASHBOARD-UZZAI-CENTRAL|UZZAI (Geral)]]**

*(LLM: Replicar estrutura acima)*

---

## 🎯 **PLANEJAMENTO SEMANA SEGUINTE**

> [!success] **Foco e Prioridades**

### **Top 3 Prioridades da Próxima Semana**

**Sprint:** [[Sprint-YYYY-W(XX+1)]]

1. **[Prioridade 1]** — [[Projeto]] — Owner: @[[Pessoa]]
   - **Por quê é prioridade:** [Justificativa estratégica]
   - **Critério de sucesso:** [Como saberemos que foi bem-sucedido]

2. **[Prioridade 2]** — [[Projeto]] — Owner: @[[Pessoa]]
   - **Por quê é prioridade:** [...]
   - **Critério de sucesso:** [...]

3. **[Prioridade 3]** — [[Projeto]] — Owner: @[[Pessoa]]
   - **Por quê é prioridade:** [...]
   - **Critério de sucesso:** [...]

---

### **Reuniões Agendadas**

| Data | Horário | Tipo | Projeto | Participantes | Objetivo |
|------|---------|------|---------|---------------|----------|
| Segunda DD/MM | HH:MM | Reunião Geral | UZZAI | Time Completo | Alinhamento semanal |
| [Data] | [Hora] | [Tipo] | [Projeto] | [Pessoas] | [Objetivo] |

---

### **Ações Migradas (da Semana Anterior)**

> [!warning] **Tarefas Não Concluídas que Precisam Migração**

- > • [Tarefa migrada 1] — [[Projeto]] — @[[Pessoa]] — **Justificativa:** [Por que não foi feita]
- > • [Tarefa migrada 2] — [[Projeto]] — @[[Pessoa]] — **Justificativa:** [...]

**Análise de Migrações:**
- Se > 30% das tarefas foram migradas → [Sinal de sobrecarga ou má estimativa]
- Se < 10% → [Boa previsibilidade]

---

## 💬 **REFLEXÃO SEMANAL**

> [!quote] **Perguntas de Retrospectiva**

### **O que funcionou bem?**
1. [Ponto positivo 1]
2. [Ponto positivo 2]
3. [Ponto positivo 3]

### **O que não funcionou?**
1. [Problema 1]
2. [Problema 2]
3. [Problema 3]

### **O que vamos melhorar na próxima semana?**
1. [Melhoria específica 1] — **Como medir:** [métrica]
2. [Melhoria específica 2] — **Como medir:** [métrica]
3. [Melhoria específica 3] — **Como medir:** [métrica]

### **Surpresas da semana (boas ou ruins)?**
- [Evento inesperado que impactou a semana]

---

## 📝 **PREPARAÇÃO PARA REUNIÃO GERAL (Segunda-feira)**

> [!tip] **Insumos para a Weekly Meeting**

### **Resumo Executivo (1 minuto)**

**Conquistas:**
- [Bullet 1]
- [Bullet 2]

**Bloqueios:**
- [Bullet 1]

**Foco Semana Seguinte:**
- [Bullet 1]
- [Bullet 2]

---

### **Tópicos para Discussão**

1. **[Tópico 1]** — [[Projeto]] — *Precisa decisão do time*
2. **[Tópico 2]** — [[Projeto]] — *Atualização importante*
3. **[Tópico 3]** — *Geral* — *Processo/metodologia*

---

### **Materiais de Apoio**

- [[ATA importante da semana]]
- [[Dashboard atualizado]]
- [[Planilha de custos]]

---

## 🔗 **LINKS & REFERÊNCIAS**

### **Documentos-Chave da Semana**

- [[40-Reunioes/XX - Tema/YYYY-MM-DD-Titulo.md|ATA 1]]
- [[40-Reunioes/XX - Tema/YYYY-MM-DD-Titulo.md|ATA 2]]
- [[20-Projetos/NOME/DOC-IMPORTANTE.md|Documento Técnico]]

### **Sprints Relacionadas**

- **Atual:** [[Sprint-YYYY-WXX]]
- **Anterior:** [[Sprint-YYYY-W(XX-1)]]
- **Próxima:** [[Sprint-YYYY-W(XX+1)]]

### **Pessoas-Chave Mencionadas**

```dataview
TABLE
  papel AS "Papel",
  file.inlinks AS "# Menções"
FROM "10-Pessoas"
WHERE contains(file.inlinks, this.file.name)
SORT file.inlinks DESC
```

---

## 📊 **CHECKLIST DE VALIDAÇÃO**

> [!check] **Antes de Finalizar a Weekly Review**

### **Qualidade do Conteúdo**
- [ ] **Decisões críticas** estão documentadas com contexto completo
- [ ] **Kaizens** têm aplicação prática (não são genéricos)
- [ ] **Bloqueios** têm owner e próximo passo definido
- [ ] **Métricas** foram atualizadas com dados reais
- [ ] **Prioridades da próxima semana** estão claras e justificadas

### **Rastreabilidade**
- [ ] Todas as ATAs da semana estão linkadas
- [ ] Dashboards de projetos foram verificados
- [ ] Sprint da semana está correta no frontmatter
- [ ] Pessoas mencionadas têm links corretos

### **Preparação para Reunião**
- [ ] Resumo executivo está pronto (1 minuto)
- [ ] Tópicos para discussão estão priorizados
- [ ] Materiais de apoio estão acessíveis

### **Reflexão Estratégica**
- [ ] Respondemos "Por que isso importa?" para cada conquista
- [ ] Identificamos padrões (não apenas listamos atividades)
- [ ] Definimos **pelo menos 1 melhoria concreta** para próxima semana

---

## 📈 **SCORE DA SEMANA**

> [!info] **Auto-Avaliação (1-10)**

**Efetividade Geral:** [X/10]

**Critérios:**
- **Conquistas vs Planejado:** [X/10] — [Entregamos o que prometemos?]
- **Qualidade das Decisões:** [X/10] — [Decisões bem fundamentadas?]
- **Captura de Aprendizado:** [X/10] — [Kaizens relevantes?]
- **Resolução de Bloqueios:** [X/10] — [Desbloqueamos impedimentos?]

**Nota Média:** [(soma/4)] / 10

**Interpretação:**
- 8-10: Semana excepcional
- 6-7: Semana produtiva
- 4-5: Semana normal com desafios
- 1-3: Semana difícil (requer análise de causas)

---

## 🎓 **GUIA DE USO DO TEMPLATE**

### **Como Preencher (Sábado ou Domingo)**

**Tempo estimado:** 45-60 minutos

1. **[10 min] Setup Inicial:**
   - Copiar template para `6-Bullet Journal/YYYY/MM-MesNome/Week-XX-Review.md`
   - Preencher frontmatter (semana, período, sprint)
   - Ajustar queries Dataview com datas corretas

2. **[20 min] Coleta de Contexto:**
   - Executar queries Dataview para listar documentos
   - Revisar ATAs criadas na semana (leitura rápida)
   - Verificar dashboards de projetos
   - Listar decisões e kaizens já documentados

3. **[15 min] Análise e Síntese:**
   - Identificar **padrões** (não apenas listar)
   - Extrair decisões críticas e contexto
   - Consolidar kaizens mais importantes
   - Mapear bloqueios ativos

4. **[10 min] Planejamento:**
   - Definir Top 3 da próxima semana
   - Preparar resumo executivo para reunião
   - Listar tópicos para discussão

5. **[5 min] Validação:**
   - Passar pelo checklist
   - Calcular score da semana
   - Publicar/compartilhar com time

---

### **Customizações por Contexto**

**Para CEOs/Founders:**
- Foco em: Decisões estratégicas, OKRs, visão de mercado
- Adicionar seção: Conversas com clientes/investidores

**Para Tech Leads:**
- Foco em: ADRs, débito técnico, qualidade de código
- Adicionar seção: Revisões de arquitetura

**Para Product Managers:**
- Foco em: Feedback de usuários, roadmap, métricas de produto
- Adicionar seção: Experimentos rodados

---

### **Dicas de Produtividade**

1. **Use Claude/Cursor para primeira passada:**
   - LLM faz análise inicial dos documentos
   - Você refina e adiciona contexto humano

2. **Mantenha foco em insights, não atividades:**
   - ❌ "Fizemos 3 reuniões sobre chatbot"
   - ✅ "Decidimos usar Capacitor (vs React Native) porque reduz time-to-market em 2-3 semanas"

3. **Conecte passado → presente → futuro:**
   - Kaizen da semana passada → Aplicado esta semana → Resultados observados

4. **Use a Weekly Review como insumo:**
   - Reunião geral de segunda
   - 1-on-1s com time
   - Relatórios mensais para investidores

---

## 📚 **RECURSOS ADICIONAIS**

### **Templates Relacionados**
- [[_TEMPLATES/06-BULLETJOURNAL-TEMPLATE.md|Bullet Journal Diário]]
- [[_TEMPLATES/00 - ATA-REUNIÃO-TEMPLATE-R02.md|ATA Reunião Geral]]
- [[_TEMPLATES/01-ATA-PROJETO-TEMPLATE-R01.md|ATA Projeto]]

### **Exemplo Prático**
- [[6-Bullet Journal/2025/11-Novembro/Week-47-Review.md|Week 47 Review (Exemplo)]]

### **No Vault**
- [[README]] — Estrutura geral do vault
- [[DASHBOARD-UZZAI-CENTRAL]] — Visão executiva
- [[30-Sprints/]] — Sprints semanais

---

**📊 Template Version:** 1.0
**👤 Criado por:** Pedro Vitor Pagliarin (com assistência Claude)
**🔄 Última Atualização:** 19/11/2025
**🎯 Objetivo:** Consolidar semana em 1h (sábado/domingo) para reunião de segunda

---

*"Uma hora de reflexão no fim de semana economiza 10 horas de retrabalho na semana seguinte."*
