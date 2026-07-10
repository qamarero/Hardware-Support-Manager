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

### Sesión 2026-03-30 — Fix edición, UI Polish Emil, Sorting, Preview Popover

**4 commits** | **~30 archivos modificados** | **2 componentes nuevos** | Deploy Vercel OK

---

#### Entregable 1: Fix edición de incidencias y RMAs (`6386e28`)

**Bug**: Al editar una incidencia existente (cambiar técnico, prioridad, etc.) fallaba con toast rojo genérico "Error al actualizar". La creación funcionaba correctamente.

**Causa raíz**:
- `values` tipado como `Record<string, unknown>` → Drizzle generaba SQL inválido
- Sin try/catch → errores se propagaban sin mensaje descriptivo
- Checks con truthiness (`if (parsed.data.title)`) en vez de `!== undefined` → campos con valor legítimo no se incluían en el UPDATE

**Fix aplicado**:
- Tipar `values` como `Partial<typeof incidents.$inferInsert>` (Drizzle type-safe)
- Envolver transacción DB en try/catch con mensajes reales del error
- Usar `!== undefined` para todos los campos (title, category, priority, providerId)
- Mostrar qué campos fallan validación Zod en el toast
- Fix adicional: `SelectTrigger` `w-fit` → `w-full` para layout correcto

**Archivos**: `server/actions/incidents.ts`, `server/actions/rmas.ts`, `ui/select.tsx`

---

#### Entregable 2: UI Polish — Filosofía Emil Kowalski (`f44bdfb`)

**20 archivos** | +169/-53 líneas | 0 dependencias nuevas (todo CSS + Tailwind)

Principios Emil aplicados: solo animar transform+opacity (GPU), ease-out para entradas, duraciones <300ms, stagger 30-80ms, nunca scale(0), hover gateado con `@media (hover: hover)`.

| Mejora | Detalle |
|--------|---------|
| **Keyframes nuevos** | `scaleIn`, `slideInLeft`, `countUp`, `shimmer` + clases utilidad |
| **Card base refinada** | Sombra multicapa OKLch + borde fino `border-border/50` + transición border-color |
| **Hover glow primario** | Entity cards y KPI cards con `shadow oklch(0.623 0.214 259/0.08)` en vez de shadow-lg genérica |
| **Status dots animados** | `animate-ping` en estados activos (nuevo, en_triaje, en_gestion, solicitado, aprobado, enviado_proveedor) |
| **Form section headers** | Barra vertical `bg-primary` + `font-semibold text-foreground` + separadores suaves `bg-border/40` |
| **Header mejorado** | `sticky top-0 z-40` + `backdrop-blur-md` + sombra 1px fina |
| **Stagger detail pages** | Secciones con fadeInUp escalonado 80ms (0, 80, 160, 240, 320, 400ms) |
| **Accent strips** | Gradiente `from-primary/60 via-primary/30 to-transparent` en cards principales de detail |
| **Data table** | Header `bg-muted/30`, row stagger 30ms (max 10 rows), pagination pill, page number primary |
| **Page transition** | Scale sutil `0.997` → `1` añadido a la transición opacity+translate existente |
| **Sidebar** | Barra vertical activa `h-5 w-0.5 bg-sidebar-primary` en nav item activo |
| **Attention widget** | Gradiente sutil rojo/ámbar + items `hover:translate-x-0.5` |
| **Timeline** | Línea gradiente `from-primary/20`, primer evento `bg-primary`, stagger slideInLeft 60ms |
| **Charts** | `animationBegin={200} animationDuration={800}` en Area/Bar de Recharts |
| **KPI values** | `animate-count-up` (opacity + translateY 400ms ease-out-expo) |
| **Inputs** | Focus easing alineado con `ease-out-expo` de Emil |
| **Skeleton shimmer** | Gradiente animado para loading states |

---

#### Entregable 3: Sorting por columnas + Preview ojo (`8793f47`)

**10 archivos** | +349/-21 líneas | **2 componentes nuevos**

**Sorting en tablas**:
- `DataTable` acepta `sortBy`, `sortOrder`, `onSort` — headers con `meta.sortKey` son clickables
- Indicador visual: `ChevronUp`/`ChevronDown` (activa, color primary) o `ArrowUpDown` (inactiva, muted)
- Click cicla: desc → asc → desc
- Orden por defecto cambiado a `stateChangedAt desc` (incidencias más estancadas primero)
- Columnas sortables incidencias: número, título, estado, prioridad, antigüedad, creado (6/9)
- Columnas sortables RMAs: número, estado, antigüedad, creado (4/9)
- Infraestructura existente reutilizada: `setSorting()` de `useTableSearchParams` (existía pero no estaba conectada)

**Preview popover (botón ojo)**:
- Nueva columna entre Número y Título con icono `Eye` de lucide
- Hover: animación parpadeo CSS (`eyeBlink` — `scaleY(0.3)` al 50%, 600ms)
- Click: abre Popover (Radix) con info clave sin abrir detail page

**IncidentPreviewPopover** (`src/components/incidents/incident-preview.tsx`):
- Header: número + StateBadge + PriorityBadge
- Body: título, descripción (3 líneas), categoría, cliente, asignado, dispositivo, contacto+teléfono, antigüedad, creado
- Footer: "Ver detalle completo" → link

**RmaPreviewPopover** (`src/components/rmas/rma-preview.tsx`):
- Header: número + StateBadge
- Body: proveedor, cliente, dispositivo+serial, tracking envío/retorno, RMA proveedor, incidencia vinculada, notas (2 líneas), antigüedad
- Footer: "Ver detalle completo" → link

---

#### Entregable 4: Popover animations Emil (`8fd822d`)

**4 archivos** | +16/-3 líneas

| Antes | Después | Por qué (Emil) |
|-------|---------|-----------------|
| `zoom-in-95` / `zoom-out-95` | `zoom-in-97` / `zoom-out-97` | Scale 0.97 más sutil, nada aparece desde 0 |
| duration-200 / duration-150 | duration-250 / duration-180 | Asimétrico: entrada lenta, salida rápida |
| Easing genérico tw-animate | `ease-out-expo` (cubic-bezier 0.16,1,0.3,1) | Respuesta inmediata, desaceleración natural |
| Sin ring/shadow | Ring glow primary/10 + shadow 8px 30px | Profundidad y brand-alignment al abrir |
| `w-80` (320px) | `w-96` (384px) | Más espacio para info del preview |
| `rounded-md` | `rounded-lg` | Consistente con cards del sistema |

Ring glow CSS en `globals.css`:
```css
[data-slot="popover-content"][data-state="open"] {
  box-shadow: 0 0 0 1px oklch(0.623 0.214 259 / 0.1), 0 8px 30px oklch(0 0 0 / 0.12);
}
```

---

#### Warnings Vercel (no bloqueantes, pendientes de limpiar)

| Archivo | Warning |
|---------|---------|
| `src/components/dashboard/quick-actions.tsx` | `MessageSquareText` importado pero no usado |
| `src/components/incidents/quick-capture-page.tsx` | `useTransition` importado pero no usado |

No afectan al deploy ni al funcionamiento. Limpiar en próximo commit si se desea.

---

#### Archivos principales de esta sesión

```
# Fix edición
src/server/actions/incidents.ts          # try/catch, tipado Drizzle, checks !== undefined
src/server/actions/rmas.ts               # ídem
src/components/ui/select.tsx             # w-fit → w-full

# UI Polish Emil
src/app/globals.css                       # keyframes, shimmer, input easing, eyeBlink, popover glow
src/components/ui/card.tsx                # sombra multicapa, borde fino
src/components/shared/entity-card.tsx     # hover glow primario
src/components/shared/state-badge.tsx     # dots animados estados activos
src/components/shared/data-table.tsx      # header bg, row stagger, pagination, sorting headers
src/components/shared/page-transition.tsx # scale sutil
src/components/shared/event-log-timeline.tsx # timeline visual mejorada
src/components/incidents/incident-detail.tsx  # stagger, accent strips, edit transition
src/components/incidents/incident-form.tsx    # section headers accent bar
src/components/rmas/rma-detail.tsx           # stagger, accent strips, edit transition
src/components/rmas/rma-form.tsx             # section headers accent bar
src/components/dashboard/kpi-card.tsx        # hover glow, count-up
src/components/dashboard/expandable-kpi-card.tsx # hover glow, count-up
src/components/dashboard/attention-widget.tsx    # gradiente, hover translate
src/components/dashboard/*-chart.tsx         # entry animations
src/components/layout/app-header.tsx         # sticky glass
src/components/layout/app-sidebar.tsx        # active indicator bar

# Sorting + Preview
src/components/incidents/incident-columns.tsx  # meta.sortKey + columna preview
src/components/incidents/incident-preview.tsx  # NUEVO — popover preview incidencia
src/components/incidents/incident-list.tsx     # conectar sorting, default stateChangedAt
src/components/rmas/rma-columns.tsx            # meta.sortKey + columna preview
src/components/rmas/rma-preview.tsx            # NUEVO — popover preview RMA
src/components/rmas/rma-list.tsx               # conectar sorting, default stateChangedAt
src/app/(dashboard)/incidents/page.tsx         # default SSR sort stateChangedAt
src/app/(dashboard)/rmas/page.tsx              # default SSR sort stateChangedAt

# Popover animation
src/components/ui/popover.tsx                  # zoom-97, duration 250/180, rounded-lg
```

---

### Sesión 2026-04-01 — Settings fix, responsive, dashboard KPIs, force transition, Intercom Inbox completo

