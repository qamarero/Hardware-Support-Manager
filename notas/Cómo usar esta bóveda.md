---
tags: [meta]
aliases: [Convenciones, Guía de la bóveda]
updated: 2026-07-10
---

# Cómo usar esta bóveda

Convenciones para que la bóveda se mantenga navegable y útil con el tiempo. Empieza siempre por [[Inicio]].

## Estructura
- La **raíz del repo** es la bóveda, pero solo la carpeta `notas/` contiene notas propias. El resto (código, `node_modules`, `.next`…) está **excluido** en la configuración de Obsidian para no ensuciar el buscador ni el grafo.
- Carpetas y su intención:
  - `Mapas/` — vistas panorámicas de un área (tipo índice). Ej.: [[Arquitectura]], [[Operativa]].
  - `Procedimientos/` — pasos para **hacer** algo. Ej.: [[RMA por proveedor]], [[Ronda diaria]].
  - `Conceptos/` — qué es y cómo funciona algo. Ej.: [[Estados de RMA]], [[SLA y pausas]].
  - `Referencias/` — datos concretos (conexiones, IDs, entorno). Ej.: [[Supabase]], [[Intercom]].
  - `Plantillas/` — arranca desde [[Plantilla - Procedimiento]] o [[Plantilla - Concepto]].

## Enlaces
- Enlaza siempre con `[[Nombre de la nota]]`. Escribe `[[` y Obsidian autocompleta.
- También puedes enlazar a documentos del repo: `[[ONBOARDING]]`, `[[proyecto_log]]`, `[[CLAUDE]]`, `[[AGENTS]]`.
- Toda nota termina con una sección **## Relacionado**.
- Enlaza con generosidad: un enlace de más no molesta; uno de menos deja la nota huérfana en el grafo.

## Tags
Van en el frontmatter (`tags: [...]`). Vocabulario habitual:
`#rma` · `#incidencia` · `#intercom` · `#sla` · `#estados` · `#procedimiento` · `#concepto` · `#referencia` · `#operativa` · `#mapa`

## Crear una nota
1. Créala dentro de la carpeta que le corresponda (Obsidian ya deja las nuevas en `notas/`).
2. Parte de una plantilla: [[Plantilla - Procedimiento]] o [[Plantilla - Concepto]].
3. Rellena el frontmatter (`tags`, `updated`) y cierra con **## Relacionado**.

## Git
- Las notas (`notas/`) **se versionan** en `main` junto al código: backup y compartidas con el equipo.
- La configuración local de Obsidian (`.obsidian/`) **no** se versiona (es estado de tu máquina).

## Relacionado
- [[Inicio]]
- [[Plantilla - Procedimiento]] · [[Plantilla - Concepto]]
