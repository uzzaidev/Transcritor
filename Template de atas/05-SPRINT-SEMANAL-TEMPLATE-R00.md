---
type: sprint
sprint: "{{date:YYYY}}-W{{date:WW}}"
semana: DD-MM a DD-MM
status: 🟡 Em Execução
prioridade: 🔥 Alta
objetivo_principal: "[Insira o Objetivo Principal aqui]"
acoes_planejadas: 0
acoes_concluidas: 0
velocity_sprint: 0
capacidade_time: Normal
owner: "[[Pedro Vitor Pagliarin]]"
tags:
  - sprint
  - tracking
  - planejamento
  - gestao-agil
created:
  "{ date }":
updated:
  "{ date }":
dg-publish: true
---

# 🏃 **SPRINT {{date:YYYY}}-W{{date:WW}}** — [TEMA/FOCO]

> [!abstract] **THE ONE THING (Objetivo Único)**
> **Meta:** `= this.objetivo_principal`
> **Por que agora?**: [Justificativa estratégica]
> **Owner:** `= this.owner`

---

## 🧪 **1. CONTRATO DE SPRINT (Intenção vs. Realidade)**
*(Preencher na Segunda-feira. Este é o compromisso inegociável da semana, independente do software)*

| ID | 🎯 Teste / Entrega Principal | Prioridade | Status Final | Obs (Por que falhou/sucesso?) |
|----|------------------------------|------------|--------------|-------------------------------|
| 01 | [Ex: Validar fluxo Chatbot] | 🔥 Alta | ⏳ | |
| 02 | [Ex: Landing Page V1] | 🟡 Média | ⏳ | |
| 03 | | 🔥 Alta | ⏳ | |
| 04 | | 🟡 Média | ⏳ | |
| 05 | | 🟢 Baixa | ⏳ | |

---

## 🔗 **2. ECOSSISTEMA DO SPRINT**
*(O que aconteceu no sistema durante esta semana - Automático via Dataview)*

### **📅 Reuniões & Atas Vinculadas**
*Inclui a Reunião Geral de Segunda que iniciou a semana.*

```dataview
TABLE 
  data as "Data",
  file.link as "Ata",
  projeto as "Projeto",
  status as "Status",
  sprint as "Sprint Tag"
FROM "40-Reunioes" OR "20-Projetos" OR "7-Conhecimento"
WHERE sprint = this.sprint
SORT data DESC
```

### **📊 Carga de Trabalho por Pessoa (Overview)**

```dataviewjs
// Filtro do Sprint
const sprintTag = "#sprint/" + dv.current().sprint.replace("Sprint-", "");
const sprintField = dv.current().sprint;
const tasks = dv.pages().file.tasks
  .where(t => t.text.includes(sprintField) || t.tags.includes(sprintTag) || t.sprint == sprintField);

// Agrupamento por Pessoa
const personStats = {};

tasks.forEach(t => {
    const match = t.text.match(/\[\[(.*?)\]\]/);
    const name = match ? match[1] : "Não Atribuído";
    
    if (!personStats[name]) personStats[name] = { total: 0, done: 0 };
    personStats[name].total++;
    if (t.completed) personStats[name].done++;
});

// Tabela
dv.table(
    ["Pessoa", "Total Tasks", "✅ Feitas", "⏳ Pendentes", "% Conclusão"],
    Object.keys(personStats).sort().map(p => {
        const s = personStats[p];
        const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
        return [`[[${p}]]`, s.total, s.done, s.total - s.done, `${pct}%`];
    })
);
```

### **📂 Distribuição por Projeto (Overview)**

```dataviewjs
// Filtro do Sprint (mesmo acima)
const sprintTag = "#sprint/" + dv.current().sprint.replace("Sprint-", "");
const sprintField = dv.current().sprint;
const tasks = dv.pages().file.tasks
  .where(t => t.text.includes(sprintField) || t.tags.includes(sprintTag) || t.sprint == sprintField);

// Mapeamento de Projetos (Tags ou Pastas)
const projectStats = {};

tasks.forEach(t => {
    // Tenta pegar projeto da tag #project/NOME ou do texto "project:NOME"
    let project = "Outros";
    
    // Busca tag #project/...
    const tagMatch = t.tags.find(tag => tag.includes("#project/"));
    if (tagMatch) {
        project = tagMatch.replace("#project/", "").toUpperCase();
    } 
    // Busca texto "project:NOME"
    else {
        const textMatch = t.text.match(/project:([^\s]+)/i);
        if (textMatch) {
            project = textMatch[1].toUpperCase().replace("PRJ-", "");
        }
    }

    if (!projectStats[project]) projectStats[project] = { total: 0, done: 0 };
    projectStats[project].total++;
    if (t.completed) projectStats[project].done++;
});

// Tabela
dv.table(
    ["Projeto", "Total Tasks", "✅ Feitas", "⏳ Pendentes", "% Conclusão"],
    Object.keys(projectStats).sort().map(p => {
        const s = projectStats[p];
        const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
        return [p, s.total, s.done, s.total - s.done, `${pct}%`];
    })
);
```

