---
tags: [incidencia, concepto, prioridad]
aliases: []
updated: 2026-07-10
---

# Prioridad binaria

En HSM la prioridad de una incidencia es **binaria**: solo importa si el cliente puede seguir trabajando o no. No hay 4 niveles que valorar caso por caso; la pregunta es una sola.

## El criterio

Al crear o editar una incidencia eliges entre dos opciones:

- **Cliente puede operar** — el problema molesta pero el local sigue funcionando (valor interno `media`).
- **Cliente no puede operar** — el hardware roto bloquea la operativa del cliente (valor interno `critica`).

Esa es toda la decisión. Si dudas, piensa: "¿el restaurante/local puede seguir cobrando y sirviendo con esto roto?". Si la respuesta es no, es **Cliente no puede operar**.

## Dónde se define

- El selector canónico son solo esas dos opciones: `PRIORITY_OPTIONS` en `src/lib/constants/incidents.ts`.
- Las etiquetas visibles salen de `INCIDENT_PRIORITY_LABELS` (mismo fichero): "Cliente puede operar" / "Cliente no puede operar".
- La validación de formularios y server actions vive en `src/lib/validators/incident.ts` (`createIncidentSchema`).

### Por qué el enum tiene 4 valores

En base de datos y en el schema Zod el campo `priority` todavía admite `baja | media | alta | critica`. Es solo compatibilidad con datos antiguos: la app **no** ofrece `baja` ni `alta` en el selector. Los registros viejos se muestran mapeados al binario mediante:

- `isBlockingPriority(p)` → `true` para `critica` o `alta` (bloquea la operativa).
- `priorityBucket(p)` → normaliza cualquier valor a `media` o `critica`.

Así una incidencia antigua marcada `alta` aparece como "Cliente no puede operar" y una `baja` como "Cliente puede operar", sin tener que migrar la BD.

> No reintroducir los 4 niveles en la UI. El modelo es deliberadamente binario.

## Impacto en el SLA

La prioridad alimenta los umbrales de SLA (`src/lib/constants/sla.ts`). Con el binario, los valores efectivos son:

- **Cliente no puede operar** (`critica`): respuesta 2 h, resolución 8 h.
- **Cliente puede operar** (`media`): respuesta 8 h, resolución 72 h.

(Los umbrales de `alta`/`baja` siguen definidos solo para datos heredados.) Ver [[SLA y pausas]] para cómo se cuenta y cuándo se pausa el reloj.

## Relacionado

- [[Estados de incidencia]]
- [[SLA y pausas]]
- [[Dominio]]
- [[Operativa]]
- [[Plantilla - Concepto]]
- [[Inicio]]
