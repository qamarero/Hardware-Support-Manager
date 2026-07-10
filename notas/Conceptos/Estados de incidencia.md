---
tags: [incidencia, estados, concepto]
aliases: []
updated: 2026-07-10
---

# Estados de incidencia

Los estados representan la **situación actual** de una incidencia (INC-YYYY-NNNNN), no un flujo rígido. El modelo es **no lineal**: con `force` se puede saltar a cualquier estado. Definición del grafo en `src/lib/state-machines/incident.ts`; etiquetas y enum en `src/lib/constants/incidents.ts`; grupos (abierto/cerrado/pausado) en `src/lib/constants/statuses.ts`.

## Lista de estados

Identificador interno → etiqueta que ve el equipo (y que se sincroniza en las notas de [[Intercom]]):

| Interno | Etiqueta UI | Grupo |
|---|---|---|
| `nuevo` | Abierta | abierto |
| `en_triaje` | En triaje | abierto |
| `en_gestion` | En curso | abierto |
| `esperando_cliente` | Esperando cliente | abierto · **SLA en pausa** |
| `esperando_proveedor` | Esperando proveedor | abierto · **SLA en pausa** |
| `esperando_pieza` | Esperando resolución del RMA | abierto · **SLA en pausa** |
| `resuelto` | Resuelta | cerrado |
| `cerrado` | Cerrada | cerrado |
| `cancelado` | Cancelada | cerrado |

- **Abiertas / activas**: `nuevo`, `en_triaje`, `en_gestion`, `esperando_cliente`, `esperando_proveedor`, `esperando_pieza`.
- **Cerradas / finalizadas**: `resuelto`, `cerrado`, `cancelado`.
- Al crear la incidencia en la herramienta el triaje se da por hecho, así que en la práctica se arranca en `nuevo` ("Abierta") y se pasa directo a gestión. `en_triaje` existe en el enum pero el grafo no lleva a él.

## SLA y pausas

Estados que **pausan el SLA** (esperamos a un tercero, fuera de nuestro alcance): `esperando_cliente`, `esperando_proveedor`, `esperando_pieza`.

- Al **salir** de un estado pausado, el tiempo parado se acumula en `slaPausedMs` (no cuenta contra el aging).
- `resuelto` fija `resolvedAt` y `resolutionType` (`standard` o `derivado_rma`).
- **Reabrir** (`resuelto` → `en_gestion`) limpia `resolvedAt` / `resolutionType`.

Detalle del cálculo y el aging en [[SLA y pausas]].

## Transiciones del grafo (flujo natural)

Sin `force`, el servidor solo admite estas transiciones (rol entre paréntesis; admin+technician salvo que se indique):

- **Abierta (`nuevo`)** → En curso · Esperando cliente · Cancelar (admin)
- **En curso (`en_gestion`)** → Esperando cliente · Esperando proveedor · Esperando resolución de RMA (`esperando_pieza`) · Resuelto · Cancelar (admin)
- **Esperando cliente** → Reanudar gestión · Esperar pieza · Resuelto · Cancelar (admin)
- **Esperando proveedor** → Reanudar gestión · Esperar pieza · Resuelto · Cancelar (admin)
- **Esperando resolución del RMA (`esperando_pieza`)** → Reanudar gestión · Resuelto · Cancelar (admin)
- **Resuelta** → Cerrar · Reabrir (admin, vuelve a `en_gestion`)

**Cancelar** siempre requiere rol admin.

## Modelo no lineal (force)

- `transitionIncident` (`src/server/actions/incidents.ts`): sin `force` respeta el grafo; con `force` salta a **cualquier** estado, porque el estado es la situación real, no un flujo obligado. **No reintroducir bloqueos** en esta lógica.
- La UI (tablero kanban y drawer de detalle) marca `force` automáticamente cuando el destino no está en el flujo natural, para que el servidor no lo rechace.
- `forceTransitionIncident` es la variante explícita y exige rol **admin**.

## Derivar a RMA

Derivar a RMA **no es una transición** del selector de estado. Se hace con el asistente **"Crear RMA"**, que crea el RMA y deja la incidencia en `esperando_pieza` (SLA en pausa) a la espera de la resolución. Ver [[RMA por proveedor]] y [[Estados de RMA]].

## Relacionado

- [[Estados de RMA]]
- [[SLA y pausas]]
- [[Prioridad binaria]]
- [[RMA por proveedor]]
- [[Escalaciones Intercom]]
- [[Dominio]]
- [[Operativa]]
- [[Inicio]]
