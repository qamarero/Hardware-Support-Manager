---
tags: [rma, metricas, reporte, api]
aliases: [Dashboard RMA, Reporte semanal RMA]
updated: 2026-07-10
---

# Métricas RMA

> Ahora es el **reporte de soporte completo** (incidencias **+** RMA) en `/metricas`
> («Métricas soporte»), no solo RMA. Este documento describe esa pestaña.

Pestaña `/metricas` (nav, junto a «Panel») + endpoint externo para el Main Portal.
Da visibilidad de la operativa de incidencias y de [[Estados de RMA|RMA]] y permite exportar
un reporte semanal. Forma parte de la [[Operativa]] (PROYECTO ⑫; ver [[proyecto_log]]).

El reporte tiene **dos bloques**: **Incidencias** (abiertas, >7 días, cumplimiento SLA, tiempo
medio de resolución, resueltas, cambios de estado) y **RMA** (los de abajo).

## Qué muestra

- **KPI cards** con delta vs la semana anterior: RMA activos, RMA abiertos >7 días
  (aging descontando pausas, ver [[SLA y pausas]]), cambios de estado, solicitudes
  tramitadas, tiempo medio hasta tramitar y % dentro de objetivo.
- **Tabla-reporte semanal** editable: por cada métrica → objetivo, valor de la semana,
  valor de la semana anterior, **responsable**, **semáforo** y **comentario**. El semáforo
  se sugiere solo por umbral y se puede sobrescribir; responsable/semáforo/comentario se
  **guardan y son compartidos** (tabla `hsm.rma_metric_reviews`).
- **Charts** (barras): reparto por estado, cambios de estado por día, resultados al cierre
  y turnaround por proveedor.

## Definiciones clave

- **«Tiempo hasta tramitar»** = horas desde que se crea el RMA hasta el primer paso a
  `Solicitado` (objetivo 2 h, configurable en el catálogo `src/lib/constants/rma-metrics.ts`).
  Los RMA no registran «primera respuesta real»; este es el proxy medible.
- Los tiempos entre estados se derivan de `event_logs` (los RMA solo guardan el último
  `state_changed_at`).

## Export

- **CSV** (para Excel) y **PDF** (vista imprimible de una página, «Guardar como PDF»).

## Endpoint externo (Main Portal)

`GET /api/external/metrics` incluye un bloque `rmas` (actual vs semana anterior). Las
mutaciones de RMA invalidan la caché externa, así que los cambios llegan sin desfase. Ver
[[Intercom]] no aplica aquí; la clave del portal es `MAIN_PORTAL_API_KEY` (ver
[[Variables de entorno]]) y la spec en `docs/connectors/hsm-public-api-spec.md`.

## Relacionado

- [[Estados de RMA]]
- [[SLA y pausas]]
- [[Operativa]]
- [[RMA por proveedor]]
- [[Variables de entorno]]
- [[Deploy]]
- [[Inicio]]
