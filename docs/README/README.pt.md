# OpenCode Orchestrator Plugin (PT)

> **Plugin de Colaboração Multi-Agente para [OpenCode](https://opencode.ai)**

<div align="center">

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
[![npm](https://img.shields.io/npm/v/@agnusdei1207/opencode-orchestrator.svg)](https://www.npmjs.com/package/@agnusdei1207/opencode-orchestrator)
[![npm downloads](https://img.shields.io/npm/dt/@agnusdei1207/opencode-orchestrator.svg)](https://www.npmjs.com/package/@agnusdei1207/opencode-orchestrator)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-purple.svg)](https://opencode.ai)

[English](../../README.md) | [한국어](README.ko.md) | [简体中文](README.zh.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md)
[Русский](README.ru.md) | [Português](README.pt.md)

</div>

---

## O que é isto?

Um sistema colaborativo de 6 agentes que maximiza a **Orquestração de Agentes** para extrair a **Qualidade de Decisão Suprema (Ultimate Decision Quality)** de **modelos acessíveis e de menor desempenho**.

**Ideia central**: Ao organizar estrategicamente os papéis, dividir o trabalho em micro-tarefas e impor regras de verificação rigorosas, alcançamos resultados de "Modelo Caro" com custos de "Modelo Econômico".

---

## Por que Orchestrator?

| Tradicional | Com Orchestrator |
|-------------|-------------------|
| Requer Modelo "Inteligente" caro | **Modelo Acessível + Processo Inteligente** |
| Altos Custos de Token (Contexto enorme) | **Eficiência de Token** (Contexto filtrado) |
| Execução linear e lenta | **Execução Paralela e Rápida** |
| Erros acumulam-se silenciosamente | **Loops de Verificação e Autocorreção** |
| "Espero que funcione" | **Micro-Gerenciamento Estratégico** |

---

- **🧩 Organização Estratégica** — Maximizando a produção através de distribuição inteligente de papéis
- **📉 Economia de Tokens** — Filtrando ruído para reduzir custos e aumentar o foco
- **⚡ DAG Paralelo** — Execução simultânea para velocidade e eficiência
- **🔍 Micro-Tarefamento** — Decomposição atômica para prevenir alucinações
- **🛡️ Guardião de Estilo** — Linting rigoroso baseado em AST e verificações de consistência
- **🔄 Auto-Cura** — Estratégias de pivô autônomas para erros complexos
- **🏗️ Core em Rust** — Desempenho nativo para tarefas pesadas

---

## Como Funciona (DAG Paralelo)

Em vez de uma sequência linear, usamos um **Grafo Acíclico Dirigido (DAG)** para modelar sua missão.

```
      Início da Missão (/dag)
              │
              ▼
      ┌───────────────┐
      │   PLANNER     │ (Arquiteto)
      └───────┬───────┘
              │
      ┌───────┴───────┐
      │               │ (Fluxos Paralelos)
      ▼               ▼
 ┌───────────┐   ┌───────────┐
 │ Tarefas (A)│   │ Tarefas (B)│
 └─────┬─────┘   └─────┬─────┘
       │               │
       └───────┬───────┘
               ▼
       ┌───────────────┐
       │   REVIEWER    │ (Guardião de Estilo)
       └───────┬───────┘
               ▼
           ✅ MISSÃO COMPLETA
```

---

## Instalação

Você pode usar **npm** ou **bun**. Ambos funcionam perfeitamente porque a lógica central é executada em um **binário nativo Rust**.

### Opção 1: npm (Padrão)
```bash
npm install -g opencode-orchestrator
```

### Opção 2: Bun (Rápido)
```bash
bun install -g opencode-orchestrator
```

> **Nota**: Após a instalação, **reinicie o OpenCode** ou execute `opencode` no seu terminal.
> O plugin será registrado automaticamente em `~/.config/opencode/opencode.json` com seu caminho absoluto.

### Solução de Problemas
Se o comando `/dag` não aparecer:
1. Desinstalar: `npm uninstall -g opencode-orchestrator` (ou `bun remove -g`)
2. Limpar configuração: `rm -rf ~/.config/opencode` (Aviso: redefine todos os plugins)
3. Reinstalar: `npm install -g opencode-orchestrator`

---

**O único comando que você precisa:**

```bash
/dag "Implement user authentication with JWT"
```

O Orchestrator irá:
1. **Decompor (Decompose)** a missão em um DAG de tarefas JSON
2. **Executar em Paralelo (Parallel Execute)** fluxos independentes
3. **Buscar (Search)** proativamente padrões de código
4. **Codificar (Code)** com precisão atômica
5. **Verificar (Verify)** via Guardião de Estilo (OBRIGATÓRIO)
6. **Autocorrigir (Self-Heal)** se ocorrerem erros

---

## Agentes

| Agente | Papel |
|--------|-------|
| **Orchestrator** | Líder da equipe — coordena, decide, adapta |
| **Planner** | Divide o trabalho em tarefas atômicas |
| **Coder** | Implementa uma tarefa de cada vez |
| **Reviewer** | Portão de qualidade — detecta todos os erros e problemas de sincronização |
| **Fixer** | Resolução de erros direcionada |
| **Searcher** | Encontra contexto antes de codificar |

---

- [Mergulho Profundo na Arquitetura](../ARCHITECTURE.md) — Como o DAG funciona
- [Configuração](../../examples/orchestrator.jsonc) — Personalizar configurações

---

## Código Aberto

Licença MIT. Sem telemetria. Sem backdoors.

[github.com/agnusdei1207/opencode-orchestrator](https://github.com/agnusdei1207/opencode-orchestrator)

---

## Nota do Autor

> Meu objetivo é provar que **modelos acessíveis** podem produzir resultados tão bons quanto APIs caras — quando você estrutura o trabalho corretamente.
>
> Divida as tarefas, verifique cada etapa, corrija erros automaticamente. O modelo não precisa ser inteligente. O processo precisa ser disciplinado.
>
> — [@agnusdei1207](https://github.com/agnusdei1207)

---

## Licença

Licença MIT. SEM GARANTIA.

[MIT](../../LICENSE)

---

## 🏛️ Filosofia do Projeto: A Grande Fusão de Arquiteturas

Este projeto é uma **sinfonia dos maiores sucessos da Ciência da Computação**. Não é apenas um script de chatbot; é uma **fusão colaborativa** de algoritmos avançados e padrões arquitetônicos.

Projetamos explicitamente este sistema integrando **princípios de Kernel de Sistema Operacional (Agendamento), Computação Distribuída (Sharding de Estado) e Eficiência Algorítmica (Dividir e Conquistar, Programação Dinâmica)**. Ao orquestrar esses conceitos poderosos juntos, superamos as limitações de modelos de IA individuais através da **Superioridade Arquitetônica**.

Tratamos a orquestração de agentes como um **problema de computação distribuída**, extraindo cada gota de inteligência de modelos acessíveis. e de menor desempenho** (como modelos locais ou APIs econômicas) podem alcançar **Qualidade de Decisão Suprema** quando organizados corretamente. Conseguimos isso imitando uma equipe de engenharia humana de alto desempenho.

### O Molho Secreto: Eficiência Extrema

1.  **Micro-Gerenciamento (A Estratégia de "Dispersão")**: Não pedimos ao modelo para "construir um site". Nós o dividimos em mudanças atômicas de 20 linhas. Pequeno contexto = Alta precisão = Baixa alucinação.
2.  **Execução e Verificação Paralela**: Ao executar tarefas independentes em paralelo, reduzimos o tempo real.
3.  **Economia de Tokens**: Filtramos estritamente o contexto. Os agentes não leem toda a base de código; eles leem *atualizações* e *resumos*. Isso corta drasticamente os custos de tokens enquanto mantém a precisão.
4.  **Verificação Implacável**: Aceitamos que modelos baratos cometem erros. O agente **Reviewer** existe apenas para pegá-los. Trocamos um pouco de tempo de computação por 100% de confiabilidade.

### O Fluxo de Trabalho de Eficiência de 5 Fases

1.  **🧠 Fase 1: Análise Filtrada**: O **Searcher** lê a documentação, mas filtra o ruído. Apenas alimentamos o "caminho crítico" para o Planner.
2.  **🌲 Fase 2: Planejamento Estratégico**: O **Planner** cria um DAG JSON. Este é o nosso roteiro. Nenhum token é desperdiçado em divagações sem rumo.
3.  **🚀 Fase 3: Execução Paralela**: O **Orchestrator** identifica tarefas independentes e as executa simultaneamente.
4.  **🛡️ Fase 4: Sincronização e Verificação**: O **Reviewer** atua como guardião. Ele verifica sintaxe, lógica e *consistência entre arquivos*.
5.  **💰 Fase 5: Conclusão Custo-Efetiva**: Alcançamos resultados de "Desenvolvedor Sênior" a preços de "Estagiário Júnior".

---

## ⚡ Desenvolvimento Rápido

Este projeto está evoluindo **extremamente rápido**. Nós iteramos rapidamente para trazer a execução implacável ao seu fluxo de trabalho.
As atualizações são frequentes. Mantenha sua versão atualizada.
