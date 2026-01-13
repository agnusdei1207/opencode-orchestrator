# OpenCode Orchestrator Plugin (FR)

> **Plugin de Collaboration Multi-Agents pour [OpenCode](https://opencode.ai)**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
[![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
[![npm downloads](https://img.shields.io/npm/dt/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-purple.svg)](https://opencode.ai)

[English](../../README.md) | [한국어](README.ko.md) | [简体中文](README.zh.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md)
[Русский](README.ru.md) | [Português](README.pt.md)

---

<p align="center">
  <img src="../../assets/logo.png" width="600" />
</p>

> **L'Objectif Ultime**
>
> Décomposer le travail en unités si petites et faciles à résoudre que **même un 'imbécile' puisse les exécuter**, permettant une **collaboration parallèle massive**. Le modèle n'a pas besoin d'être intelligent. **La méthode de collaboration doit être parfaite.**

---

## Qu'est-ce que c'est ?

Un système collaboratif de 6 agents qui maximise l'**Orchestration d'Agents** pour extraire une **Qualité de Décision Ultime (Ultimate Decision Quality)** à partir de **modèles abordables et moins performants**.

**Idée centrale** : Grâce à une répartition stratégique des rôles, une décomposition microscopique des tâches et l'application stricte de règles de validation, nous obtenons des **résultats de niveau SOTA** avec des **modèles économiques**. Même si le modèle sous-jacent n'est pas le "plus intelligent", notre architecture garantit qu'il **accomplit le travail** de manière impeccable.

---

## Pourquoi Orchestrator ?

| Traditionnel | Avec Orchestrator |
|-------------|-------------------|
| Modèle "Intelligent" coûteux requis | **Modèle Abordable + Processus Intelligent** |
| Coûts de Token élevés (Contexte énorme) | **Efficacité des Tokens** (Contexte filtré) |
| Exécution linéaire et lente | **Exécution Parallèle et Rapide** |
| Les erreurs s'accumulent silencieusement | **Boucles de Vérification et d'Autocorrection** |
| "J'espère que ça marche" | **Micro-Gestion Stratégique** |

---

- **🧩 Organisation Stratégique** — Maximiser la production grâce à une répartition intelligente des rôles
- **📉 Économie de Tokens** — Filtrer le bruit pour réduire les coûts et augmenter la concentration
- **⚡ DAG Parallèle** — Exécution simultanée pour la vitesse et l'efficacité
- **🔍 Micro-Tâches** — Décomposition atomique pour prévenir les hallucinations
- **🛡️ Gardien de Style** — Linting strict basé sur AST et vérifications de cohérence
- **🔄 Auto-Guérison** — Stratégies de pivot autonomes pour les erreurs complexes
- **🏗️ Cœur Rust** — Performance native pour les tâches lourdes

---

## Comment ça marche (DAG Parallèle)

Au lieu d'une séquence linéaire, nous utilisons un **Graphe Orienté Acyclique (DAG)** pour modéliser votre mission.

```
      Début de la Mission (/task)
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

## Licence

Licence MIT. AUCUNE GARANTIE.

[MIT](../../LICENSE)

---

## 🏛️ Philosophie du Projet : La Grande Fusion des Architectures

Ce projet est une **symphonie des plus grands succès de l'Informatique**. Ce n'est pas juste un script de chatbot ; c'est une **fusion collaborative** d'algorithmes avancés et de modèles architecturaux.

Nous avons explicitement conçu ce système en intégrant les **principes du Noyau de Système d'Exploitation (Ordonnancement), le Calcul Distribué (Sharding d'État) et l'Efficacité Algorithmique (Diviser pour Régner, Programmation Dynamique)**. En orchestrant ces concepts puissants ensemble, nous surmontons les limites des modèles d'IA individuels grâce à la **Supériorité Architecturale**.

Nous traitons l'orchestration des agents comme un **problème de calcul distribué**, extrayant chaque once d'intelligence des modèles abordables. et moins performants** (comme des modèles locaux ou des API économiques) peuvent atteindre une **Qualité de Décision Ultime** lorsqu'ils sont correctement organisés. Nous y parvenons en imitant une équipe d'ingénierie humaine très performante.

### La Sauce Secrète : Efficacité Extrême

1.  **Micro-Gestion (La Stratégie de "Dispersion")** : Nous ne demandons pas au modèle de "construire un site web". Nous le décomposons en changements atomiques de 20 lignes. Petit contexte = Haute précision = Faible hallucination.
2.  **Exécution et Vérification Parallèles** : En exécutant des tâches indépendantes en parallèle, nous réduisons le temps réel.
3.  **Économie de Tokens** : Nous filtrons strictement le contexte. Les agents ne lisent pas toute la base de code ; ils lisent les *mises à jour* et les *résumés*. Cela réduit considérablement les coûts de tokens tout en maintenant la précision.
4.  **Vérification Implacable** : Nous acceptons que les modèles bon marché fassent des erreurs. L'agent **Reviewer** existe uniquement pour les attraper. Nous échangeons un peu de temps de calcul pour 100 % de fiabilité.
5.  **Traitement Parallèle** : Plusieurs agents travaillent simultanément sur différents fichiers. Nous échangeons la concurrence des threads contre du temps réel.
6.  **Adaptation Dynamique** : Si un chemin échoue, nous ne nous contentons pas de réessayer ; nous **pivotons** (Re-planification Dynamique).

### 🚀 La Commande : `/flow`

L'interface de cette puissance est une commande unique et intuitive :

```bash
/flow "Refactoriser le middleware d'authentification et implémenter la rotation JWT"
```

Cela garantit le **"Flux Opérationnel"**. Il signifie un flux d'actions intelligentes allant de l'intention à la réalisation, géré par un graphe rigide et auto-correcteur.

### Le Flux de Travail d'Efficacité en 5 Phases

1.  **🧠 Phase 1 : Analyse Filtrée** : Le **Searcher** lit la documentation mais filtre le bruit. Nous ne fournissons que le "chemin critique" au Planner.
2.  **🌲 Phase 2 : Planification Stratégique** : Le **Planner** crée un DAG JSON. C'est notre feuille de route. Aucun token n'est gaspillé en errance sans but.
3.  **🚀 Phase 3 : Exécution Parallèle** : L'**Orchestrator** identifie les tâches indépendantes et les exécute simultanément.
4.  **🛡️ Phase 4 : Synchronisation et Vérification** : Le **Reviewer** agit comme un gardien. Il vérifie la syntaxe, la logique et la *cohérence entre les fichiers*.
5.  **💰 Phase 5 : Achèvement Rentable** : Nous obtenons des résultats de "Développeur Senior" à des prix de "Stagiaire Junior".écessaire pour atteindre la perfection.

---

## ⚡ Développement Rapide

Ce projet évolue **extrêmement vite**. Nous itérons rapidement pour apporter une exécution implacable à votre flux de travail.
Les mises à jour sont fréquentes. Gardez votre version à jour.
