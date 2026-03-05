# PROJECT LOG - Hardware Support Manager

> Registro completo del desarrollo del proyecto. Consultar este archivo al inicio de cada sesion para retomar donde se dejo.

---

## Informacion General del Proyecto

| Campo | Valor |
|---|---|
| **Nombre** | Hardware Support Manager (HSM) |
| **Tipo** | Aplicacion web interna para departamento de soporte de hardware |
| **Proposito** | Gestion de incidencias y RMAs entre clientes, proveedores y almacen |
| **Idioma UI** | Espanol (todo el texto visible al usuario) |
| **Repositorio** | `C:\Users\Qamarero\Desktop\PROYECTOS\hardware-support-manager` |
| **Branch principal** | `main` |
| **Branch de trabajo** | `master` (pendiente merge a main) |

---

## Stack Tecnologico

| Capa | Tecnologia | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.5.12 |
| Lenguaje | TypeScript (strict) | ^5 |
| ORM | Drizzle ORM | ^0.45.1 |
| Base de datos | Neon PostgreSQL (serverless) | @neondatabase/serverless ^1.0.2 |
| UI | shadcn/ui + Tailwind CSS | v4 |
| Estado servidor | TanStack Query | v5.90.21 |
| Estado URL | nuqs | ^2.8.9 |
| Formularios | React Hook Form + Zod | RHF ^7.71.2, Zod ^4.3.6 |
| Autenticacion | NextAuth.js v5 (beta) | ^5.0.0-beta.30 |
| Almacenamiento | Vercel Blob | ^2.3.1 |
| Graficos | Recharts | ^3.7.0 |
| Notificaciones | Sonner | ^2.0.7 |
| Testing | Vitest | ^4.0.18 |
| Node.js | - | v24.13.1 |

---

## Sesiones de Desarrollo

---

### SESION 1 — 2026-03-05

**Objetivo**: Fase 1 - Fundacion completa del proyecto
**Duracion estimada de trabajo**: ~45 minutos de ejecucion
**Estado final**: COMPLETADA CON EXITO

#### Que se hizo

**Paso 1 — Scaffolding y Configuracion**
- Creado proyecto Next.js 15 con App Router, TypeScript, Tailwind CSS v4, ESLint
- Instaladas todas las dependencias core y dev (80+ paquetes core, 153+ dev)
- Inicializado shadcn/ui con 20 componentes base:
  - button, card, input, label, separator, sheet, sidebar, breadcrumb, dropdown-menu, avatar, badge, select, textarea, dialog, table, tooltip, scroll-area, sonner, skeleton, sidebar
- Creados archivos de configuracion:
  - `drizzle.config.ts` — apunta a `src/lib/db/schema/index.ts`, dialect PostgreSQL
  - `vitest.config.mts` — jsdom, tsconfig paths, setup file
  - `src/test-setup.ts` — testing-library/jest-dom para Vitest
  - `.env.example` — template de 4 variables requeridas
- Actualizados scripts en `package.json`:
  - `db:push`, `db:migrate`, `db:generate`, `db:seed`, `db:studio`
  - `test`, `test:watch`, `test:coverage`

**Paso 2 — Constantes y Tipos**
- `src/lib/constants/roles.ts` — 3 roles: admin, technician, viewer
- `src/lib/constants/incidents.ts` — 9 estados, 4 prioridades, 7 categorias
- `src/lib/constants/rmas.ts` — 10 estados de RMA
- `src/lib/constants/attachments.ts` — tipos de entidad, MAX_FILE_SIZE (10MB), MIME types permitidos
- `src/lib/constants/index.ts` — barrel export
- `src/types/index.ts` — tipo generico `ActionResult<T>`

**Paso 3 — Esquema de Base de Datos (Drizzle ORM)**
- `src/lib/db/index.ts` — Cliente con lazy initialization via Proxy (permite build sin DATABASE_URL)
- 10 archivos de schema en `src/lib/db/schema/`:
  - `users.ts` — tabla users con enum `user_role`, soft delete
  - `clients.ts` — tabla clients con soft delete
  - `providers.ts` — tabla providers con soft delete
  - `sequences.ts` — tabla sequences con unique index (prefix, year) para IDs secuenciales
  - `incidents.ts` — tabla incidents con 3 enums (status, priority, category), FK a clients y users
  - `rmas.ts` — tabla rmas con enum status, FK a incidents y providers
  - `event-logs.ts` — tabla event_logs polimorfica con enum entity_type, jsonb details
  - `attachments.ts` — tabla attachments polimorfica, reutiliza entity_type enum
  - `relations.ts` — todas las relaciones Drizzle para query API relacional
  - `index.ts` — barrel export

