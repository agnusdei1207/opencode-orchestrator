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

Um sistema colaborativo de 6 agentes que transforma até **modelos de menor desempenho** em uma equipe de codificação altamente confiável.

**Ideia central**: Dividir tarefas complexas em unidades atômicas, verificar cada etapa e corrigir erros automaticamente.

---

## Por que Orchestrator?

| Tradicional | Com Orchestrator |
|-------------|------------------|
| Um grande prompt → Torcer para funcionar | Tarefas atômicas → Verificadas em cada etapa |
| Requer modelo caro | Modelos fixos e acessíveis funcionam |
| Erros se acumulam silenciosamente | Loop de autocorreção (Self-correcting) |
| Resultados imprevisíveis | **Estratégia de execução implacável** |

---

- **🧩 Orquestração DAG Paralela** — Execução simultânea de tarefas independentes
- **🎯 Otimização de Modelo Fixo** — Alta confiabilidade mesmo com LLMs de baixo desempenho
- **🦀 Núcleo em Rust** — Ferramentas de busca e análise nativas, rápidas e seguras
- **🧠 Micro-Tarefas 2.0** — Decomposição de tarefas atômicas baseada em JSON
- **🛡️ Guardião de Estilo** — Linting estrito baseado em AST e verificações de consistência
- **🔄 Loop de Autocorreção** — Estratégias de pivô autônomas para erros complexos
- **🏘️ Agrupamento Inteligente** — Emparelhamento Coder + Reviewer para cada tarefa
- **🏗️ Desempenho Impulsionado por Rust** — Desempenho nativo para tarefas pesadas

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

## 🏛️ Filosofia do Projeto: Execução Implacável (Relentless Execution)

Não acreditamos em IA "rápida". Acreditamos em IA **correta**. Nossos agentes são implacáveis. Eles não param quando encontram um erro; eles pivotam, re-planejam e seguem em frente até que o objetivo seja alcançado.

### Fluxo de Missão de 5 Fases

1.  **🧠 Fase 1: Análise Profunda (Pensar Primeiro)**: Nada de codificar às cegas. Agentes devem ler os documentos e resumir os limites centrais do projeto primeiro.
2.  **🌲 Fase 2: Planejamento Hierárquico**: Decomposição de uma visão arquitetônica de alto nível até micro-tarefas atômicas e paralelas (DAG JSON).
3.  **👥 Fase 3: Execução Paralela**: Execução simultânea de tarefas independentes para maximizar a eficiência.
4.  **🛡️ Fase 4: Portão de Sincronização Global**: Após os fluxos paralelos se unirem, uma **Verificação de Consistência Global** garante que todos os arquivos, importações e exportações permaneçam em perfeita sincronia.
5.  **⏳ Fase 5: Conclusão Implacável**: Sem limites de tempo artificiais. O sucesso é definido apenas por um "PASS" 100% verificado. Executamos o tempo que for necessário para alcançar a perfeição.

---

## ⚡ Desenvolvimento Rápido

Este projeto está evoluindo **extremamente rápido**. Nós iteramos rapidamente para trazer a execução implacável ao seu fluxo de trabalho.
As atualizações são frequentes. Mantenha sua versão atualizada.
