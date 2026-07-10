---
tags: [arquitectura, mapa]
aliases: []
updated: 2026-07-10
---

# Arquitectura

Vista panorámica de cómo está montado HSM por dentro: el stack, las capas de código y los dos sistemas de UI que conviven. Para el "qué gestiona" (incidencias, RMAs, clientes) ve a [[Dominio]]; para el "cómo se opera" ve a [[Operativa]]. Fuentes: [[ONBOARDING]] y [[CLAUDE]].

## Stack

- **Framework**: Next.js 15 (App Router) + TypeScript en modo estricto.
- **Mutaciones**: Server Actions (`src/server/actions/`). Casi no hay REST.
- **Lecturas server-side**: `src/server/queries/`.
- **BD**: Supabase PostgreSQL, esquema `hsm`, vía **Drizzle ORM** (pooler en transaction mode, `prepare: false`). Ver [[Supabase]].
- **Estado de servidor en cliente**: TanStack Query v5 (claves en `src/lib/query-keys.ts`).
- **Estado en URL**: nuqs (filtros, paginación, pestañas).
- **Formularios**: React Hook Form + Zod (validadores en `src/lib/validators/`, compartidos cliente/servidor).
- **Auth**: NextAuth v5 (credenciales; roles admin/technician/viewer). Config en `src/lib/auth/`.
- **Ficheros**: Vercel Blob, tras la abstracción de `src/lib/storage/`.
- **Otros**: Recharts (gráficas), Sonner (toasts), Vitest (tests).

## Capas de código (dónde vive cada cosa)

- **`src/server/actions/`** — todas las mutaciones (`"use server"`). Cada action verifica sesión antes de tocar nada.
- **`src/server/queries/`** — fetching server-side (p.ej. `getIncidents`, `getIncidentById`).
- **`src/lib/validators/`** — esquemas Zod. Se definen una vez y valen para el form (cliente) y para el parse en la action (servidor).
- **`src/lib/state-machines/`** — grafos de transición de estado (`incident.ts`, `rma.ts`). Ver [[Estados de incidencia]] y [[Estados de RMA]]. Recuerda: hay flag `force` para saltar a cualquier estado (ver [[Prioridad binaria]] no; ver nota de estados no lineales en [[Operativa]]).
- **`src/lib/db/schema/`** — una tabla por fichero (`incidents.ts`, `rmas.ts`, `event-logs.ts`, `assets.ts`, `articles.ts`, `reminders.ts`, `intercom-inbox.ts`, `support-submissions.ts`, `clients.ts`, `providers.ts`, `users.ts`, `attachments.ts`, `settings.ts`, `sequences.ts`, `daily-reviews.ts`, `message-templates.ts`, `client-locations.ts`…). Esquema declarado en `hsm-schema.ts` con `pgSchema("hsm")`.
- **`src/lib/storage/`** — subida/borrado de adjuntos detrás de una interfaz (backend Vercel Blob, intercambiable).
- **`src/lib/constants/statuses.ts`** — etiquetas y agrupaciones de estados.
- **`src/lib/intercom/`** — 🔒 zona intocable: cliente REST (`client.ts`), sync bidireccional (`sync.ts`), tipos y detector de dispositivo. Ver [[Intercom]] y [[Escalaciones Intercom]].

### Endpoints REST (los pocos que hay)

- `src/app/api/upload/` — subida de adjuntos (multipart).
- `src/app/api/submit-upload/` — adjuntos del formulario público `/submit`.
- `src/app/api/webhooks/intercom/` — webhook entrante de Intercom.
- `src/app/api/external/{metrics,incidents,rmas}/` — API externa protegida por `X-API-Key` (consumida por el HW Main Portal). Ver [[Variables de entorno]].

## Los DOS sistemas de UI (¡ojo!)

El frontend se reescribió entero desde el prototipo. **El sistema VIVO es "proto"**; el shadcn antiguo es en su mayoría código muerto.

### Proto (VIVO)

- **CSS plano**, no Tailwind, para las pantallas nuevas: `src/app/proto-tokens.css` + `src/app/proto-app.css` (clases `.btn/.card/.kanban/.kcard/.drawer/.sla-bar/…`). Se cargan **después** de `globals.css` en el layout para prevalecer.
- **Componentes proto** (los que renderiza la app real): `src/components/{incidents-v2, rmas-v2, dashboard-v2, providers-v2, users-v2, inventario-v2, tablero-v2, equipos-v2}` + `src/components/{proto, shell, casos, mi-dia, reminders}`.
- **Marca Qamarero**: naranja `#ff592f`, DM Sans (texto) + Space Mono (IDs/números). **MODO CLARO FORZADO** (`ThemeProvider` con `forcedTheme="light"`); no hay variante oscura. No introducir dark mode.

### shadcn legacy (posible CÓDIGO MUERTO)

- `src/components/{incidents, rmas, dashboard, clients, providers, users, warehouse, analytics}` son la UI anterior al rewrite.
- `src/components/ui/` son las primitivas base de shadcn.
- **Excepción**: la Bandeja Intercom (`/intercom`) sigue montada sobre `src/components/intercom/*` (shadcn re-skin), NO proto. Igual las bandejas de `submissions/`.

> Regla de oro antes de editar un componente: **verifica el wiring real** en `src/app/(dashboard)/<ruta>/page.tsx`. Por ejemplo, `incidents/page.tsx` importa `incidents-v2/incidents-screen` y `dashboard/page.tsx` importa `dashboard-v2/dashboard-screen`. Si dudas, el que aparece en el `page.tsx` es el vivo.

## Mapa de carpetas resumido

```
src/
  app/(dashboard)/<ruta>/page.tsx   # cada ruta importa su pantalla proto -v2 (verifica el wiring aquí)
  app/proto-tokens.css · proto-app.css   # sistema de diseño VIVO
  app/api/{upload, submit-upload, webhooks/intercom, external/{metrics,incidents,rmas}}
  components/{...-v2, proto, shell, casos, mi-dia, reminders}   # UI VIVA
  components/{incidents, rmas, dashboard, clients, providers, users, warehouse, analytics, ui}  # UI legacy
  lib/db/schema/        # tablas Drizzle (esquema hsm, un fichero por entidad)
  lib/intercom/         # 🔒 INTOCABLE (client, sync, types, detectores)
  lib/{validators, state-machines, storage, auth}
  lib/constants/statuses.ts · lib/query-keys.ts
  server/actions/ · server/queries/
sql/                    # migraciones aditivas, aplicadas A MANO en Supabase (rol postgres)
docs/proyecto_log.md    # changelog histórico
```

## Migraciones y BD (recordatorio)

Las migraciones son **aditivas** y las aplica a mano el propietario en el SQL Editor de Supabase como rol `postgres` (el rol de la app, `hsm_app`, no tiene DDL). Viven en `sql/`. Detalle completo en [[Supabase]] y [[Deploy]].

## Relacionado

- [[Dominio]] — qué entidades gestiona la app
- [[Operativa]] — cómo se trabaja el día a día
- [[Supabase]] · [[Variables de entorno]] · [[Deploy]]
- [[Intercom]] · [[Escalaciones Intercom]]
- [[Estados de incidencia]] · [[Estados de RMA]] · [[SLA y pausas]]
- [[ONBOARDING]] · [[CLAUDE]] · [[proyecto_log]] · [[AGENTS]]
- [[Inicio]] · [[Cómo usar esta bóveda]]
