# OpenCode Orchestrator Plugin (DE)

> **Multi-Agenten Kollaborations-Plugin für [OpenCode](https://opencode.ai)**

<div align="center">

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
[![npm](https://img.shields.io/npm/v/@agnusdei1207/opencode-orchestrator.svg)](https://www.npmjs.com/package/@agnusdei1207/opencode-orchestrator)
[![npm downloads](https://img.shields.io/npm/dt/@agnusdei1207/opencode-orchestrator.svg)](https://www.npmjs.com/package/@agnusdei1207/opencode-orchestrator)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-purple.svg)](https://opencode.ai)

[English](../../README.md) | [한국어](README.ko.md) | [简体中文](README.zh.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md)
[Русский](README.ru.md) | [Português](README.pt.md)

</div>

---

## Was ist das?

Ein kollaboratives System mit 6 Agenten, das selbst **leistungsärmere Modelle** in ein äußerst zuverlässiges Coding-Team verwandelt.

**Kernidee**: Komplexe Aufgaben in atomare Einheiten zerlegen, jeden Schritt verifizieren und Fehler automatisch beheben.

---

## Warum Orchestrator?

| Traditionell | Mit Orchestrator |
|--------------|------------------|
| Ein großer Prompt → Hoffen, dass es klappt | Atomare Aufgaben → Jeder Schritt verifiziert |
| Teures Modell erforderlich | Feste, erschwingliche Modelle funktionieren |
| Fehler häufen sich stillschweigend an | Selbstheilungsschleife (Self-correcting) |
| Unvorhersehbare Ergebnisse | **Unerbittliche Ausführungsstrategie** |

---

- **🧩 Parallele DAG-Orchestrierung** — Gleichzeitige Ausführung unabhängiger Aufgaben
- **🎯 Festmodell-Optimierung** — Hohe Zuverlässigkeit auch bei leistungsarmen LLMs
- **🦀 Rust Core** — Schnelle, speichersichere native Such- undanalysetools
- **🧠 Micro-Task 2.0** — JSON-basierte atomare Aufgabenzerlegung
- **🛡️ Style Guardian** — Strenges AST-basiertes Linting und Konsistenzprüfungen
- **🔄 Selbstheilungsschleife** — Autonome Pivot-Strategien für komplexe Fehler
- **🏘️ Intelligente Gruppierung** — Coder + Reviewer Paarung für jede Aufgabe
- **🏗️ Rust-Powered Performance** — Native Leistung für rechenintensive Aufgaben

---

## Wie es funktioniert (Paralleler DAG)

Statt einer linearen Abfolge verwenden wir einen **Gerichteten Azyklischen Graphen (DAG)**, um Ihre Mission zu modellieren.

```
      Missionsstart (/dag)
              │
              ▼
      ┌───────────────┐
      │   PLANNER     │ (Architekt)
      └───────┬───────┘
              │
      ┌───────┴───────┐
      │               │ (Parallele Ströme)
      ▼               ▼
 ┌───────────┐   ┌───────────┐
 │ Aufgaben (A)│   │ Aufgaben (B)│
 └─────┬─────┘   └─────┬─────┘
       │               │
       └───────┬───────┘
               ▼
       ┌───────────────┐
       │   REVIEWER    │ (Style Guardian)
       └───────┬───────┘
               ▼
           ✅ MISSION ABGESCHLOSSEN
```

---

## Installation

Sie können **npm** oder **bun** verwenden. Beide funktionieren einwandfrei, da die Kernlogik in einer nativen **Rust-Binärdatei** ausgeführt wird.

### Option 1: npm (Standard)
```bash
npm install -g opencode-orchestrator
```

### Option 2: Bun (Schnell)
```bash
bun install -g opencode-orchestrator
```

> **Hinweis**: Starten Sie nach der Installation **OpenCode neu** oder führen Sie `opencode` in Ihrem Terminal aus.
> Das Plugin registriert sich automatisch in `~/.config/opencode/opencode.json` mit seinem absoluten Pfad.

### Fehlerbehebung
Wenn der Befehl `/dag` nicht erscheint:
1. Deinstallieren: `npm uninstall -g opencode-orchestrator` (oder `bun remove -g`)
2. Konfiguration löschen: `rm -rf ~/.config/opencode` (Warnung: setzt alle Plugins zurück)
3. Neu installieren: `npm install -g opencode-orchestrator`

---

**Der einzige Befehl, den Sie brauchen:**

```bash
/dag "Implement user authentication with JWT"
```

Der Orchestrator wird:
1. **Zerlegen (Decompose)**: Die Mission in einen JSON-Aufgaben-DAG zerlegen
2. **Parallel Ausführen (Parallel Execute)**: Unabhängige Ströme
3. **Suchen (Search)**: Proaktiv nach Codemustern suchen
4. **Coden (Code)**: Mit atomarer Präzision
5. **Verifizieren (Verify)**: Über den Style Guardian (OBLIGATORISCH)
6. **Selbstheilen (Self-Heal)**: Wenn Fehler auftreten

---

## Agenten

| Agent | Rolle |
|-------|-------|
| **Orchestrator** | Teamleiter — koordiniert, entscheidet, adaptiert |
| **Planner** | Zerlegt Arbeit in atomare Aufgaben |
| **Coder** | Implementiert eine Aufgabe nach der anderen |
| **Reviewer** | Quality Gate — fängt alle Fehler und Synchronisationsprobleme ab |
| **Fixer** | Gezielte Fehlerbehebung |
| **Searcher** | Findet Kontext vor dem Coden |

---

- [Architektur Deep-Dive](../ARCHITECTURE.md) — Wie der DAG funktioniert
- [Konfiguration](../../examples/orchestrator.jsonc) — Einstellungen anpassen

---

## Open Source

MIT-Lizenz. Keine Telemetrie. Keine Hintertüren.

[github.com/agnusdei1207/opencode-orchestrator](https://github.com/agnusdei1207/opencode-orchestrator)

---

## Anmerkung des Autors

> Mein Ziel ist es zu beweisen, dass **erschwingliche Modelle** Ergebnisse liefern können, die genauso gut sind wie teure APIs — wenn man die Arbeit richtig strukturiert.
>
> Aufgaben zerlegen, jeden Schritt verifizieren, Fehler automatisch beheben. Das Modell muss nicht schlau sein. Der Prozess muss diszipliniert sein.
>
> — [@agnusdei1207](https://github.com/agnusdei1207)

---

## Lizenz

MIT License. KEINE GARANTIE.

[MIT](../../LICENSE)

---

## 🏛️ Projektphilosophie: Unerbittliche Ausführung (Relentless Execution)

Wir glauben nicht an "schnelle" KI. Wir glauben an **korrekte** KI. Unsere Agenten sind unerbittlich. Sie stoppen nicht, wenn sie auf einen Fehler stoßen; sie pivotieren, planen neu und machen weiter, bis das Ziel erreicht ist.

### 5-Phasen-Missions-Workflow

1.  **🧠 Phase 1: Tiefenanalyse (Zuerst Denken)**: Kein blindes Coden. Agenten müssen zuerst die Dokumente lesen und die zentralen Grenzen des Projekts zusammenfassen.
2.  **🌲 Phase 2: Hierarchische Planung**: Zerlegung von einer High-Level-Architekturvision bis hin zu subatomaren, parallelen Mikroaufgaben (JSON DAG).
3.  **👥 Phase 3: Parallele Ausführung**: Gleichzeitige Ausführung unabhängiger Aufgaben zur Maximierung der Effizienz.
4.  **🛡️ Phase 4: Global Sync Gate**: Nachdem parallele Ströme zusammengeführt wurden, stellt ein **Globaler Konsistenz-Check** sicher, dass alle Dateien, Importe und Exporte perfekt synchron bleiben.
5.  **⏳ Phase 5: Unerbittliche Fertigstellung**: Keine künstlichen Zeitlimits. Erfolg wird nur durch ein 100% verifiziertes "PASS" definiert. Wir führen so lange aus, bis Perfektion erreicht ist.

---

## ⚡ Schnelle Entwicklung

Dieses Projekt entwickelt sich **extrem schnell** weiter. Wir iterieren schnell, um unerbittliche Ausführung in Ihren Workflow zu bringen.
Updates sind häufig. Halten Sie Ihre Version aktuell.
