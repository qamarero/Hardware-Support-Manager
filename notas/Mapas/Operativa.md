---
tags: [operativa, mapa]
aliases: []
updated: 2026-07-10
---

# Operativa

Cómo se trabaja HSM a diario: triage en las listas, la **Ronda** dentro de "Mi día", la vigilancia del SLA y la derivación **incidencia → RMA**. Este es un mapa: enlaza a los procedimientos y conceptos concretos. Para el contexto general arranca por [[Inicio]] y [[Dominio]]; si es tu primer día, lee también [[ONBOARDING]].

> HSM es intermediario **cliente ↔ proveedor/SAT ↔ almacén/oficina**. No se repara: se gestiona el ciclo de vida de **incidencias** (`INC-YYYY-NNNNN`) y **RMAs** (`RMA-YYYY-NNNNN`).

## El día en cuatro movimientos

1. **Bandeja** — revisar escalaciones nuevas de Intercom y convertirlas en incidencia. Ver [[Escalaciones Intercom]].
2. **Triage** — clasificar y asignar lo que entra en las listas.
3. **Ronda** — recorrer lo abierto en "Mi día" (viejas → nuevas) y dejar constancia. Ver [[Ronda diaria]].
4. **Vigilancia SLA** — no dejar que nada se estanque fuera de pausa. Ver [[SLA y pausas]].

## Triage en las listas

Punto de partida cuando llega trabajo (desde la Bandeja o alta manual):

- **Prioridad binaria**: solo dos niveles — "Cliente puede operar" vs "Cliente no puede operar". No hay 4 niveles. Ver [[Prioridad binaria]].
- **Triage en la lista de incidencias**: filtro "Mías", asignar técnico y prioridad **inline**, y **selección masiva** para actuar en bloque.
- **Atajo "Iniciar Gestión"** (botón Zap cuando la incidencia está en `nuevo`): salta directo a `en_gestion` en un paso. Ver [[Estados de incidencia]].
- Los estados **no son lineales**: se puede saltar a cualquier estado (con `force`), conservando la pausa de SLA. No reintroducir bloqueos de grafo.

## La Ronda diaria ("Mi día")

Ruta `/mi-dia` (componentes `src/components/mi-dia`). Layout a 2 columnas: **Ronda** principal + **Recordatorios** lateral. Detalle completo en [[Ronda diaria]].

- **Cola** = incidencias mías abiertas + RMA activos, **más antiguas primero**, ocultando las ya revisadas hoy.
- Dos vistas: **Tarjetas** (`ronda-tarjetas.tsx`, baraja gamificada con atajos →/Enter/S) y **Tabla** (`ronda-tabla.tsx`).
- Por cada caso, el recorrido es: estado → **¿Contacté?** → **Siguiente paso**.
  - **"Contacté"** es auditable: registra un `event_log` (`action:"contacted"`, vía `src/server/actions/follow-up.ts`). Es la fuente de verdad del seguimiento.
  - **"Siguiente paso"** crea un recordatorio y además pasa la entidad a **"Esperando al cliente"** (pausa el SLA con `force`).
- **"Revisada hoy"** es **compartida por el equipo** (tabla `hsm.daily_reviews`): si alguien marca un caso, sale de la ronda de todos ese día.
- **Hint de Intercom**: orientativo, **no autoritativo** — muestra el último mensaje del cliente y el nuestro para que juzgues; la verdad la fija el "Contacté" manual.

## Vigilancia del SLA

- El SLA se **pausa** en los estados que quedan fuera de nuestro control. En incidencias: `esperando_cliente`, `esperando_proveedor`, `esperando_pieza`. En RMA: `solicitado` (esperando aprobación), `enviado_cliente`, entre otros. Ver [[SLA y pausas]].
- El **cronómetro SLA** y el indicador "SLA en pausa" son visibles en la ficha; el dashboard muestra "SLA en riesgo" (>80% del umbral consumido) y "Fuera de SLA".
- Regla práctica: si estás esperando a un tercero, deja la entidad en el estado de espera correcto para no penalizar el SLA injustamente.

## Flujo incidencia → RMA

Cuando el equipo tiene que salir al proveedor/SAT:

- **"Derivar a RMA"** abre el **`InlineRmaSheet`** (`src/components/incidents/inline-rma-sheet.tsx`): un panel lateral con el formulario **pre-rellenado** desde la incidencia (cliente, dispositivo, dirección, teléfono, Intercom). Normalmente solo queda **elegir proveedor**.
- Caben **N RMAs por incidencia** (la FK `rmas.incident_id` es nullable y sin unique).
- Al derivar, el RMA arranca en su ciclo (`solicitado` pausa el SLA mientras el proveedor aprueba). Ver [[Estados de RMA]].
- Antes de tramitar, consulta el procedimiento del proveedor y sus datos de recogida/envío: [[RMA por proveedor]].
- Cuando el equipo vuelve o se envía al cliente, se le pega su **etiqueta con QR**: ver [[Etiquetas QR]].
- Al **cerrar el RMA** es obligatorio capturar el `outcome`; el cierre puede **auto-cerrar** la incidencia vinculada.

## Relacionado

- [[Ronda diaria]]
- [[SLA y pausas]]
- [[Estados de incidencia]]
- [[Estados de RMA]]
- [[Prioridad binaria]]
- [[RMA por proveedor]]
- [[Escalaciones Intercom]]
- [[Etiquetas QR]]
- [[Dominio]]
- [[Inicio]]
- [[ONBOARDING]]
- [[proyecto_log]]
