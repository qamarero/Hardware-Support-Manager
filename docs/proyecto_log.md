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

## Próximas Fases
- **Phase 7**: Gestión de perfil, responsive mobile-first, export CSV, notificaciones email

## Notas de Deploy (Vercel)
1. Conectar repositorio GitHub a Vercel
2. Configurar variables de entorno en Vercel dashboard
3. Framework preset: Next.js (auto-detectado)
4. Build command: `next build` (default)
5. La base de datos debe estar creada y migrada antes del primer deploy:
   - Ejecutar `npm run db:push` o `npm run db:migrate` contra la DB de producción
   - Ejecutar `npm run db:seed` si se desean datos demo
6. El build pasa sin necesidad de DATABASE_URL gracias a la inicialización lazy del DB client