**30 commits** | **~60 archivos modificados/creados** | Deploy manual Vercel

---

#### Entregable 1: Fix configuración no aplica cambios (`e9649e3`, `7c5f7d8`)

- `updateSetting` faltaba `revalidatePath` → añadido para `/settings`, `/incidents`, `/rmas`, `/dashboard`
- `updatedAt` no se actualizaba en upsert → añadido al `set`
- `useState(initialSla)` no se reseteaba con nuevos props → añadido `key={JSON.stringify(data)}` al SettingsContent
- Limpios 2 lint warnings (imports no usados en quick-actions y quick-capture)

#### Entregable 2: App responsive completo (`2dc9df2`)

16 archivos — responsive mobile/tablet/desktop:
- Layout: `p-4 sm:p-6`, header `px-4 sm:px-6`
- 5 page headers: `flex-col sm:flex-row` con botones `w-full sm:w-auto`
- Data table: `overflow-x-auto` + `min-w-[700px]` + pagination stack en mobile
- Detail pages: grids `lg:grid-cols-2` → `md:grid-cols-2`
- Forms RMA: `sm:grid-cols-3` → `sm:grid-cols-2 lg:grid-cols-3`
- Popovers: `w-[90vw] max-w-sm sm:w-96`
- Dashboard: KPI `grid-cols-2 md:3 xl:6`, charts `md:grid-cols-2`
- Kanban: `overflow-x-auto`
- Search bar: `w-full sm:max-w-sm`

#### Entregable 3: Conectar default_page_size a todas las tablas (`6643975`)

- `useTableSearchParams` acepta `defaultPageSize` (antes hardcoded 10)
- 5 server pages fetching `getDefaultPageSize()` de BD
- Flujo: page → page-content → list → hook → nuqs default

#### Entregable 4: Auto-refresh polling (`50c56d4`)

- Tablas (incidents, RMAs, clients, providers, users): `refetchInterval: 30_000`
- Dashboard stats + alertas: `refetchInterval: 60_000`

#### Entregable 5: Dashboard KPIs corregidos (`f0f5c82`, `d693026`)

- `CLOSED_INCIDENT_STATUSES`: añadido `"resuelto"` (antes contaba resueltas como abiertas)
- `CLOSED_RMA_STATUSES`: añadido `"recibido_oficina"`
- Separado `CLOSED_STATUSES` en drilldown en `CLOSED_INCIDENT_STATUSES` + `CLOSED_RMA_STATUSES` (fix tipo TypeScript)

#### Entregable 6: Botón force transition admin (`b268022`)

- Server actions: `forceTransitionIncident` / `forceTransitionRma` (admin-only, skip state machine)
- Componente `ForceTransitionButton`: botón shield ámbar redondo
- Popover con grid de estados + stagger fadeInUp + confirmación en 2 pasos
- Event log registra `forced: true` en details para auditoría
- Respeta SLA pause accumulation y resolvedAt

#### Entregable 7: Bandeja Intercom — integración webhook (`0775ab9` → `428fc9e`)

**17 archivos nuevos**, +1238 líneas. Full-stack Intercom integration:

**Infraestructura:**
- Schema Drizzle: `intercom_inbox` (status, contact, subject, rawPayload, convertedIncidentId)
- Cliente API Intercom: `getConversation`, `searchContacts`, `addNote`
- Tipos TypeScript para Intercom REST API v2.11
- Validators Zod para convert-to-incident y dismiss

**Webhook:**
- `POST /api/webhooks/intercom` — acepta cualquier topic de Intercom
- Filtra solo escalados Hardware/RMA por keywords en payload
- HMAC signature check cuando disponible, fallback a validación de estructura
- Upsert idempotente por `intercom_conversation_id`

**Server layer:**
- `fetchIntercomInbox` (paginado, filtrable por status)
- `convertToIncident` (atómico: crea incidencia + actualiza inbox en transacción)
- `dismissInboxItem` / `restoreInboxItem`
- Prevención duplicados: verifica `incidents.intercomEscalationId`

**UI — Split-pane estilo email (/intercom):**
- Panel izquierdo: lista scrollable con bordes color prioridad
- Panel derecho: detalle + formulario inline para crear incidencia
- Pre-fill título, descripción, categoría, prioridad desde datos Intercom
- Tabs: Pendiente / Convertida / Descartada (nuqs URL state)
- Items convertidos muestran número de incidencia con link

**Sidebar:**
- "Bandeja Intercom" con icono Inbox + badge pendientes

**Configuración Intercom (en progreso):**
- App "Hw sync HSM" creada en Developer Hub
- Topics activados: `conversation_part.tag.created`, `conversation.admin.assigned`, `conversation.read`, `ticket.created`
- Permisos: todos activados (read/write conversations, tickets, users, companies, tags, admins)
- Webhook URL: `https://hardware-support-manager.vercel.app/api/webhooks/intercom`
- **Pendiente**: verificar que webhooks llegan con 200 OK tras fix de firma HMAC

**Env vars configuradas en Vercel:**
- `INTERCOM_ACCESS_TOKEN` ✅
- `INTERCOM_WEBHOOK_SECRET` ✅

---

#### Archivos principales de esta sesión

```
# Settings fix
src/server/actions/settings.ts              # revalidatePath + updatedAt
src/app/(dashboard)/settings/page.tsx       # key prop para re-mount

# Responsive
src/app/(dashboard)/layout.tsx              # p-4 sm:p-6
src/components/layout/app-header.tsx        # px-4 sm:px-6
src/app/(dashboard)/*/page.tsx              # 5 headers responsive
src/components/shared/data-table.tsx        # overflow-x-auto + pagination
src/components/shared/search-bar.tsx        # w-full sm:max-w-sm
src/components/incidents/incident-detail.tsx # md:grid-cols-2
src/components/rmas/rma-detail.tsx          # md:grid-cols-2
src/components/rmas/rma-form.tsx            # sm:2 lg:3
src/components/incidents/incident-preview.tsx # w-[90vw] max-w-sm
src/components/rmas/rma-preview.tsx         # w-[90vw] max-w-sm
src/components/dashboard/dashboard-content.tsx # grid-cols-2 md:3 xl:6
src/components/rmas/rma-kanban.tsx          # overflow-x-auto

# Page size setting
src/hooks/use-table-search-params.ts        # defaultPageSize param
src/components/*/list.tsx                   # 5 list components

# Dashboard fix
src/server/queries/dashboard.ts            # CLOSED_*_STATUSES con resuelto
src/server/actions/dashboard-drilldown.ts  # Separar por entity type

# Force transition
src/components/shared/force-transition-button.tsx  # NUEVO
src/server/actions/incidents.ts            # forceTransitionIncident
src/server/actions/rmas.ts                 # forceTransitionRma
src/components/incidents/state-transition-buttons.tsx # integración
src/components/rmas/state-transition-buttons.tsx     # integración

# Intercom Inbox
src/lib/db/schema/intercom-inbox.ts        # NUEVO — schema
src/lib/intercom/client.ts                 # NUEVO — API client
src/lib/intercom/types.ts                  # NUEVO — tipos
src/lib/constants/intercom.ts              # NUEVO — constantes
src/lib/validators/intercom-inbox.ts       # NUEVO — Zod
src/app/api/webhooks/intercom/route.ts     # NUEVO — webhook
src/server/queries/intercom-inbox.ts       # NUEVO — queries
src/server/actions/intercom-inbox.ts       # NUEVO — actions
src/app/(dashboard)/intercom/page.tsx      # NUEVO — página
src/components/intercom/intercom-inbox.tsx  # NUEVO — shell split-pane
src/components/intercom/conversation-list.tsx    # NUEVO
src/components/intercom/conversation-detail.tsx  # NUEVO
src/components/intercom/inbox-status-badge.tsx   # NUEVO
src/components/layout/app-sidebar.tsx      # Bandeja Intercom entry + badge
src/server/queries/alerts.ts               # intercom pending count
.env.example                               # INTERCOM vars
```

---

#### Entregable 8: Webhook Intercom — debugging y puesta en marcha (`8b02642` → `2eedae5`)

**14 commits adicionales** — iteración de webhook hasta funcionar end-to-end.

**Problemas resueltos:**
1. `generateSequentialId` no acepta tx como argumento → fix
2. `useSearchParams` requiere Suspense boundary + `force-dynamic` → fix
3. Webhook solo aceptaba conversation topics → ampliado a todos los topics incluido `ticket.created`
4. Filtro buscaba keywords en todo el JSON → filtro solo en campos semánticos (ticket_type.name, subject, tags)
5. Firma HMAC no disponible en apps privadas de Intercom → aceptar payloads sin firma con validación de estructura
6. Contacto "Desconocido" → tickets de Intercom solo tienen contact ID, no datos inline
7. `contacts` es objeto directo, no array → ajustar path de extracción
8. Enriquecimiento via `getContact(contactId)` de la API Intercom → nombre, email, teléfono, empresa
9. `ticket_attributes` contienen resumen del problema, pasos de troubleshooting, urgencia → extraer para pre-rellenar formulario
10. Auto-fill: empresa como cliente, contacto, teléfono, urgencia mapeada a prioridad HSM

**Configuración Intercom completada:**
- App "Hw sync HSM" instalada en workspace Qamarero
- Topics: `conversation_part.tag.created`, `conversation.admin.assigned`, `conversation.read`, `ticket.created`
- Permisos: todos activados
- Webhook URL activo y respondiendo 200 OK
- Enriquecimiento de contacto funciona via API (`getContact`)

