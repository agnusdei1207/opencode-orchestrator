# OpenCode Orchestrator Plugin (FR)

> **Plugin de Collaboration Multi-Agents pour [OpenCode](https://opencode.ai)**

<div align="center">

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
[![npm](https://img.shields.io/npm/v/@agnusdei1207/opencode-orchestrator.svg)](https://www.npmjs.com/package/@agnusdei1207/opencode-orchestrator)
[![npm downloads](https://img.shields.io/npm/dt/@agnusdei1207/opencode-orchestrator.svg)](https://www.npmjs.com/package/@agnusdei1207/opencode-orchestrator)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-purple.svg)](https://opencode.ai)

[English](../../README.md) | [한국어](README.ko.md) | [简体中文](README.zh.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md)
[Русский](README.ru.md) | [Português](README.pt.md)

</div>

---

## Qu'est-ce que c'est ?

Un système collaboratif de 6 agents qui transforme même les **modèles à moindre performance** en une équipe de développement hautement fiable.

**Idée centrale** : Décomposer les tâches complexes en unités atomiques, vérifier chaque étape et corriger les erreurs automatiquement.

---

## Pourquoi l'Orchestrator ?

| Traditionnel | Avec Orchestrator |
|--------------|-------------------|
| Un gros prompt → Espérer que ça marche | Tâches atomiques → Vérifiées à chaque étape |
| Modèle coûteux requis | Des modèles fixes et abordables fonctionnent |
| Les erreurs s'accumulent silencieusement | Boucle d'auto-correction (Self-correcting) |
| Résultats imprévisibles | **Stratégie d'exécution implacable** |

---

- **🧩 Orchestration DAG Parallèle** — Exécution simultanée de tâches indépendantes
- **🎯 Optimisation de Modèle Fixe** — Haute fiabilité même avec des LLM peu performants
- **🦀 Cœur en Rust** — Outils de recherche et d'analyse natifs, rapides et sûrs
- **🧠 Micro-Tâches 2.0** — Décomposition de tâches atomiques basée sur JSON
- **🛡️ Gardien de Style** — Linting strict basé sur l'AST et vérifications de cohérence
- **🔄 Boucle d'Auto-Guérison** — Stratégies de pivot autonomes pour les erreurs complexes
- **🏘️ Groupement Intelligent** — Appariement Coder + Reviewer pour chaque tâche
- **🏗️ Performance propulsée par Rust** — Performance native pour les tâches lourdes

---

## Comment ça marche (DAG Parallèle)

Au lieu d'une séquence linéaire, nous utilisons un **Graphe Orienté Acyclique (DAG)** pour modéliser votre mission.

```
      Début de Mission (/dag)
              │
              ▼
      ┌───────────────┐
      │   PLANNER     │ (Architecte)
      └───────┬───────┘
              │
      ┌───────┴───────┐
      │               │ (Flux Parallèles)
      ▼               ▼
 ┌───────────┐   ┌───────────┐
 │ Tâches (A) │   │ Tâches (B) │
 └─────┬─────┘   └─────┬─────┘
       │               │
       └───────┬───────┘
               ▼
       ┌───────────────┐
       │   REVIEWER    │ (Gardien de Style)
       └───────┬───────┘
               ▼
           ✅ MISSION TERMINÉE
```

---

## Installation

Vous pouvez utiliser **npm** ou **bun**. Les deux fonctionnent parfaitement car la logique centrale s'exécute dans un **binaire natif Rust**.

### Option 1 : npm (Standard)
```bash
npm install -g opencode-orchestrator
```

### Option 2 : Bun (Rapide)
```bash
bun install -g opencode-orchestrator
```

> **Note** : Après l'installation, **redémarrez OpenCode** ou exécutez `opencode` dans votre terminal.
> Le plugin s'enregistrera automatiquement dans `~/.config/opencode/opencode.json` avec son chemin absolu.

### Dépannage
Si la commande `/dag` n'apparaît pas :
1. Désinstaller : `npm uninstall -g opencode-orchestrator` (ou `bun remove -g`)
2. Effacer la config : `rm -rf ~/.config/opencode` (Attention : réinitialise tous les plugins)
3. Réinstaller : `npm install -g opencode-orchestrator`

---

**La seule commande dont vous avez besoin :**

```bash
/dag "Implement user authentication with JWT"
```

L'Orchestrator va :
1. **Décomposer (Decompose)** la mission en un DAG de tâches JSON
2. **Exécuter en Parallèle (Parallel Execute)** les flux indépendants
3. **Rechercher (Search)** proactivement des modèles de code
4. **Coder (Code)** avec une précision atomique
5. **Vérifier (Verify)** via le Gardien de Style (OBLIGATOIRE)
6. **Auto-Guérir (Self-Heal)** si des erreurs surviennent

---

## Agents

| Agent | Rôle |
|-------|------|
| **Orchestrator** | Chef d'équipe — coordonne, décide, adapte |
| **Planner** | Décompose le travail en tâches atomiques |
| **Coder** | Implémente une tâche à la fois |
| **Reviewer** | Porte de qualité — détecte toutes les erreurs et problèmes de synchro |
| **Fixer** | Résolution d'erreurs ciblée |
| **Searcher** | Trouve le contexte avant de coder |

---

- [Plongée dans l'Architecture](../ARCHITECTURE.md) — Comment fonctionne le DAG
- [Configuration](../../examples/orchestrator.jsonc) — Personnaliser les paramètres

---

## Open Source

Licence MIT. Pas de télémétrie. Pas de portes dérobées.

[github.com/agnusdei1207/opencode-orchestrator](https://github.com/agnusdei1207/opencode-orchestrator)

---

## Note de l'Auteur

> Mon objectif est de prouver que des **modèles abordables** peuvent produire des résultats aussi bons que des API coûteuses — si vous structurez le travail correctement.
>
> Décomposez les tâches, vérifiez chaque étape, corrigez les erreurs automatiquement. Le modèle n'a pas besoin d'être intelligent. Le processus doit être discipliné.
>
> — [@agnusdei1207](https://github.com/agnusdei1207)

---

## Licence

Licence MIT. AUCUNE GARANTIE.

[MIT](../../LICENSE)

---

## 🏛️ Philosophie du Projet : Exécution Implacable (Relentless Execution)

Nous ne croyons pas à l'IA "rapide". Nous croyons à l'IA **correcte**. Nos agents sont implacables. Ils ne s'arrêtent pas lorsqu'ils rencontrent une erreur ; ils pivotent, re-planifient et avancent jusqu'à ce que l'objectif soit atteint.

### Flux de Mission en 5 Phases

1.  **🧠 Phase 1 : Analyse Approfondie (Penser d'abord)** : Pas de code à l'aveugle. Les agents doivent d'abord lire les documents et résumer les frontières centrales du projet.
2.  **🌲 Phase 2 : Planification Hiérarchique** : Décomposition d'une vision architecturale de haut niveau en micro-tâches atomiques parallèles (JSON DAG).
3.  **👥 Phase 3 : Exécution Parallèle** : Exécution simultanée de tâches indépendantes pour maximiser l'efficacité.
4.  **🛡️ Phase 4 : Porte de Synchronisation Globale** : Une fois les flux parallèles fusionnés, un **Contrôle de Cohérence Global** assure que tous les fichiers, imports et exports restent en parfaite synchronisation.
5.  **⏳ Phase 5 : Achèvement Implacable** : Pas de limites de temps artificielles. Le succès est défini uniquement par un "PASS" vérifié à 100%. Nous exécutons aussi longtemps que nécessaire pour atteindre la perfection.

---

## ⚡ Développement Rapide

Ce projet évolue **extrêmement vite**. Nous itérons rapidement pour apporter une exécution implacable à votre flux de travail.
Les mises à jour sont fréquentes. Gardez votre version à jour.