### **🧠 Decisões & ADRs Tomados**
*Decisões técnicas ou de negócio registradas nesta semana.*

```dataview
TABLE 
  decisao as "Decisão",
  status as "Status",
  impacto as "Impacto"
FROM "5-Processos/ADRs" OR "20-Projetos" OR "40-Reunioes"
WHERE (sprint = this.sprint) AND tipo = "adr"
```

---

## 🏆 **3. PERFORMANCE & ENTREGAS (Concluído)**
*(O que efetivamente foi entregue e marcado como 'DONE' nesta semana)*

```dataview
TASK
FROM ""
WHERE completed AND (contains(tags, "#sprint/{{date:YYYY}}-W{{date:WW}}") OR sprint = this.sprint OR contains(text, this.sprint))
GROUP BY file.link
```

---

## 👥 **4. VISÃO POR PESSOA (Workload Detalhado)**
*(Quem está fazendo o quê neste Sprint - Detalhado)*

```dataviewjs
// Filtro do Sprint
const sprintTag = "#sprint/" + dv.current().sprint.replace("Sprint-", "");
const sprintField = dv.current().sprint;
const tasks = dv.pages().file.tasks
  .where(t => !t.completed && (t.text.includes(sprintField) || t.tags.includes(sprintTag) || t.sprint == sprintField));

// Agrupamento manual por regex de link [[Nome]]
const tasksByPerson = {};
const noPerson = [];

tasks.forEach(t => {
    const match = t.text.match(/\[\[(.*?)\]\]/);
    if (match) {
        const name = match[1];
        if (!tasksByPerson[name]) tasksByPerson[name] = [];
        tasksByPerson[name].push(t);
    } else {
        noPerson.push(t);
    }
});

// Renderiza ordenado por nome
const sortedNames = Object.keys(tasksByPerson).sort();
for (const person of sortedNames) {
    dv.header(3, "👤 " + person);
    dv.taskList(tasksByPerson[person], false);
}

if (noPerson.length > 0) {
    dv.header(3, "⚠️ Sem Responsável Definido");
    dv.taskList(noPerson, false);
}
```

---

## 📂 **5. VISÃO POR PROJETO (Detalhado)**
*(Onde estamos gastando energia)*

```dataview
TASK
FROM ""
WHERE !completed AND (contains(tags, "#sprint/{{date:YYYY}}-W{{date:WW}}") OR sprint = this.sprint OR contains(text, this.sprint))
GROUP BY regexreplace(file.folder, "^.*?\/", "")
```

---

## 📋 **6. BACKLOG GERAL (Sprint Backlog)**

### **🔥 Prioridade Absoluta (Do Now)**
*(Lista completa ordenada por prioridade)*

```dataview
TASK
FROM ""
WHERE !completed AND (contains(tags, "#sprint/{{date:YYYY}}-W{{date:WW}}") OR sprint = this.sprint OR contains(text, this.sprint))
GROUP BY file.link
SORT priority DESC
```

### **🚧 Bloqueios Ativos**
*(O que está travando o progresso agora)*

```dataview
TASK
FROM ""
WHERE !completed AND contains(tags, "#bloqueio") AND (contains(tags, "#sprint/{{date:YYYY}}-W{{date:WW}}") OR sprint = this.sprint OR contains(text, this.sprint))
```

---

## 🔄 **7. RETROSPECTIVA (Fechamento)**

### **📊 Scorecard da Semana**

```dataviewjs
const p = dv.current();
const planejadas = p.acoes_planejadas || 0;
const concluidas = p.acoes_concluidas || 0;
const velocity = planejadas > 0 ? Math.round((concluidas / planejadas) * 100) : 0;

dv.paragraph(`
| Métrica | Valor | Status |
|---------|-------|--------|
| **Planejadas** | ${planejadas} | — |
| **Entregues** | ${concluidas} | — |
| **Velocity Real** | **${velocity}%** | ${velocity >= 80 ? '🟢 Excelente' : velocity >= 60 ? '🟡 Bom' : '🔴 Atenção'} |
`);
```

### **💡 Análise de Causa (Feedback Loop)**

1. **O que nós prometemos e NÃO entregamos? Por que?**
   - *R:* 

2. **O que surgiu de "Gargalo" ou "Imprevisto"? (Lição para Planning)**
   - *R:* 

3. **Ação Prática para o Próximo Sprint:**
   - [ ] 

---
**Status Final:** #sprint/em_andamento