**Flujo verificado end-to-end:**
1. Agente en Intercom crea folio "Escalado a Hardware" ✅
2. Webhook recibe ticket.created → filtra por keyword "hardware" ✅
3. Guarda en intercom_inbox + enriquece contacto desde API ✅
4. Aparece en Bandeja Intercom con nombre, email, empresa ✅
5. Pre-rellena formulario con problema, troubleshooting, prioridad, contacto, teléfono ✅
6. "Crear Incidencia" genera INC-YYYY-NNNNN con datos completos ✅

**Datos auto-extraídos del ticket Intercom:**

| Campo ticket Intercom | → Campo incidencia HSM |
|----------------------|----------------------|
| ticket_attributes["Resumen del problema"] | Título + Descripción |
| ticket_attributes["Pasos troubleshooting"] | Descripción (sección Troubleshooting) |
| ticket_attributes["Urgencia"] | Prioridad (BAJA→baja, Urgente→critica) |
| contact.name (via API) | Persona de contacto |
| contact.email (via API) | Mostrado como referencia |
| contact.phone (via API) | Teléfono de contacto |
| contact.company.name (via API) | Cliente (empresa) |
| linked_objects.data[0].id | intercomUrl + intercomEscalationId |

---

### Sesión 2026-04-14 — QoL: Intercom sync + auto-fill + workflow optimization

**1 commit** (`6c7a48c`) | **25 archivos** (8 nuevos, 17 modificados) | +1105/-57 líneas

---

#### Fase 1: Fix técnico RMA

**Auto-fill RMA expandido:**
- Al seleccionar incidencia vinculada, ahora también se auto-rellenan: `clientName` (desde join clients), `articleId`, `notes` (título + descripción truncada a 500 chars)

**Campo `clientLocal` eliminado de RMA:**
- Eliminado de: schema Drizzle, 3 validators Zod, form, detail, server actions (insert + update), 2 queries, message-templates
- Migración: `sql/007-remove-client-local-from-rmas.sql`

**Validación inline:**
- `mode: "onTouched"` en useForm de `incident-form.tsx` y `rma-form.tsx` — errores aparecen al salir de cada campo, no solo al submit

---

#### Bloque A: Intercom sync bidireccional

**A1. MCP oficial Intercom:**
- `.mcp.json` creado con servidor oficial Intercom (Bearer token auth)

**A2. Sync transiciones → Intercom:**
- `src/lib/intercom/sync.ts` — NUEVO: `syncIncidentTransition()` y `syncRmaTransition()`
- Fire-and-forget: tras transicionar incidencia, si tiene `intercomUrl` → nota interna en Intercom
- Formato: `📋 [HSM] Incidencia INC-XXXX actualizada: estado_A → estado_B`
- Integrado en `transitionIncident` (server action)

**A3. Cerrar ticket/folio al resolver:**
- `closeTicket(ticketId)` nuevo método en `client.ts` — `PUT /tickets/{id}` con state `resolved`
- Se dispara al transicionar a `resuelto` o `cerrado`
- Si falla (ej: es conversación, no ticket) → warning silencioso, no bloquea

**A4. Conversación completa en Bandeja:**
- `fetchIntercomConversation(conversationId)` — nueva server action que llama a `getConversation()` API
- `ConversationThread` componente — timeline de mensajes con bubbles (cliente/admin/nota interna)
- Strip HTML, formateo timestamps, lazy load (solo al expandir)
- Integrado en `conversation-detail.tsx` como sección expandible

**A5. Conversación en detalle de incidencia:**
- `ConversationThread` reutilizado en `incident-detail.tsx`
- Se muestra dentro de la Card "Referencia Intercom" si hay `intercomEscalationId`

---

#### Bloque B: Maximizar auto-fill

**B1. Auto-fill location desde cliente matcheado:**
- Cuando `fetchClientByExternalId` matchea un cliente en la Bandeja → carga locations
- Si 1 location o location default (`isDefault: true`) → auto-selecciona
- Auto-rellena: contactName, contactPhone, pickupAddress, pickupCity, pickupPostalCode
- Si múltiples locations → se muestra dropdown
- Schema `convertToIncidentSchema` ampliado con `clientLocationId`, `pickupAddress`, `pickupCity`, `pickupPostalCode`

**B2. Extraer serial/dispositivo de Intercom:**
- `src/lib/intercom/device-detector.ts` — NUEVO: `detectDevice()` y `extractSerialNumber()`
- Patrones regex para: Sunmi, Jassway, GEON, Epson, Star, Bixolon, AQPROX + modelos
- Keywords → deviceType mapping (TPV, impresora, cajón, router, KDS, tablet)
- Serial number: extrae de `enrichedCompany.serialNumber` o regex en texto (`S/N:`, `Serial:`, etc.)
- `deviceSerialNumber` añadido a `convertToIncidentSchema` y action

**B3. Mejor formateo de descripción:**
- Descripción formateada con secciones: PROBLEMA REPORTADO, TROUBLESHOOTING REALIZADO, DATOS ADICIONALES
- Datos adicionales incluyen: Categoría IC, Urgencia IC, Atendido en llamada, Resumen AI

---

#### Bloque C: Reducir clicks y navegación

**C1. Atajo "Iniciar Gestión":**
- `quickTransitionToGestion(incidentId, comment?)` — nueva server action
- Salta nuevo → en_gestion en un solo paso
- Crea 2 event_log entries (nuevo→en_triaje + en_triaje→en_gestion) para audit trail completo
- Botón Zap destacado en `state-transition-buttons.tsx` cuando estado es `nuevo`
- Dialog con comentario opcional

**C2. Plantillas de incidencias:**
- `src/lib/constants/incident-templates.ts` — 5 plantillas predefinidas (constantes, sin BD)
- Plantillas: TPV no enciende, TPV fallo software, Impresora no imprime, Impresora error corte, Problema red/WiFi
- `IncidentTemplatePicker` dropdown al inicio del form (solo en modo create)
- Pre-rellena: category, priority, deviceType, title, description (solo campos vacíos)
- Toast "Plantilla aplicada: [nombre]"

**C3. RMA inline desde incidencia:**
- `InlineRmaSheet` — Sheet lateral con RmaForm pre-rellenado desde incidencia
- "Derivar a RMA" abre Sheet en vez de navegar a `/rmas/new`
- Carga providers e incidents via TanStack Query
- Solo queda seleccionar proveedor — todo lo demás auto-rellenado
- `onDerivarRma` callback añadido a StateTransitionButtons (fallback a navegación si no proporcionado)

**C4. Unificar rutas de creación:**
- `/incidents/new` ahora tiene 2 tabs: "Desde Bandeja" (Intercom) y "Manual"
- Tab Intercom: lista items pendientes → seleccionar → ConversationDetail con form inline
- Tab Manual: IncidentForm estándar con template picker
- "Captura Rápida" eliminada del sidebar (ruta `/incidents/quick-capture` sigue existiendo pero sin acceso directo)

---

#### Archivos principales
```
# Nuevos (8)
.mcp.json                                           # MCP oficial Intercom
sql/007-remove-client-local-from-rmas.sql           # Migración DROP client_local
src/lib/constants/incident-templates.ts             # 5 plantillas incidencias
src/lib/intercom/device-detector.ts                 # Regex detección dispositivos
src/lib/intercom/sync.ts                            # Sync HSM → Intercom (notas + cierre ticket)
src/components/incidents/incident-template-picker.tsx # Dropdown plantillas
src/components/incidents/inline-rma-sheet.tsx        # Sheet RMA inline
src/components/incidents/intercom-import-tab.tsx     # Tab Bandeja en /incidents/new
src/components/intercom/conversation-thread.tsx      # Timeline mensajes Intercom

# Modificados (17)
src/components/incidents/create-incident-page.tsx   # Tabs Bandeja/Manual
src/components/incidents/incident-detail.tsx        # ConversationThread + InlineRmaSheet
src/components/incidents/incident-form.tsx          # Template picker + onTouched validation
src/components/incidents/state-transition-buttons.tsx # Quick transition + onDerivarRma callback
src/components/intercom/conversation-detail.tsx     # Location auto-fill + device detection + thread
src/components/layout/app-sidebar.tsx               # Quitar Captura Rápida
src/components/rmas/rma-detail.tsx                  # Quitar clientLocal
src/components/rmas/rma-form.tsx                    # Expandir auto-fill + quitar clientLocal + onTouched
src/lib/constants/message-templates.ts              # Quitar variable clientLocal
src/lib/db/schema/rmas.ts                           # Quitar columna clientLocal
src/lib/intercom/client.ts                          # closeTicket()
src/lib/validators/intercom-inbox.ts                # +deviceSerialNumber, clientLocationId, pickup fields
src/lib/validators/rma.ts                           # Quitar clientLocal de 3 schemas
src/server/actions/incidents.ts                     # quickTransitionToGestion + Intercom sync
src/server/actions/intercom-inbox.ts                # +fetchIntercomConversation + nuevos campos insert
src/server/actions/rmas.ts                          # Quitar clientLocal
src/server/queries/rmas.ts                          # Quitar clientLocal de selects
```

---

#### Env vars nuevas (Vercel)
- `INTERCOM_ADMIN_ID=8601230` — ID de admin Intercom para notas de sync

#### Migraciones pendientes
- `sql/007-remove-client-local-from-rmas.sql` — ejecutar en Supabase SQL Editor

---

---

### Sesión 2026-04-15 — Performance, fix loop de carga, sincronización de cache

**3 commits** (`e81f9f0`, `648afd0`, `e5f03e3`) | **~35 archivos modificados/creados** | +600/-200 líneas

