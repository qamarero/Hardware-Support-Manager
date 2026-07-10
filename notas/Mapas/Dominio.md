---
tags: [dominio, mapa]
aliases: []
updated: 2026-07-10
---

# Dominio

Mapa de las entidades reales de HSM y cómo se relacionan. Todas las tablas viven en el esquema PostgreSQL `hsm` (ver [[Supabase]]) y se definen con Drizzle en `src/lib/db/schema/` (una tabla por fichero). Toda tabla lleva `id` UUID como clave primaria y marcas `created_at` / `updated_at`. Para el contexto técnico general, ver [[Arquitectura]] y [[CLAUDE]].

## Entidades principales

Son los dos objetos que mueve el día a día del equipo. Ambos comparten patrón: número legible propio, datos de dispositivo, contacto y dirección de recogida, y contador de antigüedad con pausa de SLA (`sla_paused_ms`).

### Incidencias — `INC-YYYY-NNNNN`

Ticket de soporte, desde que se reporta un problema de hardware hasta que se resuelve. Definida en `src/lib/db/schema/incidents.ts`.

- **Identificador**: `incident_number` (único).
- **A quién pertenece**: `client_id` (cliente), `client_location_id` (ubicación del cliente), `assigned_user_id` (técnico asignado). También guarda `client_name` como texto por si no hay cliente en catálogo.
- **Clasificación** (enums):
  - `status` → ver [[Estados de incidencia]]: `nuevo`, `en_triaje`, `en_gestion`, `esperando_cliente`, `esperando_proveedor`, `esperando_pieza`, `resuelto`, `cerrado`, `cancelado`.
  - `category`: `escalado`, `incidencia_directa`, `mencion`, `otro`, `consulta_rapida`.
  - `priority`: `baja`, `media`, `alta`, `critica` — en la operativa se usa como binaria, ver [[Prioridad binaria]].
  - `hardware_origin`: `qamarero`, `cliente_reciclado`.
- **Dispositivo**: `device_type`, `device_brand`, `device_model`, `device_serial_number`.
- **Recogida y contacto**: `contact_name`, `contact_phone`, `pickup_address`, `pickup_postal_code`, `pickup_city`.
- **Intercom**: `intercom_url`, `intercom_escalation_id` (vínculo a la conversación de origen; ver [[Escalaciones Intercom]] e [[Intercom]]).
- **Tiempos y SLA**: `state_changed_at`, `sla_paused_ms`, `sla_hours` (objetivo por incidencia; si es null se usa el umbral por prioridad), `resolved_at`. Ver [[SLA y pausas]].
- **Resolución**: `diagnosis`, `resolution`, `resolution_type`, `device_value_cents`. `quick_duration_minutes` solo para consultas rápidas in-situ (`category = consulta_rapida`).

### RMA — `RMA-YYYY-NNNNN`

Autorización de devolución para enviar hardware defectuoso a un proveedor. Definida en `src/lib/db/schema/rmas.ts`.

- **Identificador**: `rma_number` (único).
- **Vínculos**: `incident_id` (opcional, borrado `restrict` — un RMA puede nacer de una incidencia o ser independiente), `provider_id` (obligatorio, borrado `restrict`), `client_id`.
- **Estado** (`status`) → ver [[Estados de RMA]]: `borrador`, `solicitado`, `aprobado`, `enviado_proveedor`, `en_proveedor`, `devuelto`, `recibido_oficina`, `enviado_cliente`, `esperando_cliente`, `entregado_cliente`, `rechazado`, `cerrado`, `cancelado`.
- **Logística/seguimiento**: `tracking_number_outgoing`, `tracking_number_return`, `provider_rma_number`, más los datos de recogida (`pickup_*`) y el bloque `shipping` (jsonb con origen del cliente y destino oficina/SAT/cliente).
- **Métricas de cierre**: `outcome` (reparado/sustituido/abono/rechazado/…), `logistics` (quién gestiona el envío), `repair_path` (interna o proveedor), y costes en céntimos (`device_value_cents`, `repair_cost_cents`, `shipping_cost_cents`, `replacement_cost_cents`).
- **SLA en pausa**: `sla_paused_ms` congela la antigüedad mientras el equipo está en el proveedor. Ver [[SLA y pausas]]. Cómo tramitar según cada proveedor: [[RMA por proveedor]].

## Entidades de apoyo