**Paso 4 — Funciones Utilitarias**
- `src/lib/utils/date-format.ts` — formatDate, formatDateTime, formatRelativeTime (locale es-ES)
- `src/lib/utils/aging.ts` — calculateAging con AgingResult (days, hours, minutes, label, isOverdue)
- `src/lib/utils/id-generator.ts` — generateSequentialId con upsert atomico
- `src/lib/utils/index.ts` — barrel export
- `src/lib/utils.ts` — cn() de shadcn + re-exports de utils
- `src/lib/utils/date-format.test.ts` — 11 tests
- `src/lib/utils/aging.test.ts` — 7 tests

**Paso 5 — Maquinas de Estado**
- `src/lib/state-machines/incident.ts`:
  - 18 transiciones definidas
  - Flujo: nuevo -> en_triaje -> en_diagnostico -> (esperando_repuesto | en_reparacion | esperando_cliente) -> resuelto -> cerrado
  - Admin puede cancelar desde la mayoria de estados y reabrir desde resuelto
  - Viewer no tiene transiciones
  - Funciones: `getAvailableTransitions()`, `isValidTransition()`
- `src/lib/state-machines/rma.ts`:
  - 11 transiciones (flujo mayormente lineal)
  - Flujo: borrador -> solicitado -> aprobado_proveedor -> enviado_proveedor -> recibido_proveedor -> en_reparacion_proveedor -> devuelto -> recibido_almacen -> cerrado
  - Funciones: `getRmaAvailableTransitions()`, `isValidRmaTransition()`
- `src/lib/state-machines/index.ts` — barrel export
- `src/lib/state-machines/incident.test.ts` — 12 tests
- `src/lib/state-machines/rma.test.ts` — 9 tests

**Paso 6 — Validadores Zod**
- `src/lib/validators/user.ts` — loginSchema, createUserSchema, updateUserSchema
- `src/lib/validators/client.ts` — createClientSchema, updateClientSchema
- `src/lib/validators/provider.ts` — createProviderSchema, updateProviderSchema
- `src/lib/validators/incident.ts` — createIncidentSchema, updateIncidentSchema, transitionIncidentSchema
- `src/lib/validators/rma.ts` — createRmaSchema, updateRmaSchema, transitionRmaSchema
- `src/lib/validators/attachment.ts` — uploadAttachmentSchema
- `src/lib/validators/index.ts` — barrel export

**Paso 7 — Autenticacion (NextAuth.js v5)**
- `src/lib/auth/config.ts` — Credentials provider con bcrypt, callbacks JWT/session, proteccion de rutas
- `src/lib/auth/index.ts` — Export de handlers, auth, signIn, signOut
- `src/lib/auth/get-session.ts` — getRequiredSession(), requireRole()
- `src/types/next-auth.d.ts` — Augmentacion de tipos para role en Session/User/JWT
- `src/middleware.ts` — Auth middleware con matcher
- `src/app/api/auth/[...nextauth]/route.ts` — Route handler
- `src/app/(auth)/layout.tsx` — Layout minimo centrado
- `src/app/(auth)/login/page.tsx` — Pagina de login con email/password, textos en espanol

**Paso 8 — Storage, Layout y Providers**
- `src/lib/storage/index.ts` — Interface StorageProvider
- `src/lib/storage/vercel-blob.ts` — Implementacion con @vercel/blob
- `src/app/api/upload/route.ts` — POST endpoint con validacion de auth, tamano y tipo
- `src/components/shared/query-provider.tsx` — TanStack Query provider
- `src/app/layout.tsx` — Root layout con SessionProvider, QueryProvider, NuqsAdapter, Toaster, lang="es"
- `src/components/layout/app-sidebar.tsx` — Sidebar con navegacion en espanol (Panel, Incidencias, RMAs, Clientes, Proveedores, + admin: Usuarios, Configuracion)
- `src/components/layout/app-header.tsx` — Header con sidebar trigger y breadcrumbs
- `src/components/layout/breadcrumbs.tsx` — Breadcrumbs dinamicos con labels en espanol
- `src/app/(dashboard)/layout.tsx` — Layout autenticado con sidebar + header
- `src/app/page.tsx` — Redirect a /dashboard
- `src/app/(dashboard)/dashboard/page.tsx` — Panel con 4 cards placeholder
- `src/components/shared/state-badge.tsx` — IncidentStateBadge y RmaStateBadge con colores