---

#### Entregable 1: Optimización de navegación y rendimiento (`e81f9f0`)

**Problema:** Navegación lenta (~350ms de delay visible), polling agresivo causando peticiones constantes en background, charts cargando de forma síncrona, kanban re-renderizando 200 tarjetas en cada drag.

**Fixes aplicados:**

| Problema | Causa raíz | Fix |
|----------|-----------|-----|
| 350ms delay por navegación | `PageTransition` con `setTimeout(50ms)` + animación 300ms | Eliminado el componente `PageTransition` del layout |
| Polling agresivo en 7 listas | `staleTime: 0` + `refetchInterval: 30s` en cada useQuery | Eliminado polling; `staleTime` 5min, `refetchOnWindowFocus: true` |
| 5 queries para sidebar badges | 5 round-trips separados a DB | 1 SQL con subqueries en `getAlertCounts()` |
| Charts (recharts ~120KB) en el bundle inicial | Importados estáticamente | `next/dynamic({ ssr: false })` para 4 charts de dashboard y 5 de analytics |
| 8 queries SSR en dashboard/page.tsx | Incluyendo charts con timeout 10s | Reducido a 3 queries SSR críticas; charts cargan client-side via TanStack Query |
| Kanban re-renderizando todas las tarjetas | `toCardData()` creaba objeto nuevo cada render → React.memo no efectivo | `useMemo` para `cardDataMap` (Map por ID); eliminado `statusBadge` JSX de props |

**Archivos modificados:**
```
src/app/(dashboard)/layout.tsx              # Eliminado PageTransition
src/components/shared/query-provider.tsx    # staleTime 5min, gcTime 10min, refetchOnWindowFocus
src/components/layout/sidebar-badges.tsx    # refetchInterval 120s→300s
src/server/queries/alerts.ts               # 1 SQL con subqueries (elimina 5 round-trips)
src/components/dashboard/dashboard-content.tsx # Dynamic imports charts + initialData opcional
src/components/analytics/analytics-content.tsx # Dynamic imports 5 charts
src/app/(dashboard)/dashboard/page.tsx     # 8 SSR queries → 3
src/components/incidents/incident-kanban.tsx   # useMemo cardDataMap
src/components/rmas/rma-kanban.tsx            # useMemo cardDataMap
```

---

#### Entregable 2: Fix páginas atascadas en skeleton de carga (`648afd0`)

**Problema:** Tras quitar el polling y ajustar staleTime, las páginas de lista se quedaban mostrando el skeleton aunque `initialData` SSR estaba disponible. El patrón `isLoading && !queryData` no estaba aplicado en todas las listas.

**Causa raíz:** `isLoading` de TanStack Query es `true` durante la primera fetch del cliente aunque haya `initialData` disponible como fallback. Cuando `queryData` es undefined (primera render antes de query result) pero el fallback es `initialData`, el skeleton se mostraba sin necesidad.

**Fix:** Patrón `isLoading={isLoading && !queryData}` + `placeholderData: keepPreviousData` en las 6 listas:
- `incident-list.tsx` — `keepPreviousData` añadido
- `rma-list.tsx` — `keepPreviousData` añadido
- `client-list.tsx` — `keepPreviousData` añadido
- `provider-list.tsx` — `keepPreviousData` añadido
- `user-list.tsx` — `keepPreviousData` añadido
- `intercom-inbox.tsx` — `keepPreviousData` añadido (ya tenía el patrón `isLoading && !queryData`)

`keepPreviousData` mantiene los datos anteriores visibles al cambiar filtros/página en vez de mostrar skeleton.

---

#### Entregable 3: Auditoría completa — Fix cache invalidation (`e5f03e3`)

**Problema raíz identificado:** Las mutaciones de estado (transiciones, ediciones, creación de RMAs inline) NO invalidaban las queries de lista/kanban. El usuario transicionaba un estado y al volver a la lista veía datos obsoletos.

**Nuevo archivo centralizado:** `src/lib/query-keys.ts`
```ts
export const queryKeys = {
  incidents: { all: ["incidents"], canvas: () => ["incidents-canvas"] },
  rmas:      { all: ["rmas"],      canvas: () => ["rmas-canvas"] },
  alerts: ["alert-badges"],
  linkedRmas: (incidentId: string) => ["linked-rmas", incidentId],
};
export function invalidateIncidentQueries(qc: QueryClient) { /* 3 keys */ }
export function invalidateRmaQueries(qc: QueryClient) { /* 3 keys */ }
```

**Fixes de cache invalidation en 9 componentes:**

| Componente | Bug | Fix |
|------------|-----|-----|
| `incidents/state-transition-buttons.tsx` | Solo invalidaba event-log + badges | `invalidateIncidentQueries` en mutation + quickMutation |
| `rmas/state-transition-buttons.tsx` | Solo invalidaba event-log + badges | `invalidateRmaQueries` en mutation |
| `incidents/incident-kanban.tsx` | Solo invalidaba canvas, no tabla | `invalidateIncidentQueries` en onSuccess |
| `rmas/rma-kanban.tsx` | Invalidaba key `"rmas-kanban"` (incorrecto) | `invalidateRmaQueries` en onSuccess |
| `shared/force-transition-button.tsx` | No invalidaba listas | `invalidateIncidentQueries` o `invalidateRmaQueries` según entityType |
| `incidents/inline-rma-sheet.tsx` | Invalidaba `["linked-rmas"]` genérico | `["linked-rmas", incident.id]` + `invalidateRmaQueries` |
| `incidents/incident-detail.tsx` | Solo `router.refresh()` | + `invalidateIncidentQueries(queryClient)` antes del refresh |
| `rmas/rma-detail.tsx` | Solo `router.refresh()` | + `invalidateRmaQueries(queryClient)` antes del refresh |

**Otros fixes en esta sesión:**
- `fetchIncidentsForSelect` (`incidents.ts` línea ~397): añadido `"resuelto"` al `notInArray` (antes devolvía incidencias ya resueltas)
- `getRequiredSession` (`auth/get-session.ts`): mensajes de error en español ("Sesión expirada. Recarga la página e inicia sesión de nuevo." / "No tienes permisos para esta acción.")

---

#### Archivos principales de esta sesión

```
# NUEVO
src/lib/query-keys.ts                              # Keys centralizados + helpers invalidación

# Fix cache invalidation
src/components/incidents/state-transition-buttons.tsx
src/components/rmas/state-transition-buttons.tsx
src/components/incidents/incident-kanban.tsx
src/components/rmas/rma-kanban.tsx
src/components/shared/force-transition-button.tsx
src/components/incidents/inline-rma-sheet.tsx
src/components/incidents/incident-detail.tsx
src/components/rmas/rma-detail.tsx

# Fix skeleton loop (keepPreviousData)
src/components/incidents/incident-list.tsx
src/components/rmas/rma-list.tsx
src/components/clients/client-list.tsx
src/components/providers/provider-list.tsx
src/components/users/user-list.tsx
src/components/intercom/intercom-inbox.tsx

# Performance
src/app/(dashboard)/layout.tsx
src/components/shared/query-provider.tsx
src/server/queries/alerts.ts
src/components/dashboard/dashboard-content.tsx
src/components/analytics/analytics-content.tsx
src/app/(dashboard)/dashboard/page.tsx
src/components/incidents/incident-kanban.tsx
src/components/rmas/rma-kanban.tsx

# Fixes varios
src/server/actions/incidents.ts                    # fetchIncidentsForSelect + quickTransitionToGestion
src/lib/auth/get-session.ts                        # Mensajes de error en español
```

---

### Sesión 2026-04-16 — Refactor formularios, hardware_origin, API externa, consultas rápidas

**7 commits** | **~45 archivos** | +3 migraciones SQL nuevas

---

#### Entregable 1: Refactor formularios — drop Local/Sucursal + remap category (`9f6ffc1`)

Cambio de modelo de datos importante: eliminamos `client_location_id` de incidencias y RMAs (el campo se mantenía sin uso real desde antes) y rediseñamos la enum `incident_category` para que mida **canal de origen** en vez de tipo de dispositivo.

**Nueva enum `incident_category`:**

| Antes (tipo dispositivo) | Después (canal de origen) |
|--------------------------|---------------------------|
| hardware, periferico, red, almacenamiento, impresora, monitor, otro | `escalado`, `incidencia_directa`, `mencion`, `otro` |

El objetivo: poder medir cuánto trabajo absorbemos de otros equipos (escalados vs incidencias directas vs menciones casuales en canales internos).

**Homogeneización de campos en RMAs:**
- Rename `phone` → `contact_phone`
- Rename `address` → `pickup_address`
- Rename `city` → `pickup_city`
- Rename `postal_code` → `pickup_postal_code`
- Nuevo campo `contact_name` (antes solo existía en incidencias)

Ahora el form RMA tiene la misma estructura "Contacto y Recogida" que el form incidencia.

**Otros cambios:**
- Auto-fill de `contactName` al convertir incidencia → RMA via inline sheet
- Migración SQL: `sql/008-drop-location-and-remodel-category.sql` (ejecutado manualmente en Supabase SQL Editor)
- Tests: 116/116 passing (incluye tests nuevos para validators e incidents/rmas actions)
- 25 archivos | +1366/-339 líneas

---

#### Entregable 2: Campo obligatorio `hardware_origin` (`a98abd6`)

Nuevo campo para distinguir si el hardware afectado es propiedad de Qamarero o reciclado por el cliente — necesario para métricas de fallos por origen.