- **Clientes** (`clients`, `src/lib/db/schema/clients.ts`): empresa o persona que reporta. Campos `name`, `external_id`, `intercom_url`, contacto, dirección. Borrado lógico con `deleted_at`.
- **Ubicaciones de cliente** (`client_locations`): sedes de un cliente (`is_default`, contacto y dirección propios). Borrado en cascada si se borra el cliente.
- **Proveedores** (`providers`, `src/lib/db/schema/providers.ts`): fabricante/distribuidor para RMA. Incluye `contacts` (jsonb) y `rma_process` (jsonb: método email/portal, formularios, si permite envío directo al cliente, pasos). Borrado lógico con `deleted_at`.
- **Usuarios** (`users`): equipo interno. `role`: `admin`, `technician`, `viewer` (ver control de acceso en [[Arquitectura]]). Borrado lógico con `deleted_at`.
- **Artículos** (`articles`): catálogo `device_type` + `brand` + `model`, para normalizar el dispositivo en incidencias y RMA.
- **Equipos / Assets** (`assets`, código `EQ-YYYY-NNNNN`): unidades físicas en oficina, con o sin RMA, para etiquetar e identificar (ver [[Etiquetas QR]]). Vínculos opcionales a `article_id`, `rma_id`, `incident_id`.

## Tablas polimórficas

Dos tablas usan el enum `entity_type` (`incident`, `rma`, `event_log`, `client`) + `entity_id` para colgarse de cualquier entidad:

- **`event_logs`** (`src/lib/db/schema/event-logs.ts`): rastro de auditoría. Guarda `action`, `from_state`/`to_state` (cambios de estado) y `details` (jsonb), con el `user_id` que lo hizo.
- **`attachments`** (`src/lib/db/schema/attachments.ts`): ficheros adjuntos. Guarda `file_name`, `file_url`, `file_size`, `file_type` y `uploaded_by`. El almacenamiento va por Vercel Blob (ver [[Arquitectura]]).

## Bandeja Intercom — `intercom_inbox`

Cola de triaje de escalaciones que llegan por webhook de Intercom (`src/lib/db/schema/intercom-inbox.ts`).

- `intercom_conversation_id` es **único** (deduplicación).
- `status`: `pendiente`, `convertida`, `descartada`.
- Al convertir se rellena `converted_incident_id`, `converted_by_user_id`, `converted_at`; al descartar, `dismissed_*` y `discard_reason` (motivo automático del webhook o descarte manual).
- Guarda `raw_payload` (jsonb) con el evento crudo.
- Flujo completo en [[Escalaciones Intercom]] y detalles de la API en [[Intercom]].

## Formato de IDs y secuencias

- Incidencias, RMA y equipos usan `{PREFIJO}-{AÑO}-{NNNNN}` con 5 dígitos rellenados a cero: `INC-2026-00001`, `RMA-2026-00001`, `EQ-2026-00001`.
- La generación está en `src/lib/utils/id-generator.ts` (`generateSequentialId`), que hace un upsert atómico sobre la tabla `sequences` (clave única `prefix` + `year`).
- El contador **se reinicia cada año** (cada par prefijo+año lleva su propio `last_value`).

## Relaciones (quién apunta a quién)

Definidas en `src/lib/db/schema/relations.ts`:

- **Cliente** → muchas incidencias, muchos RMA, muchas ubicaciones.
- **Incidencia** → un cliente, un técnico asignado, un artículo; puede tener muchos RMA.
- **RMA** → una incidencia (opcional), un proveedor (obligatorio), un cliente, un artículo.
- **Proveedor** → muchos RMA.
- **Artículo** → muchas incidencias y RMA.
- **Usuario** → incidencias asignadas, entradas de `event_logs` y `attachments`.

## Otras tablas

Presentes en `src/lib/db/schema/` y exportadas desde `index.ts`, complementan la operativa: `settings`, `message-templates`, `support-submissions` (formulario público de soporte), `reminders` y `daily-reviews` (ver [[Ronda diaria]] y [[Operativa]]).

## Relacionado

- [[Inicio]]
- [[Cómo usar esta bóveda]]
- [[Arquitectura]]
- [[Estados de incidencia]]
- [[Estados de RMA]]
- [[SLA y pausas]]
- [[Prioridad binaria]]
- [[Escalaciones Intercom]]
- [[Intercom]]
- [[RMA por proveedor]]
- [[Etiquetas QR]]
- [[Supabase]]
- [[Operativa]]
- [[CLAUDE]]
