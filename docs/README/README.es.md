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

Un sistema colaborativo de 6 agentes que convierte incluso a **modelos de menor rendimiento** en un equipo de codificación altamente confiable.

**Idea central**: Dividir tareas complejas en unidades atómicas, verificar cada paso y corregir errores automáticamente.

---

## ¿Por qué Orchestrator?

| Tradicional | Con Orchestrator |
|-------------|------------------|
| Un gran prompt → Con suerte funciona | Tareas atómicas → Verificadas en cada paso |
| Requiere modelos costosos | Modelos fijos y asequibles funcionan bien |
| Los errores se acumulan silenciosamente | Bucle de autocuración (Self-correcting) |
| Resultados impredecibles | **Estrategia de ejecución implacable** |

---

- **🧩 Orquestación DAG Paralela** — Ejecución concurrente de tareas independientes
- **🎯 Optimización de Modelo Fijo** — Alta confiabilidad incluso con LLMs de bajo rendimiento
- **🦀 Núcleo en Rust** — Herramientas de búsqueda y análisis nativas, rápidas y seguras
- **🧠 Micro-Tareas 2.0** — Descomposición de tareas atómicas basada en JSON
- **🛡️ Guardián de Estilo** — Linting estricto basado en AST y comprobaciones de consistencia
- **🔄 Bucle de Autocuración** — Estrategias de pivote autónomas para errores complejos
- **🏘️ Agrupamiento Inteligente** — Emparejamiento de Coder + Reviewer para cada tarea
- **🏗️ Rendimiento Impulsado por Rust** — Rendimiento nativo para tareas pesadas

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

## 🏛️ Filosofía del Proyecto: Ejecución Implacable (Relentless Execution)

No creemos en la IA "rápida". Creemos en la IA **correcta**. Nuestros agentes son implacables. No se detienen cuando encuentran un error; pivotan, re-planifican y siguen adelante hasta lograr el objetivo.

### Flujo de Misión de 5 Fases

1.  **🧠 Fase 1: Análisis Profundo (Pensar Primero)**: Nada de codificar a ciegas. Los agentes deben leer los documentos y resumir los límites centrales del proyecto primero.
2.  **🌲 Fase 2: Planificación Jerárquica**: Descomposición desde una visión arquitectónica de alto nivel hasta micro-tareas atómicas y paralelas (DAG JSON).
3.  **👥 Fase 3: Ejecución Paralela**: Ejecución concurrente de tareas independientes para maximizar la eficiencia.
4.  **🛡️ Fase 4: Puerta de Sincronización Global**: Después de que los flujos paralelos se unen, una **Comprobación de Consistencia Global** asegura que todos los archivos, importaciones y exportaciones se mantengan en perfecta sincronía.
5.  **⏳ Fase 5: Finalización Implacable**: Sin límites de tiempo artificiales. El éxito solo se define por un "PASS" 100% verificado. Ejecutamos tanto tiempo como sea necesario para alcanzar la perfección.

---

## ⚡ Desarrollo Acelerado

Este proyecto está evolucionando **extremadamente rápido**. Iteramos rápidamente para llevar la ejecución implacable a tu flujo de trabajo.
Las actualizaciones son frecuentes. Mantén tu versión actualizada.