**Schema:**
- Nuevo enum `hsm.hardware_origin` con valores `qamarero | cliente_reciclado`
- Columna nullable en `incidents` (para no romper registros legacy)
- Migración: `sql/009-add-hardware-origin.sql`

**UI:**
- Obligatorio en los 3 puntos de entrada de creación: formulario manual, Bandeja Intercom, Quick Capture
- ToggleGroup destacado (Qamarero / Reciclado cliente) en sección Dispositivo
- Zod refine fuerza valor; UI deshabilita botón "Crear" hasta que se elige
- Visible en incident-detail e incident-preview
- Nuevo filtro "Origen hardware" en listado de incidencias

**Limpieza:**
- Residuos de `clientLocationId` en `conversation-detail.tsx` que quedaron del refactor anterior

**Tests:** 122/122 passing | 16 archivos | +270/-49 líneas

---

#### Entregable 3: API externa `/api/external/metrics` (`7458b75`)

Endpoint público GET autenticado para que el **HW Main Portal** consuma métricas HSM (banner home + tab detalle).

**Auth:**
- Header `X-API-Key` validado contra env var `MAIN_PORTAL_API_KEY` con `crypto.timingSafeEqual` (mitiga timing attacks)
- Helper `src/lib/external-auth.ts` con `requireMainPortalAuth()`:
  - 503 si falta env var
  - 401 si no hay header
  - 403 si no coincide
  - null si OK

**Métricas agregadas:**
- `getDashboardStats`, `getSlaMetrics`, `getAgingDistribution`
- `getProviderRmaVolume`, `getProviderSuccessRate`, `getProviderRmaTurnaround`
- Calcula periodo actual Y equivalente anterior (mismo nº días justo antes de `from`)

**Cálculos SQL inline nuevos:**
- `throughput_ratio` = cerradas / creadas en periodo
- `critical_in_sla_pct` = priority=critica resueltas en ≤8h

**Otros:**
- Aging buckets mapeados de español a enum del spec: `lt_1d`, `1_3d`, `3_7d`, `gt_7d`
- Top 5 proveedores combinando arrays de las 3 queries
- Cache con `unstable_cache(60s)` + tag
- Runtime `nodejs` (timingSafeEqual), `dynamic = "force-dynamic"`

**Env vars nuevas (Vercel Production + Preview):**
- `MAIN_PORTAL_API_KEY` — valor compartido con HSM_API_KEY en el portal

**Spec contract:** `docs/connectors/hsm-endpoint-spec.md` en el repo HW Main Portal.

2 archivos nuevos | +373 líneas

---

#### Entregable 4: Fixes API externa (`a5b56ba` + `6adae19` + `8b1222f`)

Tres bugs detectados al integrar el HW Main Portal con producción real.

**a5b56ba — Replace `SQL ANY(${array})` with `inArray()`:**
- Bug: `sql\`${col} = ANY(${jsArray})\`` partía el array en parámetros individuales → SQL inválido `ANY($3, $4)`
- HTTP 500 cuando había RMAs en `recibido_oficina`/`cerrado`/`cancelado` en el periodo
- Fix: `inArray()` de drizzle (`"col" in ($3, $4)` correcto)
- Afecta `getProviderRmaTurnaround()` y `getProviderSuccessRate()` en `analytics.ts`

**6adae19 — Snapshot metrics ignore date range:**
- Bug conceptual: queries de "open/active/overdue/by priority/aging" filtraban por `created_at` dentro del rango → excluían items creados ANTES del rango pero aún abiertos hoy
- Caso real: una incidencia `esperando_cliente` desde marzo NO aparecía en el banner del mes actual
- Fix: las queries snapshot ahora ignoran `range` explícitamente (`void _range`)
  - `getDashboardStats`: open_incidents + active_rmas
  - `getSlaMetrics`: overdue_count + incidentsByPriority
  - `getAgingDistribution`: completo
- Las 6 métricas temporales mantienen filtro de fecha: avg_hours, comp_total, comp_compliant, reopen_count, total_resolved, rma_avg_days
- Co-side effect: el dashboard interno HSM ahora también muestra snapshots correctos

**8b1222f — Coerce `avg_turnaround_days` string→number:**
- Bug: `getProviderRmaTurnaround` devolvía `avgDays` como STRING (Postgres `ROUND(numeric, 1)` serializa como string) pero el tipo Drizzle decía `number`
- Manifestación: `top_providers[].avg_turnaround_days` en JSON era string → Main Portal lo rechazaba con "Shape inesperado" (banner neutro)
- Fix: helper `toNumberOrNull()` en route handler, aplicado a `avg_turnaround_days`, `rma_count`, `success_rate_pct`
- No tocó las queries para no regresionar el dashboard interno

---

#### Entregable 5: Consultas rápidas + logging upload (`c55b106`)

Dos cambios shipeados juntos por ir en la misma sesión de integración del portal.

**A) Consultas rápidas (cambio principal)**

Caso de uso: un técnico resuelve consulta de un compañero en su mesa en 5-15 min. Antes era invisible y distorsionaba el SLA porque era tiempo real no registrado. Ahora se contabiliza como workload pero NO entra en métricas SLA (al estar resuelta de inmediato no hay tiempo de respuesta que medir).

**Schema** (`sql/010-quick-consultations.sql`):
- `ALTER TYPE hsm.incident_category ADD VALUE 'consulta_rapida'`
- `ADD COLUMN incidents.quick_duration_minutes INTEGER NULL`
- `CREATE INDEX idx_incidents_category`

**Drizzle/types:**
- Nueva enum value en schema, columna integer
- Constant `CONSULTA_RAPIDA = "consulta_rapida"` con label "Consulta rápida"

**Validators:**
- `createQuickConsultationSchema` — solo `title` requerido
- `convertQuickConsultationSchema` — para escalar a incidencia formal

**Server actions:**
- `createQuickConsultation`: crea incidencia con `status=resuelto`, `category=consulta_rapida`, `priority=baja`, `hardwareOrigin=qamarero`, `createdAt=resolvedAt=stateChangedAt=now()`. Logs 2 events (created → transition resuelto) para audit consistency
- `convertQuickConsultation`: escala a incidencia formal cambiando category/status/priority/hardwareOrigin, reabre (`resolvedAt=null`), preserva `quickDurationMinutes` como contexto histórico

**UI:**
- Nuevo modal `QuickConsultationModal` accesible desde el header (botón "+ Consulta rápida")
- En incident-detail: botón "Escalar a incidencia" si `category === "consulta_rapida"`

**B) Mejora logging upload errors**
- `src/app/api/upload/route.ts`: logs con context completo (file type, size, presencia de blob token) para diagnosticar fallos en producción

**Total:** 18 archivos | +806/-21 líneas

---

#### Archivos principales de esta sesión

```
# Migraciones SQL (nuevas, ejecutadas manualmente en Supabase)
sql/008-drop-location-and-remodel-category.sql
sql/009-add-hardware-origin.sql
sql/010-quick-consultations.sql

# Schema & validators
src/lib/db/schema/incidents.ts                  # +hardware_origin, +quick_duration_minutes
src/lib/db/schema/rmas.ts                       # Drop location, rename pickup fields
src/lib/db/schema/relations.ts                  # Drop clientLocation relations
src/lib/validators/incident.ts                  # New category enum, +hardwareOrigin, +quick schemas
src/lib/validators/rma.ts                       # Rename pickup fields
src/lib/validators/intercom-inbox.ts            # +hardwareOrigin in convertToIncidentSchema
src/lib/constants/incidents.ts                  # New labels, HARDWARE_ORIGINS, CONSULTA_RAPIDA
src/lib/constants/filter-options.ts             # +hardware_origin filter
src/lib/constants/incident-templates.ts         # Remap category values

# Forms & UI
src/components/incidents/incident-form.tsx      # hardware_origin toggle, simplified
src/components/incidents/incident-detail.tsx    # Show hardware_origin + escalate button
src/components/incidents/incident-preview.tsx   # Show hardware_origin
src/components/incidents/quick-capture-page.tsx # hardware_origin required
src/components/incidents/inline-rma-sheet.tsx   # Auto-fill contactName
src/components/incidents/quick-consultation-modal.tsx  # NUEVO — modal consulta rápida
src/components/intercom/conversation-detail.tsx # hardware_origin + cleanup
src/components/rmas/rma-form.tsx                # Rename fields, "Contacto y Recogida" section
src/components/rmas/rma-detail.tsx              # Rename fields display
src/components/layout/app-header.tsx            # Botón "+ Consulta rápida"
src/components/dashboard/dashboard-content.tsx  # Card consultas rápidas

# Server
src/server/actions/incidents.ts                 # +createQuickConsultation, +convertQuickConsultation
src/server/actions/rmas.ts                      # Rename pickup fields
src/server/actions/intercom-inbox.ts            # hardware_origin support
src/server/actions/dashboard.ts                 # Quick consultations queries
src/server/queries/incidents.ts                 # Select hardware_origin + quick_duration_minutes
src/server/queries/rmas.ts                      # Rename pickup fields
src/server/queries/dashboard.ts                 # Snapshot metrics ignore range + quick consultations
src/server/queries/analytics.ts                 # Fix inArray() in provider queries

# API externa (nueva)
src/app/api/external/metrics/route.ts           # NUEVO — endpoint para HW Main Portal
src/lib/external-auth.ts                        # NUEVO — requireMainPortalAuth helper
src/app/api/upload/route.ts                     # Mejor logging errores

# Tests (nuevos)
src/lib/validators/incident.test.ts
src/lib/validators/rma.test.ts
src/server/actions/incidents.test.ts
src/server/actions/rmas.test.ts
```

