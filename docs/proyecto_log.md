# Hardware Support Manager - Log del Proyecto

## Descripción
Sistema web interno para un departamento de soporte de hardware que gestiona incidencias y RMAs (Return Merchandise Authorizations) a lo largo de su ciclo de vida completo.

## Stack Tecnológico
- **Framework**: Next.js 15 (App Router)
- **Lenguaje**: TypeScript (strict mode)
- **ORM**: Drizzle ORM
- **Base de datos**: PostgreSQL (Supabase)
- **UI**: shadcn/ui + Tailwind CSS v4
- **Server State**: TanStack Query v5
- **URL State**: nuqs
- **Forms**: React Hook Form + Zod v4
- **Auth**: NextAuth.js v5 (credentials provider)
- **File Storage**: Vercel Blob
- **Deploy**: Vercel

## Variables de Entorno Requeridas (Vercel)
```
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=https://tu-dominio.vercel.app
BLOB_READ_WRITE_TOKEN=<token de Vercel Blob>
```

## Fases Completadas

### Phase 1: Foundation (Completada)
- Scaffolding del proyecto Next.js 15 con TypeScript
- Schema de base de datos con Drizzle ORM (8 tablas: users, clients, providers, incidents, rmas, sequences, event_logs, attachments)
- Relaciones entre tablas definidas
- Autenticación con NextAuth.js v5 (credentials provider, roles: admin/technician/viewer)
- State machines para incidencias y RMAs (transiciones con control de roles)
- Validadores Zod para todas las entidades
- Layout de la aplicación (sidebar, header, breadcrumbs)
- Seed de datos demo
- 39 tests unitarios (state machines, utils, validators)

### Phase 2: CRUD de Entidades Base (Completada)
- **Clientes**: Lista paginada, creación, edición, detalle, eliminación (soft delete)
- **Proveedores**: Lista paginada, creación, edición, detalle, eliminación (soft delete)
- **Usuarios**: Lista paginada, creación, edición, detalle, eliminación (soft delete) — restringido a rol admin
- **Server Queries**: Paginación server-side, búsqueda con ilike, ordenamiento dinámico
- **Server Actions**: CRUD con validación Zod, verificación de sesión/roles, revalidación de cache
- **Componentes compartidos**: DataTable genérica, column headers con sort, diálogo de confirmación de eliminación
- **Hook useTableSearchParams**: Estado de tabla sincronizado con URL via nuqs
- **Tests**: 19 tests nuevos (58 total)
- **shadcn/ui components añadidos**: form, alert-dialog, switch

#### Archivos principales Phase 2:
```
src/server/queries/          # getClients, getProviders, getUsers (paginación + búsqueda)
src/server/actions/          # createX, updateX, deleteX, fetchX (server actions)
src/components/shared/       # DataTable, DataTableColumnHeader, ConfirmDeleteDialog
src/components/clients/      # client-columns, client-form, client-list, client-detail, create-client-page
src/components/providers/    # provider-columns, provider-form, provider-list, provider-detail, create-provider-page
src/components/users/        # user-columns, user-form, user-list, user-detail, create-user-page
src/app/(dashboard)/clients/ # pages: list, new, [id]
src/app/(dashboard)/providers/ # pages: list, new, [id]
src/app/(dashboard)/users/   # pages: list, new, [id] (admin only)
src/hooks/use-table-search-params.ts
```

### Phase 3: Rediseño UI - Azul Profundo + Dashboard + Canvas (Completada)

Rediseño visual completo con tema profesional y funcionalidades de dashboard y kanban.

