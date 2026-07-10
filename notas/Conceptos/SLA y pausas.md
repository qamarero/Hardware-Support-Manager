---
tags: [sla, concepto]
aliases: []
updated: 2026-07-10
---

# SLA y pausas

El SLA mide **cuánto tiempo llevamos con un caso encima** frente a un límite por prioridad. La clave operativa: cuando el caso está **fuera de nuestro alcance** (esperando a un tercero), el reloj se **pausa** y ese tiempo no cuenta contra nosotros.

Definido en `src/lib/constants/sla.ts`, `src/lib/constants/statuses.ts`, `src/components/proto/badges.tsx`, `src/lib/utils/aging.ts` y `src/lib/utils/sla-sql.ts`.

## Umbrales de resolución

`DEFAULT_SLA_THRESHOLDS.resolution` (horas hasta considerar el caso fuera de SLA), por prioridad:

- `critica`: 8 h
- `alta`: 24 h
- `media`: 72 h
- `baja`: 168 h

Recuerda que en HSM la [[Prioridad binaria]] real es media/crítica: en la práctica los umbrales que usamos son **72 h (puede operar)** y **8 h (no puede operar)**. Si no se encuentra umbral, el cálculo cae a **168 h** por defecto.

## Cómo se pausa el reloj

Hay dos listas de estados "en pausa" en `statuses.ts`:

- **Incidencias** — `PAUSED_INCIDENT_STATES`: `esperando_cliente`, `esperando_proveedor`, `esperando_pieza`.
- **RMA** — `PAUSED_RMA_STATES`: `solicitado`, `enviado_proveedor`, `en_proveedor`, `enviado_cliente`, `esperando_cliente`.

Todos ellos representan situaciones **fuera de nuestro alcance**: el balón está en el tejado del cliente, del proveedor o a la espera de una pieza. Mientras el caso vive en uno de esos estados, el SLA no corre.

### Acumulación en `slaPausedMs`

El tiempo pausado **no se descuenta en tiempo real**: se acumula **al salir** del estado en pausa. En las server actions de transición (`src/server/actions/incidents.ts` y `src/server/actions/rmas.ts`), cuando el estado de origen está en la lista de pausa:

1. Se calcula la duración pausada: `now - stateChangedAt`.
2. Se suma al total previo y se guarda en la columna `slaPausedMs`.

Así, cada vez que reactivas un caso, el rato que estuvo esperando queda descontado para siempre. `slaPausedMs` se almacena como texto (varchar) para incidencias; las consultas hacen `CAST(sla_paused_ms AS bigint)`.

## El cálculo del SLA

`slaProgress()` en `badges.tsx` devuelve `{ pct, level, label }`:

- **Referencia temporal**: si está en pausa → `stateChangedAt` (congelado al entrar); si está cerrado → `resolvedAt ?? stateChangedAt`; si activo → ahora.
- **Transcurrido**: `ref - createdAt - slaPausedMs` (nunca negativo).
- **Porcentaje**: transcurrido / umbral, tope 100 %.
- **Nivel**: `paused` si está en pausa · `bad` si ≥ 100 % · `warn` si ≥ 75 % · `ok` en el resto.
- **Etiqueta**: `"En pausa"`, `"+Xh fuera de SLA"` o `"Xh restantes"`.

En SQL (`sla-sql.ts`) el mismo cálculo se hace con `slaElapsedHours` (`(now - created)*1000 - slaPausedMs`) para casos abiertos y `slaResolvedHours` para cerrados. El umbral de aviso por defecto en las consultas es el **80 %**.

## La barra `SlaBar`

El componente `SlaBar` de `badges.tsx`:

- Si el caso está en pausa, no dibuja barra: muestra el texto `⏸ En pausa`.
- Si no, dibuja una barra cuyo ancho es el `pct` y cuyo color depende del nivel (`ok` / `warn` / `bad`). El `title` (tooltip) muestra la etiqueta con las horas restantes o de exceso.

## Aging (tiempo en estado)

No confundir con el SLA. El **aging** (`calculateAging` en `aging.ts`) mide cuánto lleva el caso en su estado actual y tiene tres modos:

- **`active`**: `now - stateChangedAt`. Marca `isOverdue` si supera el umbral de días (por defecto 3). Es el único modo que se considera "vencido".
- **`paused`**: congelado en `stateChangedAt`, descontando `slaPausedMs`. Nunca es overdue.
- **`closed`**: congelado en `resolvedAt ?? stateChangedAt`, descontando pausas; mide la vida total del caso desde `createdAt`.

Devuelve una etiqueta legible tipo `"2d 4h"`, `"5h 30m"` o `"12m"`. Comparte con el SLA la misma idea: los estados en pausa **no acumulan antigüedad activa**.

## Relacionado

- [[Estados de incidencia]]
- [[Estados de RMA]]
- [[Prioridad binaria]]
- [[Ronda diaria]]
- [[Operativa]]
- [[Dominio]]
- [[Inicio]]