---

#### Env vars nuevas (Vercel)
- `MAIN_PORTAL_API_KEY` — shared secret con HW Main Portal (Production + Preview)

---

### Sesión 2026-05-13 — Fix Intercom sync + Fix plantillas + Bandeja Soporte (form público CX)

Sesión orientada a desbloquear tres problemas:

1. **Mensajes a Intercom no se mandaban** — auditoría reveló 10 bugs en el módulo de sync.
2. **Plantillas exportaban variables vacías** — `renderTemplate` silenciaba placeholders faltantes y `rma-detail` pasaba contexto incompleto.
3. **Nueva Bandeja Soporte** — formulario público `/submit` para que el equipo CX pueda iniciar incidencias estructuradas sin acceso a HSM.

---

#### Entregable 1: Documentación de commits faltantes

Añadidas en este mismo `proyecto_log.md`: sesión 2026-04-16 documentando 7 commits previos (refactor formularios + hardware_origin + API externa + consultas rápidas).

---

#### Entregable 2: Fix sync HSM → Intercom

**Problema raíz:**
- `INTERCOM_ADMIN_ID` no estaba documentado en `.env.example`. El default `"0"` hacía que la API rechazara todas las notas silenciosamente.
- `closeTicket()` se llamaba con `conversation_id` cuando el endpoint espera `ticket_id` → siempre fallaba.
- 4 de las 5 acciones de transición no llamaban a la sync: `forceTransitionIncident`, `quickTransitionToGestion`, `transitionRma`, `forceTransitionRma`.
- En serverless (Vercel), el patrón `try { sync(...) }` después del response podía no ejecutarse porque la función se congelaba.

**Fixes aplicados:**

| Bug | Fix |
|-----|-----|
| `INTERCOM_ADMIN_ID` no documentado | Añadido a `.env.example` con instrucciones. En `sync.ts`: `getAdminId()` con warning si no configurado (admin_id válido es requerido por Intercom) |
| `closeTicket` con ID incorrecto | Eliminada la llamada en `sync.ts`. La función sigue exportada en `client.ts` con JSDoc explicando por qué no se usa. En su lugar, la nota final añade: "Esta incidencia está resuelta en HSM — este folio puede cerrarse" |
| Sync ausente en 4 acciones | Añadido `syncIncidentTransition` / `syncRmaTransition` a las 4 con `after()` de `next/server` |
| Fragilidad en serverless | Refactor de TODAS las llamadas de sync a `after(async () => { ... })` — Next.js 15 garantiza ejecución tras el response |
| `extractConversationId` regex frágil | Soporta múltiples formatos (`/conversation/{id}/`, `/conversations/{id}`, ID directo) + log warning si falla |
| Silent failure si no hay referencia Intercom | `console.info` explícito cuando se salta la sync |
| RMA sin intercom fields directos | `transitionRma` + `forceTransitionRma` ahora hacen `LEFT JOIN incidents` para obtener `intercomUrl`/`intercomEscalationId` de la incidencia vinculada |

**Notas añadidas con contexto:**
- Transiciones normales: `📋 [HSM] Incidencia INC-XXXX actualizada: estado → estado`
- Transición forzada: prefijo `[Transición forzada]`
- Inicio rápido de gestión: prefijo `[Inicio rápido de gestión]`
- RMAs: `📦 [HSM] RMA RMA-XXXX actualizado: estado → estado`
- Cuando incidencia llega a `resuelto`/`cerrado`: añade línea "✅ Este folio puede cerrarse"

---

#### Entregable 3: Fix plantillas de mensajes

**Problema raíz:**
- `renderTemplate()` usaba `context[key] || ""` → variables no pasadas en contexto se renderizaban vacías silenciosamente. El usuario veía huecos en lugar de un placeholder visible.
- `rma-detail.tsx` solo pasaba 14 de las 28 variables disponibles. Plantillas como "Solicitud RMA a proveedor" que referencian campos de la incidencia (description, pickupAddress, contactName...) se rompían cuando se abrían desde un RMA.
- Variables obsoletas en el catálogo: `address`, `postalCode`, `city`, `phone` ya no existen como columnas RMA directas tras el commit `9f6ffc1`.

**Fixes:**

```ts
// src/lib/constants/message-templates.ts
return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
  if (key in context) return context[key] ?? "";  // vacío legítimo permitido
  return `{{${key}}}`;  // ausente → preserve placeholder visible
});
```

**Cambios:**
- `renderTemplate` preserva `{{var}}` literal cuando la key no está en contexto.
- `RMA_TEMPLATE_VARIABLES`: eliminados `address`, `postalCode`, `city`, `phone` (heredadas de `INCIDENT_TEMPLATE_VARIABLES` como `pickup*` y `contactPhone`).
- Añadida variable `hardwareOrigin` al catálogo.
- `rma-detail.tsx`: nuevo `useQuery` con `fetchIncidentById(rma.incidentId)` y merge en el context del TemplatePicker. Si la incidencia vinculada existe, se incluyen sus campos (title, description, category, hardwareOrigin, priority, assignedUserName, intercomUrl, contactName, contactPhone, pickup*).
- `incident-detail.tsx`: añadida variable `hardwareOrigin` al context.

**Resultado:** las 4 plantillas seed (`sql/003-message-templates.sql`) ahora rinden correctamente tanto desde incidencia como desde RMA con incidencia vinculada.

---

#### Entregable 4: Bandeja Soporte — formulario público para equipo CX

Feature nueva: una página pública `/submit` (sin auth) donde el equipo CX de Qamarero rellena un formulario estructurado para reportar incidencias hardware. Las sumisiones llegan a una cola de revisión `/submissions` donde el equipo HW las aprueba y convierte en incidencias.

**Arquitectura** (siguiendo el patrón de `intercom_inbox`):

| Capa | Archivos |
|------|----------|
| Schema BD | `src/lib/db/schema/support-submissions.ts` (tabla `support_submissions` + enums status/priority) |
| Migración | `sql/011-support-submissions.sql` (DDL + permisos `hsm_app`) |
| Validators | `src/lib/validators/support-submission.ts` (create + convert + dismiss) |
| Constants | `src/lib/constants/support-submissions.ts` (status labels, allowed domains, rate limit) |
| Rate limiter | `src/lib/utils/rate-limit.ts` (in-memory Map, 5 req / 10 min por IP) |
| Queries | `src/server/queries/support-submissions.ts` (list + count + findClientByName) |
| Actions | `src/server/actions/support-submissions.ts` (submit público + fetch + convert + dismiss) |
| Form público | `src/app/submit/{layout,page}.tsx` + `src/components/submit/{submission-form,submission-success}.tsx` |
| Bandeja revisión | `src/app/(dashboard)/submissions/page.tsx` + `src/components/submissions/{submissions-inbox,submission-list,submission-detail,submission-status-badge}.tsx` |
| Auth | `src/lib/auth/config.ts` añade `/submissions` a rutas protegidas (`/submit` queda público) |
| Sidebar | `src/components/layout/app-sidebar.tsx` añade entrada "Bandeja Soporte" con icono `ClipboardList` |

**Formulario público** (`/submit`):
- Campos: nombre + email submitter, cliente, título, descripción, prioridad, dispositivo opcional, teléfono, URL Intercom.
- Email validado contra dominios permitidos: `@qamarero.com`, `@qami.es` (configurable en `ALLOWED_SUBMITTER_DOMAINS`).
- Honeypot field invisible (`website`) — si bot lo rellena, se rechaza silenciosamente.
- Rate limit: 5 sumisiones / 10 min por IP (en memoria, suficiente para volumen interno).
- Auto-match cliente por nombre (`ILIKE`) al recibir — si encuentra, guarda `clientId`.

**Bandeja revisión** (`/submissions`):
- Split-pane (lista izquierda / detalle derecha), igual que Bandeja Intercom.
- Tabs: Pendientes / Convertidas / Descartadas.
- Detalle muestra preview de datos recibidos + form editable para crear la incidencia.
- Botón "Crear Incidencia" requiere seleccionar **Origen del hardware** (ToggleGroup Qamarero / Reciclado, igual que en formularios HSM).
- Categoría default `escalado` (las sumisiones del equipo CX son escalaciones por definición).
- Convertir es atómico: inserta incidencia + actualiza submission a `convertida` + log de evento con `source: support_submission`.
- Descartar es one-click con razón opcional.

**Adaptaciones al schema actual** (commits 9f6ffc1 + a98abd6):
- `category` enum usa nuevos valores `escalado | incidencia_directa | mencion | otro` (no los antiguos por tipo de dispositivo).
- `hardwareOrigin` requerido al convertir (sin default, el revisor debe elegir).

#### Env vars nuevas
Ninguna nueva en este entregable.

#### Migración pendiente
- Ejecutar `sql/011-support-submissions.sql` en Supabase SQL Editor antes del deploy.

---

## Próximas Fases

### Intercom — Pendiente
- Auto-crear/vincular cliente HSM desde contacto Intercom (si empresa existe en BD)

### Futuro
- KPIs de proveedor: qué proveedores fallan más, tiempos medios de aprobación/reparación
- Export CSV
- Notificaciones email
- Sugerencia de proveedor por marca al crear RMA (lookup tabla articles)

## Migraciones SQL Pendientes / Ejecutadas

