# HSM Public API — Spec

## Overview

Dos endpoints públicos para herramientas externas autorizadas (CRMs, análisis, integraciones). Devuelven datos detallados (incluyendo PII) + agregados estadísticos:

- **`GET /api/external/incidents`** — incidencias con todos los campos + breakdowns por estado/prioridad/categoría/origen + métricas SLA
- **`GET /api/external/rmas`** — RMAs con todos los campos + breakdowns por estado/proveedor

**Base URL:** `https://<your-hsm-domain>`

## Authentication

**Mismo secret para ambos endpoints.** Header obligatorio:

```
X-API-Key: <shared-secret>
```

Validado server-side con `crypto.timingSafeEqual` contra `HSM_PUBLIC_API_KEY` (env var en Vercel).

**Secret independiente** de `MAIN_PORTAL_API_KEY` — rotar uno NO afecta al otro.

---

# Endpoint 1: `GET /api/external/incidents`

## Query parameters

Todos opcionales. Todos los CSV separan con coma.

| Param | Tipo | Default | Valores aceptados |
|-------|------|---------|-------------------|
| `from` | YYYY-MM-DD | hoy - 30 días | Rango de creación (incluye día completo en UTC) |
| `to` | YYYY-MM-DD | hoy | Rango de creación |
| `status` | CSV | — (todos) | `open`, `closed`, o estados específicos: `nuevo`, `en_triaje`, `en_gestion`, `esperando_cliente`, `esperando_proveedor`, `resuelto`, `cerrado`, `cancelado`. Los aliases `open`/`closed` se expanden. |
| `priority` | CSV | — | `baja`, `media`, `alta`, `critica` |
| `category` | CSV | — | `escalado`, `incidencia_directa`, `mencion`, `otro`, `consulta_rapida` |
| `hardware_origin` | CSV | — | `qamarero`, `cliente_reciclado` |
| `assigned_user_id` | CSV UUIDs | — | Filtrar por técnico asignado |
| `search` | string | — | Busca substring (ILIKE) en: número incidencia, título, cliente, marca, modelo, serial, intercom_id |
| `page` | int | 1 | Paginación (1-based) |
| `page_size` | int | 50 | 1-200 |

### Status aliases

- `open` se expande a: `nuevo,en_triaje,en_gestion,esperando_cliente,esperando_proveedor`
- `closed` se expande a: `resuelto,cerrado,cancelado`

Combinables: `?status=open,cancelado` → todos los abiertos + los cancelados.

## Response

`200 OK` con shape:

```json
{
  "generated_at": "2026-05-13T13:30:00.000Z",
  "schema_version": "1.0.0",

  "filters": {
    "from": "2026-04-13",
    "to": "2026-05-13",
    "status": ["nuevo", "en_triaje", "en_gestion", "esperando_cliente", "esperando_proveedor"],
    "priority": null,
    "category": null,
    "hardware_origin": null,
    "assigned_user_id": null,
    "search": null
  },

  "summary": {
    "total_count": 1234,
    "open_count": 47,
    "closed_count": 1187,

    "by_status": [
      { "status": "nuevo", "label": "Nuevo", "count": 5 },
      { "status": "en_gestion", "label": "En Gestión", "count": 23 },
      ...
    ],

    "by_priority": [
      { "priority": "critica", "label": "Crítica", "count": 2 },
      { "priority": "alta", "label": "Alta", "count": 45 },
      ...
    ],

    "by_category": [
      { "category": "escalado", "label": "Escalado", "count": 80 },
      ...
    ],

    "by_hardware_origin": [
      { "hardware_origin": "qamarero", "label": "Qamarero", "count": 850 },
      { "hardware_origin": "cliente_reciclado", "label": "Reciclado cliente", "count": 340 },
      { "hardware_origin": null, "label": null, "count": 44 }
    ],

    "sla_compliance_pct": 92.5,
    "avg_resolution_hours": 18.3,
    "overdue_count": 8,

    "aging_distribution": [
      { "bucket": "lt_1d", "count": 12 },
      { "bucket": "1_3d", "count": 18 },
      { "bucket": "3_7d", "count": 11 },
      { "bucket": "gt_7d", "count": 6 }
    ]
  },

  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "incident_number": "INC-2026-00123",
      "status": "en_gestion",
      "status_label": "En Gestión",
      "priority": "alta",
      "category": "escalado",
      "hardware_origin": "qamarero",
      "title": "TPV no enciende",
      "description": "El terminal del cliente no enciende...",

      "client": {
        "id": "uuid",
        "name": "Berraco SL",
        "company_name": "Restaurante Berraco"
      },

      "assigned_user": {
        "id": "uuid",
        "name": "Domi"
      },

      "device": {
        "type": "tpv",
        "brand": "Sunmi",
        "model": "T2",
        "serial_number": "ABC123",
        "value_cents": 45000
      },

      "contact": {
        "name": "Juan García",
        "phone": "+34 612 345 678"
      },

      "pickup": {
        "address": "C/ Mayor 12",
        "city": "Madrid",
        "postal_code": "28001"
      },

      "intercom": {
        "url": "https://app.intercom.com/...",
        "escalation_id": "12345678"
      },

      "resolution_type": null,
      "quick_duration_minutes": null,

      "created_at": "2026-05-10T08:30:00.000Z",
      "updated_at": "2026-05-12T14:20:00.000Z",
      "resolved_at": null,
      "state_changed_at": "2026-05-11T10:00:00.000Z",

      "age_hours_in_state": 54.3,
      "age_hours_total": 78.5,

      "sla_paused_ms": "3600000"
    }
  ],

  "pagination": {
    "page": 1,
    "page_size": 50,
    "total_pages": 25,
    "total_count": 1234
  }
}
```