**Paso 9 — Seed de Base de Datos**
- `src/lib/db/seed.ts` — Crea usuario admin (admin@hardware-support.local / admin123)

#### Problemas encontrados y resueltos

| # | Problema | Solucion |
|---|---|---|
| 1 | `create-next-app` rechaza directorio con archivos existentes | Crear en directorio temporal y copiar archivos |
| 2 | `node_modules` corrupto tras la copia | `rm -rf node_modules && npm install` |
| 3 | ESLint error: `as any` en ALLOWED_FILE_TYPES.includes() | Cambiar a `(ALLOWED_FILE_TYPES as readonly string[]).includes()` |
| 4 | ESLint error: `as any` en test de RMA | Usar `as const` en el array de tuplas |
| 5 | Unused imports (`eq`, `and`) en id-generator | Eliminar imports no usados |
| 6 | Unused import (`text`) en event-logs schema | Eliminar import no usado |
| 7 | Type error: `session.user.id = token.id` (unknown -> string) | Usar assertions explicitas: `token.id as string` |
| 8 | Build falla sin DATABASE_URL (neon() crashea al importar) | Lazy initialization del cliente DB via Proxy pattern |

#### Verificaciones finales

| Verificacion | Resultado |
|---|---|
| `npm run build` | PASA — 8 rutas generadas, 0 errores |
| `npm run lint` | PASA — 0 errores, 0 warnings |
| `npm test` | PASA — 39 tests en 4 archivos |
| Estructura de directorios | Completa segun CLAUDE.md |

#### Metricas

| Metrica | Valor |
|---|---|
| Archivos fuente creados (ts/tsx) | 78 |
| Archivos de test | 4 |
| Tests totales | 39 |
| Componentes shadcn/ui | 20 |
| Tablas de BD | 8 + 1 (sequences) |
| Rutas de la app | 8 (/, /login, /dashboard, /api/auth, /api/upload, + placeholders) |
| Dependencias core | ~25 |
| Dependencias dev | ~15 |

---

### SESION 3 — 2026-03-05

**Objetivo**: Rediseño UI completo — Tema Azul Profundo, Dashboard visual, Vista Canvas/Kanban
**Estado final**: COMPLETADA CON EXITO

#### Que se hizo