| Archivo | Estado | Notas |
|---------|--------|-------|
| `sql/001-enrichment.sql` | Ejecutado | Columnas incidents |
| `sql/002-clients-and-enrichment.sql` | Ejecutado | Client locations + clients |
| `sql/003-message-templates.sql` | Ejecutado | Tabla message_templates + seed |
| `sql/004-update-state-machines.sql` | Ejecutado | ALTER TYPE enums + UPDATE datos |
| (manual en Supabase) | Ejecutado | Tabla `intercom_inbox` + enum `intercom_inbox_status` + índice |
| `sql/007-remove-client-local-from-rmas.sql` | Ejecutado | DROP column client_local de rmas |
| `sql/008-drop-location-and-remodel-category.sql` | Ejecutado | Drop client_location_id de incidents+rmas, remap category enum, homogenize pickup fields |
| `sql/009-add-hardware-origin.sql` | Ejecutado | Add hardware_origin enum + nullable column en incidents |
| `sql/010-quick-consultations.sql` | Ejecutado | Add 'consulta_rapida' enum value + quick_duration_minutes column |
| `sql/011-support-submissions.sql` | Ejecutado | Nueva tabla `support_submissions` + enums status/priority |
| `sql/012`–`sql/018` | Ejecutado | Recordatorios (`sql/012`/`014`), adjuntos de submissions, `provider.rma_process` (jsonb), `rma.shipping` (jsonb), seed de procedimientos de 6 proveedores |
| `sql/019-priority-binary.sql` | Ejecutado | Prioridad binaria: colapsa `baja`→`media`, `alta`→`critica` |
| `sql/020-assets.sql` | Ejecutado | Nueva tabla `hsm.assets` (registro de equipos físicos; `asset_code` EQ-YYYY-NNNNN; FK opcionales a article/rma/incident) |

> **Nota**: Las migraciones se ejecutan manualmente en el SQL Editor de Supabase porque el usuario `hsm_app` no tiene permisos DDL. Los ALTER TYPE deben ejecutarse separados de los UPDATE (Supabase no soporta BEGIN/COMMIT explícitos). El MCP de Supabase está conectado en **read-write** (`apply_migration`/`execute_sql`) — usar con cautela, mostrar siempre el SQL antes de aplicar y nunca DELETE/DROP/TRUNCATE sin confirmación.

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

---

## Resumen 2026-05 → 2026-06 (proyectos ③–⑨)

> Esta sección recupera el histórico que faltaba: el changelog anterior terminaba en 2026-05-13. La fuente de verdad del estado de proyectos es el plan en `.claude/plans/`; aquí queda el resumen cronológico.

### Infra / rewrite
- **③ Rewrite TOTAL del frontend** desde el prototipo Qamarero (fases W0–W5): nuevo sistema de UI "proto" (CSS plano `src/app/proto-tokens.css` + `proto-app.css`; componentes en `src/components/{incidents-v2,rmas-v2,proto,shell}`, drawers laterales en vez de páginas `[id]`, marca Qamarero, DM Sans + Space Mono). Los componentes shadcn antiguos quedan como posible código muerto. **Modo claro forzado** en toda la app (sin dark mode). MCP de Supabase conectado en read-only.
- Migraciones aplicadas hasta `sql/018` (recordatorios, adjuntos de submissions, `provider.rma_process`, `rma.shipping`, seed de procedimientos de 6 proveedores).

### Proyectos de producto
- **④ HSM como asistente diario** (EN CURSO): A1 badges en sidebar + buscador global + centro de avisos; A2 recordatorios (`sql/012`/`014`); A3 vista "Mi día"; A4 contexto de cliente + registro progresivo + equipo desde catálogo `articles`; A5 redefinición de estados (triaje fuera; RMA con outcome/logistics/repairPath + auto-cierre de incidencia); A6.1 reglas de captura Intercom configurables. **Pendientes**: A6.2 (filtro fino del webhook), A7 (email/Resend + Vercel Cron), A8 (métricas big-data por `articleId` + base de conocimiento de proveedores).
- **⑤ QoL de uso diario**: copiar nº al portapapeles, adjuntos drag&drop/pegar/múltiples, triage en lista (Mías + asignar/prioridad inline + selección masiva), agenda potente (snooze flexible, delegar, recurrencia, auto-recordatorio al derivar a RMA, deshacer).
- **⑥ Bandeja Intercom**: botón "Descartar" en cabecera + descarte en bloque + checkbox por fila (solo UI).
- **⑦ Pulir RMA**: columna Resultado en la lista + indicador "SLA en pausa" + captura obligatoria de outcome al cerrar.
- **⑧ Formulario público `/submit` + Bandeja Soporte `/submissions`**: badges de pendientes, avisos en campana, URL Intercom obligatoria, adjuntar fotos (endpoint público `/api/submit-upload/sign`).
- **⑨ Procedimientos de proveedor + correo RMA + datos de recogida**: `provider.rma_process` (jsonb), panel "Cómo tramitar con {proveedor}" en wizard y drawer, pop-up de datos de recogida/envío (`rma.shipping` jsonb), generar correo al proveedor (mailto/copiar). Extras: fix z-index de pop-ups, chat de Intercom embebido en el drawer de RMA.

### 2026-06-26 — Flujo: estados no lineales, enlace RMA visible, popup Intercom, prioridad binaria

Commits en `main` (desplegados): `94a18ff`, `37f00ff`, `297187a`. Migración `sql/019` aplicada. Build + lint en verde por commit.

- **Estados no lineales** en las 3 superficies (Kanban + ficha incidencia + ficha RMA): `transitionIncident`/`transitionRma` aceptan `force` (omite el grafo, conserva pausa SLA, auto-cierre y outcome). Validadores ampliados (`esperando_pieza` + `force`). Selectores listan todos los estados; el Kanban admite soltar en cualquier columna. **Arregla el error del Kanban** (faltaba `esperando_pieza` en el validador). Sin migración.
- **Enlace Incidencia→RMA visible**: `getIncidents` trae `rmaCount` + último RMA; badge clicable en la lista; sección "RMAs vinculados" + botón "Ver RMA-…" en el drawer de la incidencia (vía `useDrawers().openRma`).
- **Conversación de Intercom en popup**: `ConversationThread` (desplegable que crecía sin fin) → `ConversationPopup` (portal a `document.body`, z-index por encima del drawer) lanzado con un botón en ambas fichas; se retiró la pestaña "Conversación" del drawer de RMA.
- **Prioridad binaria**: 4 niveles → 2 ("Cliente puede operar" = `media`, "Cliente no puede operar" = `critica`). Etiquetas/colores/selectores/filtros binarios; `priorityBucket()` mapea los datos antiguos. Migración `sql/019` (baja→media, alta→critica). Los RMA no tienen prioridad propia.
- **Formulario público `/submit`**: email permitido solo `@qamarero.com` (quitado `qami.es`); URL de Intercom opcional; botón "Enviar formulario".
- **Infra**: MCP de Supabase conectado (primero read-only, luego read-write); creado `ONBOARDING.md` como handoff operativo. Reglas/decisiones nuevas en memoria: `estados-no-lineales`, `prioridad-binaria`.

### 2026-06-30 — PROYECTO ⑩: Etiquetas físicas con QR (RMA + equipos) + texto libre de cliente

Commits en `main` (desplegados): `de0ca81`, `b5793bd`, `dc1f98c`, `104d4ee`, `67026ea`, `98f80fc`, `e8bb33e`. Migración `sql/020` aplicada por el usuario. Build + lint en verde por commit. Dependencia nueva: **`react-qr-code`** (QR como SVG, nítido al imprimir).

**Objetivo (Domi):** cuando un equipo vuelve físicamente a la oficina (vía RMA) o ya está aquí sin RMA (equipos previos a la herramienta), poder pegarle una **etiqueta con QR + datos** que, al escanearla con sesión iniciada (el login persiste por dispositivo, JWT), abre su ficha en la plataforma.

**Texto libre de cliente (`de0ca81`):** el `Combobox` de cliente (crear/editar incidencia) admite `allowFreeText` — si el cliente no existe en la base (3.741 reales, traídos de Supabase), se puede escribir a mano y queda como `clientName`.

**Fase 1 — Etiqueta de RMA (`b5793bd`):**
- Ruta limpia protegida `src/app/etiqueta/[tipo]/[id]/page.tsx` (server, `auth()`, `tipo` = `rma` | `equipo`, formato por `?f=etiqueta|envio`). Auth: añadidos `/etiqueta` y `/equipos` a `isOnDashboard` en `src/lib/auth/config.ts`.
- Cliente `src/components/etiquetas/label-print-client.tsx`: barra de control (toggle de formato + Imprimir, ocultos al imprimir) + `@page` dinámico. **Dos formatos:**
  - `Label100x150` — `@page size: 100mm 150mm` para la etiquetadora local: marca, nº grande (mono), QR central, equipo, S/N, cliente/proveedor, estado+fecha.
  - `ShippingSheet` — A4 para enviar a cliente/fabricante: cabecera oficial, datos del equipo, **zona recortable** (✂ QR + nº + equipo/serie, a pegar), **normas** y **bloque de recepción**.
- El QR codifica `window.location.origin + recordPath` (`/rmas/{id}` o `/equipos/{id}`).
- Botón "Etiqueta" en el drawer de RMA (`rma-detail-drawer.tsx`).

