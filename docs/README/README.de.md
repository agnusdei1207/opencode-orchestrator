# OpenCode Orchestrator Plugin (DE)

> **Multi-Agenten Kollaborations-Plugin für [OpenCode](https://opencode.ai)**

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

> **Das Ultimative Ziel**
>
> Die Arbeit in so kleine, leicht lösbare Einheiten zu zerlegen, dass **selbst ein 'Narr' sie ausführen kann**, was eine **massive parallele Zusammenarbeit** ermöglicht. Das Modell muss nicht klug sein. **Die Zusammenarbeit muss perfekt sein.**

---

## Was ist das?

Ein kollaboratives System mit 6 Agenten, das die **Agenten-Orchestrierung** maximiert, um **Ultimative Entscheidungsqualität (Ultimate Decision Quality)** aus **erschwinglichen, leistungsärmeren Modellen** zu extrahieren.

**Kernidee**: Durch strategische Rollenverteilung, mikroskopische Aufgabenzerlegung und strikte Durchsetzung von Validierungsregeln erzielen wir **SOTA-Ergebnisse** mit **kostengünstigen Modellen**. Selbst wenn das zugrunde liegende Modell nicht das "klügste" ist, stellt unsere Architektur sicher, dass es die Aufgabe **einwandfrei erledigt**.

---

## Warum Orchestrator?

| Traditionell | Mit Orchestrator |
|-------------|-------------------|
| Teures "Kluges" Modell erforderlich | **Erschwingliches Modell + Kluger Prozess** |
| Hohe Token-Kosten (Riesiger Kontext) | **Token-Effizienz** (Gefilterter Kontext) |
| Lineare, langsame Ausführung | **Parallele, schnelle Ausführung** |
| Fehler häufen sich stillschweigend an | **Selbstkorrigierende Verifizierungsschleifen** |
| "Hoffentlich funktioniert es" | **Strategisches Mikro-Tasking** |

---

- **🧩 Strategische Organisation** — Maximierung des Outputs durch intelligente Rollenverteilung
- **📉 Token-Ökonomie** — Filtern von Rauschen zur Kostensenkung und Fokussteigerung
- **⚡ Paralleler DAG** — Gleichzeitige Ausführung für Geschwindigkeit und Effizienz
- **🔍 Mikro-Tasking** — Atomare Zerlegung zur Vermeidung von Halluzinationen
- **🛡️ Style Guardian** — Strenges AST-basiertes Linting und Konsistenzprüfungen
- **🔄 Selbstheilung** — Autonome Pivot-Strategien für komplexe Fehler
- **🏗️ Rust Core** — Native Leistung für schwere Aufgaben

---

## Wie es funktioniert (Paralleler DAG)

Statt einer linearen Abfolge verwenden wir einen **Gerichteten Azyklischen Graphen (DAG)**, um Ihre Mission zu modellieren.

```
      Missionsstart (/task)
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

## Lizenz

MIT License. KEINE GARANTIE.

[MIT](../../LICENSE)

---

## 🏛️ Projektphilosophie: Die Große Fusion der Architekturen

Dieses Projekt ist eine **Symphonie der größten Hits der Informatik**. Es ist nicht nur ein Chatbot-Skript; es ist eine **kollaborative Fusion** fortschrittlicher Algorithmen und Architekturmuster.

Wir haben dieses System explizit entworfen, indem wir **Betriebssystem-Kernel-Prinzipien (Scheduling), Distributed Computing (State Sharding) und Algorithmische Effizienz (Teile und Herrsche, Dynamische Programmierung)** integriert haben. Durch die Orchestrierung dieser leistungsstarken Konzepte überwinden wir die Grenzen einzelner KI-Modelle durch **Architektonische Überlegenheit**.

Wir behandeln die Agenten-Orchestrierung als ein **verteiltes Computing-Problem** und holen jedes bisschen Intelligenz aus erschwinglichen Modellen heraus.tungsärmere Modelle** (wie lokale Modelle oder Budget-APIs) **Ultimative Entscheidungsqualität** erreichen können, wenn sie richtig organisiert sind. Wir erreichen dies, indem wir ein leistungsstarkes menschliches Engineering-Team nachahmen.

### Die Geheimzutat: Extreme Effizienz

1.  **Mikro-Tasking (Die "Streu"-Strategie)**: Wir bitten das Modell nicht, "eine Website zu bauen". Wir zerlegen es in atomare Änderungen von 20 Zeilen. Kleiner Kontext = Hohe Genauigkeit = Weniger Halluzinationen.
2.  **Parallelverarbeitung**: Mehrere Agenten arbeiten gleichzeitig an verschiedenen Dateien. Wir tauschen Thread-Parallelität gegen reale Zeit.
3.  **Dynamische Anpassung**: Wenn ein Pfad fehlschlägt, versuchen wir es nicht einfach erneut; wir **pivotieren** (Dynamische Neuplanung).

### 🚀 Der Befehl: `/flow`

Die Schnittstelle zu dieser Leistung ist ein einziger, intuitiver Befehl:

```bash
/flow "Refactor authentication middleware and implement JWT rotation"
```

Dies gewährleistet den **"Operativen Fluss"**. Es bedeutet einen Strom intelligenter Handlungen, die von der Absicht zur Verwirklichung fließen, verwaltet durch einen starren, sich selbst korrigierenden Graphen.
4.  **Token-Ökonomie**: Wir filtern den Kontext streng. Agenten lesen nicht die gesamte Codebasis; sie lesen *Updates* und *Zusammenfassungen*. Dies senkt die Token-Kosten drastisch bei gleichbleibender Genauigkeit.
5.  **Unerbittliche Verifizierung**: Wir akzeptieren, dass billige Modelle Fehler machen. Der **Reviewer**-Agent existiert nur, um sie zu fangen. Wir tauschen ein wenig Rechenzeit gegen 100% Zuverlässigkeit.

### Der 5-Phasen-Effizienz-Workflow

1.  **🧠 Phase 1: Gefilterte Analyse**: Der **Searcher** liest Dokumente, filtert aber Rauschen heraus. Wir geben nur den "kritischen Pfad" an den Planner weiter.
2.  **🌲 Phase 2: Strategische Planung**: Der **Planner** erstellt einen JSON-DAG. Das ist unser Fahrplan. Kein Token wird für zielloses Umherirren verschwendet.
3.  **🚀 Phase 3: Parallele Ausführung**: Der **Orchestrator** identifiziert unabhängige Aufgaben und führt sie gleichzeitig aus.
4.  **🛡️ Phase 4: Synchronisation & Verifizierung**: Der **Reviewer** fungiert als Torwächter. Er prüft Syntax, Logik und *dateiübergreifende Konsistenz*.
5.  **💰 Phase 5: Kosteneffizienter Abschluss**: Wir erzielen "Senior Developer"-Ergebnisse zu "Junior Intern"-Preisen.

---

## ⚡ Schnelle Entwicklung

Dieses Projekt entwickelt sich **extrem schnell** weiter. Wir iterieren schnell, um unerbittliche Ausführung in Ihren Workflow zu bringen.
Updates sind häufig. Halten Sie Ihre Version aktuell.