### Field reference

#### Top-level

| Field | Type | Notes |
|-------|------|-------|
| `generated_at` | ISO 8601 datetime | UTC, momento en que se generó la respuesta |
| `schema_version` | string | Semver. Cambios mayores = breaking change. Actual: `1.0.0` |
| `filters` | object | Echo de los filtros aplicados tras parsing/validación |
| `summary` | object | Agregados sobre TODOS los registros que cumplen los filtros (no solo la página) |
| `data` | array | Página actual de incidencias |
| `pagination` | object | Metadatos de paginación |

#### Per incident (`data[]`)

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Primary key |
| `incident_number` | string | Formato `INC-YYYY-NNNNN` |
| `status` | enum | Estado actual (ver lista arriba) |
| `status_label` | string | Label en español traducido |
| `priority` | enum | `baja`/`media`/`alta`/`critica` |
| `category` | enum | Ver categorías arriba |
| `hardware_origin` | enum \| null | `qamarero`/`cliente_reciclado` o null en registros legacy |
| `title` | string | Título de la incidencia |
| `description` | string \| null | Descripción completa |
| `client.id` | UUID \| null | FK a tabla clients (null si solo texto libre) |
| `client.name` | string \| null | Nombre cliente tal como se guardó en la incidencia |
| `client.company_name` | string \| null | Nombre actual de la empresa (joined) |
| `assigned_user.id` | UUID \| null | FK a tabla users |
| `assigned_user.name` | string \| null | Nombre del técnico asignado |
| `device.*` | object | Tipo, marca, modelo, serial, valor en céntimos |
| `contact.*` | object | **PII** — nombre y teléfono del contacto |
| `pickup.*` | object | **PII** — dirección de recogida |
| `intercom.url` | string \| null | **PII** — URL completa a la conversación Intercom |
| `intercom.escalation_id` | string \| null | ID de la conversación/ticket Intercom |
| `resolution_type` | string \| null | Tipo de resolución (`standard`, `derivado_rma`, etc.) |
| `quick_duration_minutes` | int \| null | Minutos cuando `category = consulta_rapida` |
| `created_at` | ISO 8601 | UTC |
| `updated_at` | ISO 8601 | UTC, last modified |
| `resolved_at` | ISO 8601 \| null | UTC, null si no resuelto |
| `state_changed_at` | ISO 8601 | UTC, momento del último cambio de estado |
| `age_hours_in_state` | number \| null | Horas (con 1 decimal) desde `state_changed_at` |
| `age_hours_total` | number \| null | Horas (con 1 decimal) desde `created_at` |
| `sla_paused_ms` | string (numeric) | Milisegundos acumulados en estados de SLA pausado (`esperando_cliente` / `esperando_proveedor`). String porque puede exceder MAX_SAFE_INTEGER en teoría. |