**Tema Azul Profundo**
- Variables CSS OKLch actualizadas en `globals.css`: primary azul eléctrico (#3b82f6), sidebar azul noche (#1a1f36), fondo gris claro (#f8fafc)
- Variables semánticas `--success` (verde) y `--warning` (ámbar)
- Chart colors: azul, esmeralda, ámbar, rojo, azul oscuro

**Sidebar rediseñado**
- Logo: caja azul `bg-primary` con "HSM" + nombre "Hardware Support / Manager" en dos líneas
- Footer: avatar circular con inicial del usuario + nombre + rol traducido
- Bordes con color de sidebar-border

**Login split-screen**
- Panel izquierdo: fondo azul noche con logo HSM, título y descripción
- Panel derecho: formulario limpio con icono Mail en input
- Logo HSM visible solo en móvil (panel izquierdo oculto en mobile)

**Header mejorado**
- Altura h-16, `bg-card shadow-sm` para contraste con fondo

**Dashboard visual completo**
- 4 KPI cards con iconos en fondo coloreado: Incidencias Abiertas, RMAs Activos, Clientes, Proveedores
- AreaChart tendencia de incidencias (30 días) con empty state
- BarChart horizontal distribución por estado con labels en español
- Lista scrollable de actividad reciente (event_logs con joins a users)
- Botones de acciones rápidas (Nueva Incidencia, Nuevo RMA, Nuevo Cliente)
- Server queries en `src/server/queries/dashboard.ts` con try/catch y defaults seguros

**Vista Canvas (componentes compartidos)**
- `CanvasView`: grid responsive con chips de filtro multi-select por estado (reemplaza kanban horizontal)
- `EntityCard`: tarjeta con número coloreado, prioridad badge, status badge, aging badge, entidad relacionada
- `AgingBadge`: verde (<1d), ámbar (1-3d), rojo (>3d) basado en `calculateAging()`
- `ViewToggle`: toggle tabla/canvas con ToggleGroup de shadcn

**Páginas Incidencias y RMAs funcionales**
- Server queries con joins: `getIncidents()` (join clients + users), `getRmas()` (join providers + incidents)
- Server actions wrapper: `fetchIncidents()`, `fetchRmas()`
- DataTable con columnas: número, título/estado, prioridad, cliente/proveedor, aging, fecha
- Vista canvas con columnas por estado activo (excluye cerrado/cancelado)
- Toggle tabla/canvas en cada página

**Mejoras en páginas existentes**
- DataTable: icono Search en input, empty state con icono Inbox, `bg-card` en tabla
- Páginas de lista (clients, providers, users): header con icono coloreado en fondo tenue + subtítulo descriptivo
- Dashboard layout: `bg-background` en main para contraste cards/fondo

**shadcn/ui components añadidos**: chart, tabs, toggle, toggle-group

#### Archivos principales Phase 3:
```
src/app/globals.css                          # Tema Azul Profundo completo
src/components/layout/app-sidebar.tsx        # Sidebar rediseñado con avatar
src/components/layout/app-header.tsx         # Header con bg-card shadow
src/app/(auth)/layout.tsx                    # Login split-screen
src/app/(auth)/login/page.tsx                # Login con icono Mail
src/app/(dashboard)/dashboard/page.tsx       # Dashboard con KPIs y gráficos
src/components/dashboard/                    # kpi-card, incidents-chart, status-distribution, recent-activity, quick-actions
src/components/shared/                       # canvas-view, entity-card, aging-badge, view-toggle
src/components/incidents/                    # incident-columns, incident-list, incident-canvas, incident-page-content
src/components/rmas/                         # rma-columns, rma-list, rma-canvas, rma-page-content
src/server/queries/dashboard.ts              # getDashboardStats, getRecentActivity, getIncidentStatusDistribution, getIncidentTrend
src/server/queries/incidents.ts              # getIncidents, getIncidentById (con joins)
src/server/queries/rmas.ts                   # getRmas, getRmaById (con joins)
src/server/actions/incidents.ts              # fetchIncidents wrapper
src/server/actions/rmas.ts                   # fetchRmas wrapper
```

### Phase 4+5: CRUD Incidencias y RMAs (Completada)

CRUD completo con transiciones de estado, event log y adjuntos.

**Server Actions**
- `updateIncident`, `transitionIncident`, `createIncident` (con transacciones atómicas + event_log)
- `updateRma`, `transitionRma`, `createRma` (mismo patrón)
- `createAttachment`, `deleteAttachment` (Vercel Blob + DB + event_log)

**Event Log & Adjuntos**
- Timeline vertical con iconos por acción (Plus, Pencil, ArrowRight, Paperclip, Trash2)
- Badges de estado from→to para transiciones
- Upload via POST `/api/upload` + `createAttachment()`
- Lista de adjuntos con icono por tipo, link de descarga, botón eliminar

**Detalle y Transiciones**
- `incident-detail.tsx` / `rma-detail.tsx`: modo lectura/edición con toggle
- `StateTransitionButtons`: botones dinámicos según state machine + role
- `TransitionDialog`: modal con textarea para comentario opcional

**Rutas**: `/incidents/new`, `/incidents/[id]`, `/rmas/new`, `/rmas/[id]`

### Phase 6: Pulido HSM (Completada)

Dark mode, configuración, SLA KPIs, rediseño de tarjetas y UX polish.

**Dark Mode**
- `next-themes` integrado con ThemeProvider (`attribute="class"`)
- Toggle Sun/Moon en header
- Todos los colores hardcoded migrados a patrón dark-mode-safe: `bg-*-500/15 dark:bg-*-500/25`

**Página de Configuración** (`/settings`)
- Nueva tabla `app_settings` (clave-valor JSONB)
- Sección Apariencia: selector tema (claro/oscuro/sistema)
- Sección General: items por página, vista por defecto
- Sección SLA: umbrales configurables por prioridad (respuesta + resolución en horas)

**Dashboard con KPIs SLA**
- 6 KPI cards: Incidencias Abiertas, RMAs Activos, SLA Cumplido (%), Resolución Media, Fuera de SLA, Tasa Reapertura
- Chart Backlog por Antigüedad (<1d, 1-3d, 3-7d, 7+d)
- Chart Rendimiento por Técnico (top 5 por resueltas)
- Queries: `getSlaMetrics()`, `getAgingDistribution()`, `getTechnicianPerformance()`

**Cronómetro SLA en Detalle**
- `SlaIndicator`: barra de progreso con colores verde/ámbar/rojo
- Muestra tiempo total, tiempo en estado actual, estado SLA

**Rediseño de Tarjetas**
- Hover flotante (`shadow-lg`, `-translate-y-1`, borde sutil)
- Barra SLA lateral (3px verde/ámbar/rojo) en `EntityCard`
- KPI cards con soporte para indicadores de tendencia

**UX Polish + SEO**
- Loading skeletons: dashboard, listas, detalle de incidencia, RMAs
- Error boundary global con botón "Reintentar"
- 404 personalizado con link al dashboard
- `generateMetadata()` en páginas de detalle
- Metadata estática en páginas de listado
- Template de título: `%s | HSM`

#### Archivos principales Phase 6:
```
src/components/shared/theme-provider.tsx    # ThemeProvider wrapper
src/components/layout/theme-toggle.tsx      # Toggle Sun/Moon
src/components/settings/                    # settings-content, theme-selector
src/components/shared/sla-indicator.tsx     # Barra progreso SLA
src/components/dashboard/aging-chart.tsx    # Chart backlog aging
src/components/dashboard/technician-chart.tsx # Chart rendimiento técnicos
src/lib/db/schema/settings.ts              # Tabla app_settings
src/lib/constants/sla.ts                   # Umbrales SLA por defecto
src/server/queries/settings.ts             # getSetting, getSlaThresholds
src/server/actions/settings.ts             # updateSetting (upsert)
src/server/queries/dashboard.ts            # getSlaMetrics, getAgingDistribution, getTechnicianPerformance
src/app/error.tsx                          # Error boundary global
src/app/not-found.tsx                      # 404 personalizado
src/app/(dashboard)/*/loading.tsx          # Skeletons (4 archivos)
```

### Sesión de depuración: .next corrupto (2026-03-06)

Tras completar la Phase 6, todas las páginas mostraban "Algo salió mal" (error boundary) al navegar por el sidebar. El error en consola decía: "An error occurred in the Server Components render."

**Causa raíz**: Ejecutar `npm run build` mientras el dev server con Turbopack está corriendo corrompe el directorio `.next`. La build de producción sobrescribe los manifiestos de Turbopack, provocando que el dev server devuelva "Internal Server Error" (500) en todas las peticiones RSC (navegación client-side).

**Síntomas**:
- La carga HTML directa (primera visita) funcionaba
- La navegación via sidebar (RSC fetch) fallaba con 500
- Eventualmente, el servidor completo devolvía 500 en todos los endpoints

**Solución**:
1. Parar el dev server (`Ctrl+C`)
2. Eliminar el directorio `.next` (`rm -rf .next`)
3. Reiniciar con `npm run dev`

**Prevención**: Siempre parar el dev server antes de ejecutar `npm run build`. Luego reiniciar con `npm run dev`.

### Sesión de depuración: Deploy Vercel + Supabase (2026-03-06)

Tras migrar de Neon a Supabase, las variables de entorno en Vercel seguían apuntando a Neon. Algunas páginas (clients, providers, users) devolvían 500 en producción.

**Causa raíz (doble)**:
1. Las variables de entorno (`DATABASE_URL`) en Vercel no se habían actualizado tras la migración a Supabase
2. Tras actualizar las variables, hacía falta un **redeploy** para que el build usara las nuevas variables

**Auditoría realizada**:
- Todo el código apunta correctamente a Supabase (postgres-js, `prepare: false`, schema `hsm`)
- No quedan dependencias de `@neondatabase/serverless` en el código
- Las 9 tablas, 6 enums y permisos del rol `hsm_app` están correctos en Supabase
- El `AGENTS.md` tiene referencias obsoletas a Neon (solo documentación, no código)

**Variables de entorno en Vercel**:
- `DATABASE_URL`: Connection string de Supabase pooler (puerto 6543)
- `NEXTAUTH_URL`: `https://hardware-support-manager.vercel.app`
- `NEXTAUTH_SECRET`: Secret para JWT

**Resultado**: Todas las 7 páginas devuelven HTTP 200 en producción.

---

## Plan de Mejora HSM (Domingo - Qamarero) — Sesiones 2026-03-27 / 2026-03-28

Plan de 4 fases aprobado para reducir trabajo manual en el flujo de soporte hardware (intermediario entre clientes, proveedores y almacén/oficina). El equipo usa Intercom como canal de comunicación con clientes.

### Fase 1: Clientes + Enriquecimiento de Incidencias (Completada - 2026-03-27)

**Tabla de Clientes ampliada:**
- Campos nuevos: `contact_name`, `address`, `city`, `postal_code` (para saber origen/destino de envíos)
- Sección "Contacto y Dirección" en formulario de clientes
- Detalle de cliente muestra dirección completa

**Enriquecimiento de Incidencias:**
- Campos de contacto: `contact_name`, `contact_phone`
- Campos de recogida: `pickup_address`, `pickup_postal_code`, `pickup_city`
- Campos Intercom: `intercom_url`, `intercom_escalation_id`
- Client locations (tabla `client_locations`) vinculadas a clientes para autocompletado de direcciones

**Migraciones SQL:**
- `sql/001-enrichment.sql` — Nuevas columnas en incidents
- `sql/002-clients-and-enrichment.sql` — Client locations + client address fields

#### Archivos principales Fase 1:
```
src/lib/db/schema/clients.ts                # +contactName, address, city, postalCode
src/lib/db/schema/incidents.ts              # +contactName, contactPhone, pickupAddress, pickupCity, pickupPostalCode, intercomUrl, intercomEscalationId
src/lib/db/schema/client-locations.ts       # Nueva tabla client_locations
src/lib/validators/client.ts                # +campos dirección
src/lib/validators/incident.ts              # +campos contacto/recogida/intercom
src/components/clients/client-form.tsx       # Sección contacto y dirección
src/components/clients/client-detail.tsx     # Muestra dirección
src/components/incidents/incident-form.tsx   # Campos enriquecidos con autocompletado desde client locations
sql/001-enrichment.sql                       # Migración columnas incidents
sql/002-clients-and-enrichment.sql           # Migración client_locations + clients
```

### Fase 2: Plantillas de Mensajes (Completada - 2026-03-27)

Sistema de plantillas para copiar/pegar en Intercom, con variables dinámicas que se rellenan automáticamente con datos de la incidencia o RMA.

**Tabla `message_templates`:**
- Campos: name, category (cliente/proveedor), subject, body, variables[], sort_order, is_active
- Enum `template_category`: "cliente", "proveedor"
- 4 plantillas seed (solicitud info, actualización, solicitud RMA, seguimiento)

**Variables disponibles:**
- Incidencias: `{{incidentNumber}}`, `{{clientName}}`, `{{title}}`, `{{status}}`, `{{category}}`, `{{priority}}`, `{{deviceBrand}}`, `{{deviceModel}}`, `{{deviceSerialNumber}}`, `{{contactName}}`
- RMAs: `{{rmaNumber}}`, `{{clientName}}`, `{{providerName}}`, `{{status}}`, `{{deviceBrand}}`, `{{deviceModel}}`, `{{deviceSerialNumber}}`, `{{trackingNumberOutgoing}}`, `{{trackingNumberReturn}}`, `{{providerRmaNumber}}`, `{{address}}`, `{{city}}`, `{{postalCode}}`

**TemplatePicker en detalle de incidencia y RMA:**
- Dialog con selector de plantilla → preview renderizado → copiar al portapapeles (asunto/cuerpo/ambos)
- Renderizado automático de variables con datos del contexto actual

**Gestión en /settings/templates:**
- CRUD completo de plantillas
- VariableInserter: popover con badges clickables para insertar variables en cursor
- Auto-detección de variables usadas en subject/body

**Migración SQL:** `sql/003-message-templates.sql`

#### Archivos principales Fase 2:
```
src/lib/db/schema/message-templates.ts       # Drizzle schema
src/lib/constants/message-templates.ts       # Variables, categorías, renderTemplate()
src/lib/validators/message-template.ts       # Zod schemas (create, update, form)
src/server/queries/message-templates.ts      # getMessageTemplates, getActiveTemplates, getById
src/server/actions/message-templates.ts      # CRUD + fetch wrappers
src/components/message-templates/            # template-form, template-list, template-picker, variable-inserter, create/edit pages
src/app/(dashboard)/settings/templates/      # pages: list, new, [id]
src/components/settings/settings-content.tsx # Link a plantillas
src/components/incidents/incident-detail.tsx # TemplatePicker integrado
src/components/rmas/rma-detail.tsx           # TemplatePicker integrado
sql/003-message-templates.sql               # Migración + seed
```

### Rediseño de State Machines + Vista Almacén (Completado - 2026-03-28)

Rediseño completo de estados para flujo de intermediario (no taller de reparación).

**Incidencias — 8 estados (antes 9):**
```
nuevo → en_triaje → en_gestion → esperando_cliente → resuelto → cerrado
                              ↘ esperando_proveedor ↗           cancelado
```
- Eliminados: `en_diagnostico`, `en_reparacion`, `esperando_repuesto` (estados de taller)
- Nuevos: `en_gestion` (gestión activa), `esperando_proveedor` (pendiente de respuesta proveedor)

**RMAs — 9 estados (antes 10):**
```
borrador → solicitado → aprobado → enviado_proveedor → en_proveedor → devuelto → recibido_oficina → cerrado
                                                                                                      cancelado
```
- Eliminados: `aprobado_proveedor`, `recibido_proveedor`, `en_reparacion_proveedor`, `recibido_almacen`
- Nuevos: `aprobado`, `en_proveedor`, `recibido_oficina`
- Granularidad mantenida en provider-side para tracking SLA

**Vista Almacén (`/warehouse`):**
- Tabla con equipos físicamente en oficina (RMAs en estado `borrador`/`aprobado` = pendiente envío, `recibido_oficina` = pendiente devolución a cliente)
- Búsqueda por nº serie, marca, modelo, proveedor, cliente
- Badges resumen: total, pendiente envío, pendiente devolución
- Columna "Días en almacén" con color-coding (verde <3d, ámbar 3-7d, rojo >7d)
- Sidebar: nuevo enlace "Almacén" con icono Package

**Migración SQL:** `sql/004-update-state-machines.sql` (ALTER TYPE + UPDATE datos existentes)

#### Archivos principales:
```
src/lib/constants/incidents.ts               # 8 estados nuevos
src/lib/constants/rmas.ts                    # 9 estados nuevos
src/lib/state-machines/incident.ts           # Transiciones rediseñadas
src/lib/state-machines/rma.ts                # Transiciones rediseñadas
src/lib/db/schema/incidents.ts               # Enum actualizado
src/lib/db/schema/rmas.ts                    # Enum actualizado
src/components/shared/state-badge.tsx         # Colores actualizados
src/components/incidents/incident-canvas.tsx  # Estados actualizados
src/components/incidents/incident-kanban.tsx  # Estados actualizados
src/components/rmas/rma-canvas.tsx            # Estados actualizados
src/server/queries/dashboard.ts              # recibido_almacen → recibido_oficina
src/server/queries/warehouse.ts              # NUEVO — query almacén
src/server/actions/warehouse.ts              # NUEVO — action wrapper
src/components/warehouse/warehouse-table.tsx  # NUEVO — tabla almacén
src/app/(dashboard)/warehouse/page.tsx        # NUEVO — página almacén
src/components/layout/app-sidebar.tsx         # +Almacén nav item
src/lib/validators/incident.ts               # Enum transición actualizado
src/lib/validators/rma.ts                    # Enum transición actualizado
sql/004-update-state-machines.sql            # Migración estados
```

### Kanban RMA + Auto-fill desde Incidencia (Completado - 2026-03-28)

**Kanban de RMAs:**
- Board drag-and-drop idéntico al de incidencias usando `@dnd-kit/core`
- 7 columnas activas: borrador → solicitado → aprobado → enviado_proveedor → en_proveedor → devuelto → recibido_oficina
- Validación de transiciones via state machine al soltar
- Movimientos optimistas con revert en error
- Toggle "Tabla/Kanban" en página de RMAs (reutiliza ViewToggle)
- Tarjetas muestran: nº RMA, badge estado, info dispositivo, proveedor, aging

**Auto-fill RMA desde incidencia:**
- Al crear un RMA y seleccionar una incidencia vinculada, se importan automáticamente:
  - Cliente (clientId + clientLocationId)
  - Dispositivo (tipo, marca, modelo, nº serie)
  - Dirección (address, postalCode, city)
  - Teléfono (contactPhone → phone)
  - URL Intercom (intercomUrl → clientIntercomUrl)
- Solo rellena campos vacíos (no sobreescribe lo que el usuario ya escribió)
- Toast "Datos importados de la incidencia" al auto-rellenar
- Solo funciona en modo creación (no en edición)
- Ref de deduplicación para evitar re-runs innecesarios

#### Archivos principales:
```
src/components/rmas/rma-kanban.tsx           # NUEVO — board kanban RMAs
src/components/rmas/rma-kanban-card.tsx       # NUEVO — tarjeta draggable RMA
src/components/rmas/rma-page-content.tsx      # Modificado: canvas → kanban
src/components/rmas/rma-form.tsx              # Modificado: auto-fill desde incidencia
src/server/actions/incidents.ts              # +fetchIncidentById
```

---

### Fase 3: Alertas y Notificaciones In-App (Completada - 2026-03-28)

Sistema de alertas computadas sobre datos existentes (sin tabla nueva en BD). Tres entregables: widget dashboard, badges sidebar, configuración de umbrales.

**Alertas computadas (4 tipos):**
- Incidencias estancadas: sin cambio de estado > N días (default 3)
- RMAs en proveedor: estado `en_proveedor` > N días (default 7)
- RMAs en almacén: estados `borrador`/`aprobado`/`recibido_oficina` > N días (default 5)
- SLA en riesgo: tiempo consumido > N% del umbral SLA (default 80%)

**Widget "Requiere Atención" en Dashboard:**
- Card con borde ámbar, icono AlertTriangle, badge con total
- Grid 4 columnas agrupando items por tipo de alerta
- Cada item: link al detalle, número, título truncado, badge días estancado (color-coded), badge prioridad
- Solo se renderiza si hay items (dashboard limpio si no hay alertas)

**Badges en Sidebar:**
- `useAlertBadges()` hook con TanStack Query (polling cada 2 min, stale 1 min)
- `SidebarMenuBadge` en rutas `/incidents`, `/rmas`, `/warehouse` con contadores
- Server action `fetchAlertCounts()` retorna solo COUNTs (lightweight para polling)

**Configuración en Settings:**
- Card "Umbrales de Alertas" con 4 inputs numéricos
- Persistencia en `app_settings` (key `alert_thresholds`)
- Sigue patrón existente de SLA thresholds (mutation + toast)

**Sin migración SQL necesaria** — alertas computadas desde `stateChangedAt` existente + umbrales en `app_settings`.

#### Archivos principales Fase 3:
```
src/lib/constants/alerts.ts                    # NUEVO — AlertThresholds type + defaults + labels
src/server/queries/settings.ts                 # MODIFICADO — +getAlertThresholds()
src/server/queries/alerts.ts                   # NUEVO — getAlertItems() + getAlertCounts() (4 queries paralelas)
src/server/actions/alerts.ts                   # NUEVO — fetchAlertCounts + fetchAlertItems (con auth)
src/components/dashboard/attention-widget.tsx   # NUEVO — Widget "Requiere Atención"
src/app/(dashboard)/dashboard/page.tsx         # MODIFICADO — +getAlertItems en Promise.all, +AttentionWidget
src/components/settings/alert-thresholds-card.tsx # NUEVO — Card config umbrales alertas
src/components/settings/settings-content.tsx   # MODIFICADO — +AlertThresholdsCard + prop initialAlertThresholds
src/app/(dashboard)/settings/page.tsx          # MODIFICADO — +getAlertThresholds() en Promise.all
src/components/layout/sidebar-badges.tsx       # NUEVO — useAlertBadges() hook (TanStack Query polling)
src/components/layout/app-sidebar.tsx          # MODIFICADO — +SidebarMenuBadge rendering con badgeMap
```

---

## Próximas Fases

### Fase 4: Importación Manual desde Intercom (Pendiente)
- Formulario para pegar datos de Intercom y crear incidencia/RMA
- Parsing automático de información del cliente

### Futuro
- KPIs de proveedor: qué proveedores fallan más, tiempos medios de aprobación/reparación
- Export CSV
- Responsive mobile-first
- Notificaciones email

## Migraciones SQL Pendientes / Ejecutadas

| Archivo | Estado | Notas |
|---------|--------|-------|
| `sql/001-enrichment.sql` | Ejecutado | Columnas incidents |
| `sql/002-clients-and-enrichment.sql` | Ejecutado | Client locations + clients |
| `sql/003-message-templates.sql` | Ejecutado | Tabla message_templates + seed |
| `sql/004-update-state-machines.sql` | Ejecutado | ALTER TYPE enums + UPDATE datos |

> **Nota**: Las migraciones se ejecutan manualmente en el SQL Editor de Supabase porque el usuario `hsm_app` no tiene permisos DDL. Los ALTER TYPE deben ejecutarse separados de los UPDATE (Supabase no soporta BEGIN/COMMIT explícitos).

## Errores Conocidos y Soluciones

| Error | Causa | Solución |
|-------|-------|----------|
| zodResolver type mismatch con `z.coerce.number()` | RHF espera tipo input específico | Usar `z.number().int()` en schema de formulario |
| `ActionResult<void>` sin data | Requiere `data` field explícito | `{ success: true, data: undefined }` |
| Prerender falla en tablas nuevas | Build intenta query durante SSG | `export const dynamic = "force-dynamic"` |
| `hsm_app` no puede DDL | Solo tiene SELECT/INSERT/UPDATE/DELETE | Ejecutar migraciones como `postgres` en SQL Editor |
| Supabase SQL Editor no soporta BEGIN/COMMIT | Limitación del editor | Dividir migraciones en partes |
| `.next` corrupto tras build durante dev | Build sobrescribe manifiestos Turbopack | Parar dev, eliminar `.next`, reiniciar |

## Notas de Deploy (Vercel)
1. Conectar repositorio GitHub a Vercel
2. Configurar variables de entorno en Vercel dashboard:
   - `DATABASE_URL`: Supabase pooler connection string (`postgresql://hsm_app.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres`)
   - `NEXTAUTH_URL`: URL de producción (`https://hardware-support-manager.vercel.app`)
   - `NEXTAUTH_SECRET`: Secret generado con `openssl rand -base64 32`
   - `BLOB_READ_WRITE_TOKEN`: Token de Vercel Blob (para adjuntos)
3. Framework preset: Next.js (auto-detectado)
4. Build command: `next build` (default)
5. La base de datos debe estar creada y migrada antes del primer deploy:
   - Ejecutar `npm run db:push` o `npm run db:migrate` contra la DB de producción
   - Ejecutar `npm run db:seed` si se desean datos demo
6. El build pasa sin necesidad de DATABASE_URL gracias a la inicialización lazy del DB client
7. **Importante**: Tras cambiar variables de entorno, siempre hacer Redeploy manual
