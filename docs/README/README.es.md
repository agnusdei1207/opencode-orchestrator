# OpenCode Orchestrator Plugin (ES)

> **Plugin de Colaboración Multi-Agente para [OpenCode](https://opencode.ai)**

<div align="center">

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
[![npm](https://img.shields.io/npm/v/@agnusdei1207/opencode-orchestrator.svg)](https://www.npmjs.com/package/@agnusdei1207/opencode-orchestrator)
[![npm downloads](https://img.shields.io/npm/dt/@agnusdei1207/opencode-orchestrator.svg)](https://www.npmjs.com/package/@agnusdei1207/opencode-orchestrator)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-purple.svg)](https://opencode.ai)

[English](../../README.md) | [한국어](README.ko.md) | [简体中文](README.zh.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md)
[Русский](README.ru.md) | [Português](README.pt.md)

</div>

---

## ¿Qué es esto?

Un sistema colaborativo de 6 agentes que maximiza la **Orquestación de Agentes** para extraer la **Calidad de Decisión Suprema (Ultimate Decision Quality)** de **modelos asequibles y de menor rendimiento**.

**Idea central**: Al organizar estratégicamente los roles, dividir el trabajo en micro-tareas y hacer cumplir reglas de verificación estrictas, logramos resultados de "Modelo Costoso" con costos de "Modelo Económico".

---

## ¿Por qué Orchestrator?

| Tradicional | Con Orchestrator |
|-------------|-------------------|
| Requiere modelo costoso e "inteligente" | **Modelo Asequible + Proceso Inteligente** |
| Altos costos de tokens (contexto enorme) | **Eficiencia de Tokens** (contexto filtrado) |
| Ejecución lineal y lenta | **Ejecución Paralela y Rápida** |
| Los errores se acumulan silenciosamente | **Bucles de Verificación y Autocorrección** |
| "Espero que funcione" | **Micro-Gestión Estratégica** |

---

- **🧩 Organización Estratégica** — Maximizar la producción mediante una distribución de roles inteligente
- **📉 Economía de Tokens** — Filtrar el ruido para reducir costos y aumentar el enfoque
- **⚡ DAG Paralelo** — Ejecución concurrente para velocidad y eficiencia
- **🔍 Micro-Tareas** — Descomposición atómica para prevenir alucinaciones
- **🛡️ Guardián de Estilo** — Linting estricto basado en AST y comprobaciones de consistencia
- **🔄 Auto-Reparación** — Estrategias de pivote autónomas para errores complejos
- **🏗️ Núcleo Rust** — Rendimiento nativo para tareas pesadas

---

## Cómo Funciona (DAG Paralelo)

En lugar de una secuencia lineal, utilizamos un **Grafo Acíclico Dirigido (DAG)** para modelar tu misión.

```
      Inicio de Misión (/dag)
              │
              ▼
      ┌───────────────┐
      │   PLANNER     │ (Arquitecto)
      └───────┬───────┘
              │
      ┌───────┴───────┐
      │               │ (Flujos Paralelos)
      ▼               ▼
 ┌───────────┐   ┌───────────┐
 │ Tareas (A) │   │ Tareas (B) │
 └─────┬─────┘   └─────┬─────┘
       │               │
       └───────┬───────┘
               ▼
       ┌───────────────┐
       │   REVIEWER    │ (Guardián de Estilo)
       └───────┬───────┘
               ▼
           ✅ MISIÓN COMPLETA
```

---

## Instalación

Puedes usar **npm** o **bun**. Ambos funcionan perfectamente porque la lógica central se ejecuta en un **binario nativo de Rust**.

### Opción 1: npm (Estándar)
```bash
npm install -g opencode-orchestrator
```

### Opción 2: Bun (Rápido)
```bash
bun install -g opencode-orchestrator
```

> **Nota**: Después de la instalación, **reinicia OpenCode** o ejecuta `opencode` en tu terminal.
> El plugin se registrará automáticamente en `~/.config/opencode/opencode.json` con su ruta absoluta.

### Solución de Problemas
Si el comando `/dag` no aparece:
1. Desinstalar: `npm uninstall -g opencode-orchestrator` (o `bun remove -g`)
2. Borrar configuración: `rm -rf ~/.config/opencode` (Advertencia: restablece todos los plugins)
3. Reinstalar: `npm install -g opencode-orchestrator`

---

**El único comando que necesitas:**

```bash
/dag "Implementar autenticación de usuario con JWT"
```

El Orchestrator hará:
1. **Descomponer (Decompose)**: La misión en un DAG de tareas JSON
2. **Ejecutar en Paralelo (Parallel Execute)**: Flujos independientes
3. **Buscar (Search)**: Proactivamente patrones de código
4. **Codificar (Code)**: Con precisión atómica
5. **Verificar (Verify)**: A través del Guardián de Estilo (OBLIGATORIO)
6. **Autocurar (Self-Heal)**: Si ocurren errores

---

## Agentes

| Agente | Rol |
|--------|-----|
| **Orchestrator** | Líder de equipo — coordina, decide, adapta |
| **Planner** | Divide el trabajo en tareas atómicas |
| **Coder** | Implementa una tarea a la vez |
| **Reviewer** | Puerta de calidad — detecta todos los errores y problemas de sincronización |
| **Fixer** | Resolución de errores dirigida |
| **Searcher** | Encuentra contexto antes de codificar |

---

- [Profundización en Arquitectura](../ARCHITECTURE.md) — Cómo funciona el DAG
- [Configuración](../../examples/orchestrator.jsonc) — Personalizar ajustes

---

## Código Abierto

Licencia MIT. Sin telemetría. Sin puertas traseras.

[github.com/agnusdei1207/opencode-orchestrator](https://github.com/agnusdei1207/opencode-orchestrator)

---

## Nota del Autor

> Mi objetivo es demostrar que **modelos asequibles** pueden producir resultados tan buenos como las APIs costosas — cuando estructuras el trabajo correctamente.
>
> Divide las tareas, verifica cada paso, corrige errores automáticamente. El modelo no necesita ser inteligente. El proceso debe ser disciplinado.
>
> — [@agnusdei1207](https://github.com/agnusdei1207)

---

## Licencia

Licencia MIT. SIN GARANTÍA.

[MIT](../../LICENSE)

---

## 🏛️ Filosofía del Proyecto: Ingeniería de "Eficiencia Extrema"

No nos limitamos a repetir prompts. Tratamos la orquestación de agentes como un **problema de computación distribuida**. Al tomar prestados conceptos del diseño de sistemas operativos y teoría de algoritmos—**Programación DAG, Divide y Vencerás, Gestión de Estado y Programación Dinámica**—exprimimos cada gramo de inteligencia de los modelos asequibles.

### Principios de Ingeniería Centrales

1.  **Grafo Acíclico Dirigido (DAG)**: Modelamos las misiones no como un chat lineal, sino como un grafo de dependencias. Esto permite la ejecución asíncrona y no bloqueante de tareas independientes.
2.  **Divide y Vencerás (Algoritmo)**: El **Planner** utiliza la descomposición recursiva para dividir problemas complejos en unidades atómicas y solucionables (complejidad $O(1)$ para el Coder).
3.  **Gestión de Estado y Programación**: Un Orchestrator dedicado actúa como un **Planificador de Kernel**, gestionando estados de hilos (Ready, Running, Success, Failed) y persistiendo el contexto a través de nodos de ejecución disjuntos (E/S de Archivos).
4.  **Procesamiento Paralelo**: Múltiples agentes trabajan simultáneamente en diferentes archivos. Intercambiamos concurrencia de hilos por tiempo real.
5.  **Adaptación Dinámica**: Si una ruta falla, no solo reintentamos; **pivotamos** (Re-planificación Dinámica).

### El Flujo de Trabajo de Eficiencia de 5 Fases

1.  **🧠 Fase 1: Análisis Filtrado**: El **Searcher** lee la documentación pero filtra el ruido. Solo alimentamos la "ruta crítica" al Planner.
2.  **🌲 Fase 2: Planificación Estratégica**: El **Planner** crea un DAG JSON. Este es nuestro mapa. No se desperdician tokens en vagabundeos sin rumbo.
3.  **🚀 Fase 3: Ejecución Paralela**: El **Orchestrator** identifica tareas independientes y las ejecuta simultáneamente.
4.  **🛡️ Fase 4: Sincronización y Verificación**: El **Reviewer** actúa como guardián. Verifica la sintaxis, la lógica y la *consistencia entre archivos*.
5.  **💰 Fase 5: Finalización Costo-Efectiva**: Logramos resultados de "Desarrollador Senior" a precios de "Pasante Junior".

---

## ⚡ Desarrollo Acelerado

Este proyecto está evolucionando **extremadamente rápido**. Iteramos rápidamente para llevar la ejecución implacable a tu flujo de trabajo.
Las actualizaciones son frecuentes. Mantén tu versión actualizada.