#### Aging buckets

| Bucket | Significado |
|--------|-------------|
| `lt_1d` | Menos de 24h en estado actual |
| `1_3d` | 1-3 días |
| `3_7d` | 3-7 días |
| `gt_7d` | Más de 7 días |

Snapshot: cuenta SOLO incidencias actualmente abiertas (no las del rango histórico).

## Caching

- Server-side cache: 30s (`unstable_cache` con key por query params completos)
- Response header: `Cache-Control: max-age=30, public`

Si la herramienta consumidora tiene su propio cache, puede usar este header.

## Errors

| Status | Body | Causa |
|--------|------|-------|
| 200 | OK | — |
| 400 | `{ error, detail }` | Param inválido (date format, page <0, page_size>200, from>to) |
| 401 | `{ error: "Missing X-API-Key header" }` | Sin header |
| 403 | `{ error: "Invalid API key" }` | Header no coincide |
| 500 | `{ error, detail }` | Error inesperado (consulta logs Vercel) |
| 503 | `{ error: "HSM_PUBLIC_API_KEY no configurada", detail }` | Env var no seteada en Vercel |

## Example requests

```bash
# Todas las incidencias abiertas (últimos 30 días)
curl -s "https://<hsm-domain>/api/external/incidents?status=open" \
  -H "X-API-Key: $HSM_PUBLIC_API_KEY" | jq .summary

# Solo críticas + altas, este mes
curl -s "https://<hsm-domain>/api/external/incidents?priority=critica,alta&from=2026-05-01&to=2026-05-31" \
  -H "X-API-Key: $HSM_PUBLIC_API_KEY" | jq '.data[].incident_number'

# Buscar por número de incidencia
curl -s "https://<hsm-domain>/api/external/incidents?search=INC-2026-00123" \
  -H "X-API-Key: $HSM_PUBLIC_API_KEY" | jq .

# Solo consultas rápidas in-situ
curl -s "https://<hsm-domain>/api/external/incidents?category=consulta_rapida&page_size=100" \
  -H "X-API-Key: $HSM_PUBLIC_API_KEY" | jq .

# Paginar resultados
curl -s "https://<hsm-domain>/api/external/incidents?page=2&page_size=20" \
  -H "X-API-Key: $HSM_PUBLIC_API_KEY"
```

---

# Endpoint 2: `GET /api/external/rmas`

## Query parameters

Todos opcionales.

| Param | Tipo | Default | Valores aceptados |
|-------|------|---------|-------------------|
| `from` | YYYY-MM-DD | hoy - 30 días | Rango de creación |
| `to` | YYYY-MM-DD | hoy | Rango de creación |
| `status` | CSV | — | `open` (todos los activos), `closed` (cerrado/cancelado), o estados específicos: `borrador`, `solicitado`, `aprobado`, `enviado_proveedor`, `en_proveedor`, `devuelto`, `recibido_oficina`, `cerrado`, `cancelado` |
| `provider_id` | CSV UUIDs | — | Filtrar por proveedor |
| `search` | string | — | Busca en número RMA, proveedor, cliente, marca, modelo, serial, nº incidencia |
| `page` | int | 1 | Paginación |
| `page_size` | int | 50 | 1-200 |

### Status aliases (RMA)

- `open` → `borrador,solicitado,aprobado,enviado_proveedor,en_proveedor,devuelto,recibido_oficina`
- `closed` → `cerrado,cancelado`

## Response