**Paso 1 — Tema CSS "Azul Profundo"**
- Reemplazo completo de variables OKLch en `:root` con paleta azul:
  - Primary: `oklch(0.623 0.214 259)` — azul eléctrico (#3b82f6)
  - Sidebar: `oklch(0.205 0.04 265)` — azul noche (#1a1f36)
  - Background: `oklch(0.98 0.005 265)` — gris muy claro (#f8fafc)
  - Ring: misma que primary para coherencia
- Variables semánticas añadidas: `--success` (verde), `--warning` (ámbar)
- Chart colors: azul, esmeralda, ámbar, rojo, azul oscuro
- Modo dark actualizado con misma gama azul

**Paso 2 — Sidebar rediseñado**
- Logo: caja `bg-primary` con "HSM" + texto en dos líneas
- Footer: componente `UserAvatar` (círculo con inicial) + nombre + rol traducido
- Bordes con `border-sidebar-border` para coherencia

**Paso 3 — Header mejorado**
- Altura `h-16` (era `h-14`)
- `bg-card shadow-sm` en lugar de solo `border-b`

**Paso 4 — Login split-screen**
- Layout: panel izquierdo azul noche con logo HSM, título de marca y copyright
- Panel derecho: formulario centrado con icono `Mail` en el input
- Logo HSM visible en móvil via `lg:hidden`

**Paso 5 — Dashboard visual completo**
- `src/server/queries/dashboard.ts`:
  - `getDashboardStats()` — cuenta incidencias abiertas, RMAs activos, clientes, proveedores
  - `getRecentActivity()` — event_logs con join a users
  - `getIncidentStatusDistribution()` — GROUP BY status (excluye cerrado/cancelado)
  - `getIncidentTrend()` — GROUP BY fecha (30 días) para gráfico
- `src/components/dashboard/kpi-card.tsx` — Card con icono en fondo coloreado, valor `text-3xl font-bold`
- `src/components/dashboard/incidents-chart.tsx` — AreaChart con Recharts via shadcn ChartContainer
- `src/components/dashboard/status-distribution.tsx` — BarChart horizontal con labels en español
- `src/components/dashboard/recent-activity.tsx` — ScrollArea con items de actividad
- `src/components/dashboard/quick-actions.tsx` — 3 botones: Nueva Incidencia, Nuevo RMA, Nuevo Cliente
- Dashboard page: server component con layout 4-cols KPI + 3-cols (chart+activity) + 3-cols (distribution+actions)

**Paso 6 — Vista Canvas/Kanban (componentes compartidos)**
- `src/components/shared/canvas-view.tsx` — Contenedor scroll horizontal, columnas con barra de color superior, conteo de items, empty state con borde punteado
- `src/components/shared/entity-card.tsx` — Tarjeta: número en `text-primary`, prioridad badge, título truncado, aging badge, usuario/entidad relacionada
- `src/components/shared/aging-badge.tsx` — Badge con icono Clock, verde (<1d), ámbar (1-3d), rojo (>3d)
- `src/components/shared/view-toggle.tsx` — ToggleGroup (tabla/canvas) con iconos Table2/LayoutGrid

**Paso 7 — Páginas Incidencias y RMAs funcionales**
- `src/server/queries/incidents.ts` — `getIncidents()` con join a clients y users, `getIncidentById()`
- `src/server/queries/rmas.ts` — `getRmas()` con join a providers y incidents, `getRmaById()`
- `src/server/actions/incidents.ts` — `fetchIncidents()` wrapper con auth
- `src/server/actions/rmas.ts` — `fetchRmas()` wrapper con auth
- `src/components/incidents/` — incident-columns, incident-list, incident-canvas, incident-page-content
- `src/components/rmas/` — rma-columns, rma-list, rma-canvas, rma-page-content
- Páginas: header con icono coloreado + subtítulo + toggle tabla/canvas

**Paso 8 — Mejoras en páginas existentes**
- DataTable: icono Search en input, empty state con Inbox, `bg-card` en tabla
- Páginas clients, providers, users: header rediseñado con icono en fondo tenue + subtítulo
- Dashboard layout: `bg-background` en main

**Componentes shadcn/ui instalados**: chart, tabs, toggle, toggle-group

#### Verificaciones finales

| Verificacion | Resultado |
|---|---|
| `npm run build` | PASA — 0 errores, 0 warnings |
| `npm run lint` | PASA — 0 errores, 0 warnings |
| `npm test` | PASA — 58 tests en 7 archivos |

#### Metricas

| Metrica | Valor |
|---|---|
| Archivos modificados | 13 |
| Archivos nuevos | 29 |
| Lineas añadidas | ~2,288 |
| Componentes dashboard | 5 |
| Componentes shared nuevos | 4 |
| Server queries nuevas | 7 (4 dashboard + 2 incidents + 1 rma get by ID) |

---

### SESION 4 — 2026-03-05

**Objetivo**: Reemplazar vista canvas kanban por grid con filtros de estado
**Estado final**: COMPLETADA CON EXITO

#### Que se hizo

**Problema**: La vista canvas usaba columnas horizontales tipo kanban (7 para incidencias, 8 para RMAs) con ~2000-2240px de ancho, requiriendo scroll lateral excesivo.

**Solucion**: Grid responsive con chips de filtro multi-select por estado.

**Archivos modificados (4)**:
- `src/components/shared/canvas-view.tsx` — Reescrito: nueva interfaz `CanvasStatus` + `CanvasItem`. Barra de chips de filtro (toggle multi-select) + grid responsive (`grid-cols-1 sm:2 lg:3 xl:4`). Chip "Todos" para resetear. Empty state con icono Inbox.
- `src/components/shared/entity-card.tsx` — Añadida prop `statusBadge?: ReactNode` renderizada entre número/prioridad y título.
- `src/components/incidents/incident-canvas.tsx` — Adaptado: genera `statuses` con conteo y `items` flat con `IncidentStateBadge` como statusBadge.
- `src/components/rmas/rma-canvas.tsx` — Mismo patrón con `RmaStateBadge`.

#### Verificaciones finales

| Verificacion | Resultado |
|---|---|
| `npm run build` | PASA — 0 errores, 0 warnings |
| `npm run lint` | PASA — 0 errores, 0 warnings |

---

## Estado Actual del Proyecto

### Lo que ESTA hecho (Fases 1-3)
- [x] Scaffolding completo (Next.js 15, Tailwind v4, shadcn/ui)
- [x] Esquema de BD completo (8 tablas con relaciones)
- [x] Sistema de autenticacion funcional (login/logout, roles, middleware)
- [x] Maquinas de estado para incidencias y RMAs
- [x] Validadores Zod para todas las entidades
- [x] Utilidades (fechas, aging, IDs secuenciales)
- [x] App shell (sidebar, header, breadcrumbs)
- [x] Storage layer (abstraccion + Vercel Blob)
- [x] Upload endpoint con validacion
- [x] Providers globales (Query, Session, nuqs, Toaster)
- [x] Seed de BD
- [x] Tests de state machines y utilidades
- [x] CRUD completo para Clientes, Proveedores, Usuarios
- [x] DataTable reutilizable con paginacion, busqueda, ordenamiento
- [x] Tema "Azul Profundo" aplicado a toda la app
- [x] Dashboard visual con KPIs, graficos y actividad reciente
- [x] Vista Canvas/Kanban para incidencias y RMAs
- [x] Listado de incidencias y RMAs con tabla y canvas
- [x] Queries de incidencias/RMAs con joins

### Lo que FALTA (Fases futuras)

**Fase 4 — CRUD completo de Incidencias**
- [ ] Server actions para incidencias (crear, editar, eliminar, transiciones de estado)
- [ ] Formulario de creacion/edicion de incidencia
- [ ] Pagina de detalle de incidencia con timeline de eventos
- [ ] Transiciones de estado con validacion de rol (botones en detalle)
- [ ] Event log (audit trail) con componente timeline
- [ ] Adjuntos (upload/download/delete)
- [ ] Drag & drop en vista canvas (opcional)

**Fase 5 — CRUD completo de RMAs**
- [ ] Server actions para RMAs (crear, editar, eliminar, transiciones)
- [ ] Formulario de creacion/edicion de RMA
- [ ] Pagina de detalle con timeline
- [ ] Vinculacion con incidencias (selector)
- [ ] Tracking de envios (numeros de seguimiento)

**Fase 6 — Pulido**
- [ ] Pagina de configuracion
- [ ] Gestion de perfil de usuario
- [ ] Responsive design completo
- [ ] Manejo de errores global
- [ ] Loading states y skeletons
- [ ] SEO y metadata

---

## Decisiones Tecnicas Importantes

| Decision | Razon |
|---|---|
| Lazy DB init via Proxy | Permite que `npm run build` funcione sin DATABASE_URL configurada (necesario para CI/CD y build en Vercel) |
| Zod v4 (no v3) | Instalado por defecto, API compatible con v3 pero con mejoras de rendimiento |
| next-auth beta (v5) | Requerido por el plan, callbacks session necesitan type assertions explicitas |
| State machines como funciones puras | Sin dependencia de BD, facilmente testeables, transiciones definidas declarativamente |
| Enums de PostgreSQL | Type safety a nivel de BD, mejor rendimiento que varchar con CHECK |
| Soft deletes | Preservar historial de clientes/proveedores/usuarios eliminados |
| Sequences table para IDs | Evita gaps, permite reset anual, atomico via upsert |
| Storage abstraction | Facilita cambiar de Vercel Blob a S3 u otro backend sin tocar logica de negocio |

---

## Variables de Entorno Requeridas

```bash
DATABASE_URL=              # Neon PostgreSQL connection string
NEXTAUTH_SECRET=           # openssl rand -base64 32
NEXTAUTH_URL=              # http://localhost:3000 (dev)
BLOB_READ_WRITE_TOKEN=     # Vercel Blob token
```

## Credenciales de Seed

| Campo | Valor |
|---|---|
| Email | admin@hardware-support.local |
| Password | admin123 |
| Rol | admin |

---

## Como Retomar el Desarrollo

1. Abrir terminal en `C:\Users\Qamarero\Desktop\PROYECTOS\hardware-support-manager`
2. Verificar estado: `npm run build && npm test`
3. Si hay BD configurada: `npm run db:push && npm run db:seed`
4. Iniciar dev: `npm run dev`
5. Consultar este archivo para ver que falta por hacer
6. La siguiente fase logica es **Fase 4: CRUD completo de Incidencias**