**Fase 2 — Registro de equipos sin RMA (`dc1f98c`):**
- Tabla **`hsm.assets`** (`sql/020-assets.sql`): `asset_code` único `EQ-YYYY-NNNNN` (vía `generateSequentialId("EQ")`), tipo/marca/modelo/serie, `client_name`, `status` (`en_oficina`…), `location`, `notes`, FK opcionales `article_id`/`rma_id`/`incident_id`. Schema `src/lib/db/schema/assets.ts`; validador `src/lib/validators/asset.ts`; queries `src/server/queries/assets.ts`; actions `src/server/actions/assets.ts` (`fetchAssets` tolerante: `try/catch` → `[]` si la tabla aún no existe).
- Página `/equipos` (`src/components/equipos-v2/equipos-screen.tsx`): lista + búsqueda + alta rápida (reusa `ArticleCombobox`) + botón etiqueta por fila. Ficha `/equipos/[id]` (objetivo del QR de equipo). Sidebar: ítem "Equipos" (icono `Tag`) en Catálogo.
- Misma ruta/componentes de etiqueta reutilizados para `tipo=equipo`.

**Oficialización de la hoja A4 (`104d4ee`, `67026ea`):**
- **Logo**: el componente compartido `QamareroLogo` (viewBox `0 0 42 48`) recortaba el círculo naranja (llega a x=48). Se usa un `BrandMark` **local** (viewBox `0 0 48 48`, marca `#212121` + círculo `#F4532B`) en la etiqueta para que no se corte, sin tocar el componente global.
- **Dirección de recepción real**: P.º Alcalde Marqués del Contadero, s/n, Casco Antiguo, 41001 Sevilla · horario 9:00–18:00 · tel. 602 687 553 · hardware@qamarero.com.
- **Normas** (6 puntos formales) + **aviso en negrita**: "Todo envío que no cumpla estas condiciones será rechazado y devuelto a su origen". Zona recortable agrandada (QR 40 mm).

**Acceso y consistencia del botón (`98f80fc`, `e8bb33e`):**
- **Tabla de RMA** (`rmas-screen.tsx`): nueva columna "Etiqueta" con icono de impresora por fila → abre `/etiqueta/rma/{id}` en pestaña nueva (`stopPropagation` para no abrir el drawer). Pensado para etiquetar lotes de devoluciones sin entrar en cada ficha.
- **Ficha de RMA**: el botón "Etiqueta" dejó de cambiar de color según estado (confundía: dependía de `WAREHOUSE_RMA_STATUSES`) → ahora **siempre naranja** (`btn--primary`). Reordenado al **inicio** de la fila de acciones; "Editar datos" pasa **debajo, a la izquierda**.

**Pendiente / siguiente:** A4 también para equipos (hoy 100×150 para ambos, A4 solo RMA); revisar redacción final de normas con uso real.

### 2026-07-07 — PROYECTO ⑪: Seguimiento diario ("Ronda") en Mi día

Commits en `main` (desplegados): `90d617e`, `42d181e`, `f15b061` (fases 0-3, 4 y 5).
Build + lint en verde por fase. **Sin migración** (`event_logs.action` es varchar
libre; "revisada hoy" es localStorage). Subconsulta `lastContactedAt` verificada por MCP.

Objetivo: dar memoria al recorrido diario de Domi (viejas→nuevas: estado → ¿contacté? →
siguiente paso). Reutiliza recordatorios, event_logs, Mi día y `fetchIntercomConversation`.

- **F0 — Fix clic recordatorio**: toda la fila del recordatorio abre su ficha vinculada
  (antes solo el minitexto del nº); controles con `stopPropagation`. `mi-dia-screen.tsx`.
- **F1 — "Contacté" (auditable)**: `src/server/actions/follow-up.ts` → `logContact` inserta
  `event_logs` con `action:"contacted"` (sin sync a Intercom). `EventLogTimeline` muestra el
  evento (icono teléfono). `getIncidents` trae `lastContactedAt` (subconsulta `max`).
- **F2 — "Revisada hoy" (local)**: `src/hooks/use-daily-review.ts` — Set en localStorage con
  clave `hsm:reviewed:{userId}:{YYYY-MM-DD}`; se resetea solo cada día.
- **F3 — Hint de Intercom (orientativo)**: `src/hooks/use-client-reply-status.ts` — vía
  `fetchIntercomConversation`, devuelve último mensaje del cliente y el nuestro. **NO
  autoritativo** (que respondamos nosotros puede ser CX diciendo "mañana lo ve Hardware"
  mientras el cliente pregunta algo pendiente): muestra ambos para que el operador juzgue;
  la verdad la fija la marca manual "Contacté". Sin tocar `src/lib/intercom/*`.
- **F4 — Ronda en Mi día**: layout a 2 columnas (Ronda principal + Recordatorios lateral).
  Cola = incidencias mías abiertas + RMA activos, más antiguas primero, sin las revisadas
  hoy. Dos vistas: **Tarjetas** (`ronda-tarjetas.tsx`, gamify, baraja + progreso + atajos
  →/Enter/S) y **Tabla** (`ronda-tabla.tsx`). Acciones compartidas en `ronda-actions.tsx`
  (`ContactButton`, `NextStepButton`, `IntercomHint`, `IntercomLink`, `RoundItem`). El hint
  de Intercom solo se dispara en la tarjeta visible (1 llamada), no por fila.
- **F5 — Tabla de incidencias**: orden "+ antiguas" (`createdAt` asc) + columna
  "Seguimiento" (marca revisada hoy compartida con la ronda + Contacté + Siguiente paso).

**Actualización 2026-07-08:** ajustes de la Ronda tras uso real:
- Recordatorios del lateral en **formato vertical** (no se aplastaban en móvil).
- **"Ver conversación"** en tarjetas/tabla → abre el hilo de Intercom en el mismo
  `ConversationPopup` de las tablas (además del enlace externo y el hint).
- **"Revisada hoy" ahora es COMPARTIDA por el equipo** (antes localStorage): tabla
  `hsm.daily_reviews` (`sql/022`, aplicada por MCP; grant a `hsm_app` verificado),
  `src/server/{queries,actions}/daily-reviews.ts`, hook `use-daily-review` reescrito
  a BD (misma API) con optimista + polling 60s. Si un técnico marca revisada, sale de
  la ronda de todos. Fecha = local del cliente.
- **"Siguiente paso"** además pasa la entidad a **"Esperando al cliente"** (pausa SLA,
  `force`), en incidencias y RMA.
- **RMA "Progreso" → panel "Estado" no secuencial**: el stepper numerado 1→9 daba
  impresión de orden obligatorio; ahora son píldoras de todos los estados con solo el
  actual resaltado (los estados de RMA no son lineales).
- **Pausa de SLA ampliada**: `PAUSED_RMA_STATES` añade `solicitado` (esperando aprobación
  del proveedor). Recordatorio: los incidentes ya pausan en esperando_cliente/proveedor/pieza.
- **Nuevo estado de RMA `enviado_cliente`** ("Enviado al Cliente", `sql/023`, MCP): equipo
  enviado al cliente a la espera de que confirme recepción; entre recibido_oficina y
  entregado_cliente; **pausa el SLA**. Coordinado en enum/constantes/validador/máquina de
  estados/badges/drawer/lista.

### 2026-07-10 — PROYECTO ⑫: Visibilidad de RMA (endpoint fiable + pestaña "Métricas RMA")

Doble objetivo: (1) que los cambios de RMA lleguen bien al Main Portal por `/api/external/metrics`,
y (2) dar visibilidad interna con una pestaña exportable.

- **Endpoint fiable (Fase A)**: las mutaciones de RMA (`createRma`/`updateRma`/`transitionRma`/
  `forceTransitionRma`) invalidan la caché externa con `revalidateTag("hsm-external-metrics"/
  "hsm-external-rmas")` → adiós al desfase de 30–60 s. Alineados los **13 estados** en
  `/api/external/rmas` y en `analytics.ts`/`dashboard.ts` (entregado_cliente/rechazado cuentan como
  cierre). `/rmas` emite `outcome`, `logistics`, `sla_paused_hours`, `active_hours_total`
  (schema 1.1.0). `/metrics` gana un bloque `rmas` actual vs semana anterior (schema 1.2.0, aditivo).
- **Queries KPI (Fase B)**: `src/server/queries/rma-metrics.ts` — aging RMA descontando pausa,
  cambios de estado (event_logs), tiempo hasta tramitar (creación → primer `solicitado`), resultados
  al cierre. `src/lib/utils/date-periods.ts` (semana ISO + periodo anterior). Catálogo en
  `src/lib/constants/rma-metrics.ts`. "Resp. RMA" = tiempo hasta tramitar (objetivo 2 h configurable).
- **Reporte editable (Fase C)**: tabla `hsm.rma_metric_reviews` (`sql/024`, MCP) — semáforo +
  responsable + comentario por métrica y semana, **compartido**. Server actions get/upsert.
- **Pestaña (Fase D)**: `/metricas` ("Métricas soporte", proto). Reporte del **soporte completo** con
  **dos bloques: Incidencias + RMA** (no solo RMA). Selector de semana (nuqs), KPI cards con delta por
  bloque, tabla-reporte editable agrupada (como la foto de referencia), charts de barras (incidencias
  por antigüedad, RMA por estado/resultados/turnaround) y **export CSV + PDF** (imprimible,
  `window.print()`, sin librerías). Métricas de incidencias en `src/server/queries/incident-metrics.ts`
  (reusa getSlaMetrics/getDashboardStats/getAgingDistribution); catálogo con `group` en
  `src/lib/constants/rma-metrics.ts` (`SUPPORT_METRIC_CATALOG`). Ítem "Métricas soporte" en el nav.
- Verificado: build+lint (0 errores), migración por MCP (grants a hsm_app OK) y la lógica SQL contra
  datos reales (8 RMA abiertos, 3 con >7 días; tiempo medio a tramitar 4,4 h; 80 transiciones).