```json
{
  "generated_at": "2026-05-13T13:30:00.000Z",
  "schema_version": "1.0.0",

  "filters": {
    "from": "2026-04-13",
    "to": "2026-05-13",
    "status": null,
    "provider_id": null,
    "search": null
  },

  "summary": {
    "total_count": 87,
    "open_count": 23,
    "closed_count": 64,

    "by_status": [
      { "status": "borrador", "label": "Borrador", "count": 2 },
      { "status": "en_proveedor", "label": "En Proveedor", "count": 12 },
      ...
    ],

    "by_provider": [
      { "provider_id": "uuid", "provider_name": "Jassway", "count": 45 },
      { "provider_id": "uuid", "provider_name": "Sunmi", "count": 30 },
      ...
    ]
  },

  "data": [
    {
      "id": "uuid",
      "rma_number": "RMA-2026-00045",
      "status": "en_proveedor",
      "status_label": "En Proveedor",

      "incident": {
        "id": "uuid",
        "number": "INC-2026-00123"
      },

      "provider": {
        "id": "uuid",
        "name": "Jassway",
        "rma_number": "JW-RMA-987"
      },

      "client": {
        "id": "uuid",
        "name": "Berraco SL",
        "company_name": "Restaurante Berraco",
        "external_id": "rest_123",
        "intercom_url": "https://app.intercom.com/..."
      },

      "device": {
        "type": "tpv",
        "brand": "Jassway",
        "model": "JWS-360",
        "serial_number": "ABC123",
        "value_cents": 45000
      },

      "contact": {
        "name": "Juan García",
        "phone": "+34 612 345 678"
      },

      "pickup": {
        "address": "C/ Mayor 12",
        "city": "Madrid",
        "postal_code": "28001"
      },

      "tracking": {
        "outgoing": "1Z999AA10123456784",
        "return": null
      },

      "costs": {
        "repair_cents": null,
        "shipping_cents": 2500,
        "replacement_cents": null
      },

      "notes": "Cliente reporta fallo intermitente al imprimir...",

      "created_at": "2026-05-08T10:00:00.000Z",
      "updated_at": "2026-05-12T14:20:00.000Z",
      "state_changed_at": "2026-05-10T09:00:00.000Z",
      "age_hours_in_state": 76.5,
      "age_hours_total": 124.2
    }
  ],

  "pagination": {
    "page": 1,
    "page_size": 50,
    "total_pages": 2,
    "total_count": 87
  }
}
```

### RMA status reference

| Status | Significado |
|--------|-------------|
| `borrador` | RMA creado pero aún no enviado al proveedor |
| `solicitado` | Solicitud enviada al proveedor, pendiente respuesta |
| `aprobado` | Proveedor aprobó el RMA |
| `enviado_proveedor` | Dispositivo enviado físicamente al proveedor |
| `en_proveedor` | Proveedor está reparando/sustituyendo |
| `devuelto` | Proveedor devolvió el dispositivo (en tránsito de vuelta) |
| `recibido_oficina` | Recibido en oficina HSM, pendiente de devolver al cliente |
| `cerrado` | Cerrado (resuelto exitosamente) |
| `cancelado` | RMA cancelado (no procede) |

## RMA Examples

```bash
# Todos los RMAs activos
curl -s "https://<hsm-domain>/api/external/rmas?status=open" \
  -H "X-API-Key: $HSM_PUBLIC_API_KEY" | jq .summary

# Solo en proveedor (esperando reparación)
curl -s "https://<hsm-domain>/api/external/rmas?status=en_proveedor,enviado_proveedor" \
  -H "X-API-Key: $HSM_PUBLIC_API_KEY" | jq '.data[].rma_number'

# RMAs de Jassway este mes
curl -s "https://<hsm-domain>/api/external/rmas?provider_id=<uuid-jassway>&from=2026-05-01" \
  -H "X-API-Key: $HSM_PUBLIC_API_KEY"
```

---

## Operational notes

- **Rate limits**: ninguno por ahora. Si el consumidor abusa, considerar añadir uno (ver patrón en `src/lib/utils/rate-limit.ts`).
- **Rotación de secret**: cambiar `HSM_PUBLIC_API_KEY` en Vercel y redeploy. El consumidor recibe 403 hasta actualizar su key. Afecta a AMBOS endpoints simultáneamente.
- **PII**: ambos endpoints exponen datos personales (nombres, teléfonos, direcciones, URLs Intercom). El consumidor es responsable de almacenarlos según normativa aplicable (GDPR).
- **Schema version**: ante cualquier breaking change (renombre/eliminación de campos), incrementar `schema_version`. Los campos nuevos no rompen la spec — solo añadir.

## Changelog

- **1.0.0** (2026-05-13): versión inicial — endpoints `/incidents` y `/rmas`
