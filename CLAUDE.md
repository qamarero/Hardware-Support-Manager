# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hardware Support Manager is an internal web application for a hardware support department that acts as intermediary between clients, providers, and warehouse/office. It manages **incidents** (support tickets) and **RMAs** (Return Merchandise Authorizations) through their full lifecycle using state machines, with complete audit trails, aging tracking, and file attachments.

**Target users**: Internal support team members (not end clients).
**Language**: All UI labels, states, form fields, error messages, and user-facing text must be in **Spanish**.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict mode) |
| ORM | Drizzle ORM |
| Database | Supabase PostgreSQL (pooler, schema `hsm`) |
| UI Components | shadcn/ui + Tailwind CSS v4 |
| Server State | TanStack Query v5 |
| URL State | nuqs |
| Forms | React Hook Form + Zod |
| Authentication | NextAuth.js v5 (Auth.js) with credentials provider |
| File Storage | Vercel Blob (abstracted behind storage layer) |
| Charts | Recharts |
| Notifications | Sonner (toast) |
| Testing | Vitest |

## Essential Commands

```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Production build (also validates types)
npm run lint         # Run ESLint
npm run db:push      # Push Drizzle schema directly to Supabase (dev only)
npm run db:migrate   # Run generated Drizzle migrations (production)
npm run db:generate  # Generate migration files from schema changes
npm run db:seed      # Seed database with demo data
npm run db:studio    # Open Drizzle Studio (database GUI)
npm test             # Run Vitest tests
npm run test:watch   # Vitest in watch mode
npm run test:coverage # Vitest with coverage report
```

## Project Structure

```
src/
  app/                          # Next.js App Router
    (auth)/                     # Auth pages (login)
    (dashboard)/                # Authenticated layout group
      dashboard/                # Dashboard/home page
      incidents/                # Incident pages (list, detail, create, edit)
      rmas/                     # RMA pages (list, detail, create, edit)
      clients/                  # Client management
      providers/                # Provider management
      users/                    # User management (admin)
      settings/                 # App settings
      intercom/                   # Intercom inbox (Bandeja Intercom)
    api/                        # API routes (/api/upload, /api/webhooks/intercom)
    layout.tsx                  # Root layout
  components/
    ui/                         # shadcn/ui base components
    layout/                     # App shell: sidebar, header, breadcrumbs
    incidents/                  # Incident-specific components (forms, tables, detail views)
    rmas/                       # RMA-specific components
    intercom/                   # Intercom inbox components (conversation list, detail, thread)
    dashboard/                  # Dashboard widgets and charts
    shared/                     # Reusable components (data-table, file-uploader, state-badge, etc.)
  lib/
    db/
      index.ts                  # Drizzle client (postgres-js via Supabase pooler)
      schema/                   # Drizzle table definitions (one file per entity)
      migrations/               # Migration utilities
    auth/                       # NextAuth.js v5 configuration
    storage/                    # File storage abstraction (Vercel Blob)
    validators/                 # Zod schemas (shared between client and server)
    state-machines/             # Incident and RMA state machine definitions
    utils/                      # Helper functions (formatting, dates, ID generation)
    constants/                  # App-wide constants (states, roles, categories, incident templates)
    intercom/                   # Intercom API client, types, sync, device detection
  server/
    actions/                    # Server Actions (mutations)
    queries/                    # Server-side data fetching functions
  hooks/                        # Custom React hooks
  types/                        # TypeScript type definitions and interfaces
drizzle/                        # Generated migration SQL files
public/                         # Static assets (images, icons)
docs/                           # Project documentation
```

## Code Conventions

### Naming

| Element | Convention | Example |
|---|---|---|
| Files & folders | kebab-case | `incident-form.tsx`, `state-machines/` |
| Functions & variables | camelCase | `getIncidentById`, `isLoading` |
| React components | PascalCase | `IncidentDetail`, `RmaForm` |
| Constants | UPPER_SNAKE_CASE | `INCIDENT_STATES`, `MAX_FILE_SIZE` |
| Database tables | snake_case | `incidents`, `event_logs` |
| Database columns | snake_case | `created_at`, `client_id` |
| TypeScript types | PascalCase | `Incident`, `RmaStatus` |
| Zod schemas | camelCase with Schema suffix | `createIncidentSchema`, `updateRmaSchema` |

### File Organization

- One component per file. File name matches component name in kebab-case.
- Co-locate component-specific types and utilities with the component.
- Shared types go in `src/types/`.
- All Zod validators in `src/lib/validators/` (shared between client forms and server actions).

### API Pattern: Server Actions

All data mutations use **Server Actions** (no REST API endpoints). The only exceptions are `/api/upload` for file uploads (multipart form data) and `/api/webhooks/intercom` for incoming Intercom webhooks.

```typescript
// src/server/actions/incidents.ts
"use server";

import { createIncidentSchema } from "@/lib/validators/incident";
import { db } from "@/lib/db";

export async function createIncident(formData: FormData) {
  const parsed = createIncidentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.flatten() };
  // ... insert into DB, return result
}
```

### Server State with TanStack Query

Use TanStack Query v5 for all client-side data fetching and cache management. Server Actions are called via `useMutation`. Data fetching functions from `src/server/queries/` are used with `useQuery`.

### URL State with nuqs

Use nuqs for all URL-synchronized state (filters, pagination, search, sorting, tabs). This keeps UI state shareable and bookmarkable.

### Forms

All forms use React Hook Form with Zod resolver. Validators are defined once in `src/lib/validators/` and shared between client validation and server-side parsing.

### Paths

- Always use **relative** imports with the `@/` alias (mapped to `src/`).
- Never hardcode absolute filesystem paths.
- Use `path.join()` when building paths programmatically.

## Domain Model

### Incidents (INC-YYYY-NNNNN)

Support tickets tracking hardware issues from report to resolution.

- **States**: Defined by state machine in `src/lib/state-machines/incident.ts`
- **Key fields**: client, device info, category, priority, description, assigned user
- **Features**: State transitions with validation, aging tracking (time in current state), event log (audit trail), file attachments

### RMAs (RMA-YYYY-NNNNN)

Return Merchandise Authorizations for sending defective hardware to providers.

- **States**: Defined by state machine in `src/lib/state-machines/rma.ts`
- **Key fields**: linked incident(s), provider, device info, tracking numbers
- **Features**: State transitions, provider communication tracking, device location tracking, event log, file attachments

### Supporting Entities

- **Clients**: Companies or individuals reporting issues
- **Providers**: Hardware manufacturers/distributors for RMA processing
- **Users**: Internal team members with roles (admin, technician, viewer)
- **EventLog**: Polymorphic audit trail (linked to incidents or RMAs)
- **Attachments**: Polymorphic file attachments (linked to incidents, RMAs, or event log entries)
- **IntercomInbox**: Triage queue for Intercom escalations (webhook-driven, converts to incidents)

### Intercom Integration

- **Webhook**: `POST /api/webhooks/intercom` receives escalated conversations/tickets
- **Bandeja Intercom**: `/intercom` page — split-pane email-style inbox for reviewing escalations
- **Flow**: Intercom escalation → webhook → `intercom_inbox` table → team reviews → "Crear Incidencia" inline
- **Filters**: Only Hardware/RMA escalations are captured (keyword filtering in webhook)
- **Dedup**: Unique constraint on `intercom_conversation_id` + check `incidents.intercomEscalationId` before creating
- **API Client**: `src/lib/intercom/client.ts` — REST API v2.11 (getConversation, searchContacts, addNote, closeTicket)
- **Bidirectional sync** (`src/lib/intercom/sync.ts`): On incident state transitions, if linked to Intercom, an internal note is posted back. On resolution/closure, the Intercom ticket is auto-closed.
- **Device detection** (`src/lib/intercom/device-detector.ts`): Regex-based extraction of device type, model, and serial number from Intercom conversation text for auto-fill.
- **Conversation thread**: `ConversationThread` component renders full Intercom message timeline (client/admin/internal notes) in both Bandeja and incident detail.

### ID Format

Both incidents and RMAs use the format `{PREFIX}-{YEAR}-{SEQUENTIAL_5_DIGITS}`:
- `INC-2026-00001`, `INC-2026-00002`, ...
- `RMA-2026-00001`, `RMA-2026-00002`, ...

Sequential counter resets each year.

## Database

### Drizzle ORM with Supabase

- Schema files in `src/lib/db/schema/` (one file per table/entity, all in `hsm` PostgreSQL schema).
- Schema namespace defined in `src/lib/db/schema/hsm-schema.ts` using `pgSchema("hsm")`.
- Client initialization in `src/lib/db/index.ts` using postgres-js driver via Supabase pooler.
- Use `drizzle-kit` commands for migrations (see Essential Commands).

### Schema Changes Workflow

1. Modify schema files in `src/lib/db/schema/`.
2. Run `npm run db:generate` to create migration SQL.
3. Run `npm run db:migrate` to apply (or `npm run db:push` in development).
4. Update corresponding Zod validators if fields changed.
5. Update TypeScript types if needed.

### Conventions

- Use `pgTable` from `drizzle-orm/pg-core`.
- All tables include `id` (UUID, primary key), `createdAt`, and `updatedAt` timestamps.
- Use database-level foreign keys and constraints.
- Soft deletes where appropriate (`deletedAt` nullable timestamp).

## Authentication

NextAuth.js v5 (Auth.js) with credentials provider.

- Configuration in `src/lib/auth/`.
- Middleware protects all routes under `(dashboard)/`.
- Auth pages under `(auth)/` layout group.
- Session available via `auth()` on server and `useSession()` on client.
- Roles: `admin`, `technician`, `viewer` -- enforce in server actions.

## File Storage

Abstracted storage layer in `src/lib/storage/`:

- **Upload endpoint**: `/api/upload` (the only REST endpoint).
- **Storage backend**: Vercel Blob.
- **Abstraction**: Storage functions are behind an interface so the backend can be swapped.
- **Attachments are polymorphic**: Can be linked to incidents, RMAs, or event log entries.
- **Constraints**: Validate file type and size before upload.

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Priorities

1. **State machines**: Test all valid transitions and reject invalid ones.
2. **Validators**: Test Zod schemas with valid and invalid data.
3. **Utils**: Test ID generation, date formatting, aging calculations.
4. **Server actions**: Test with mocked DB where practical.

### Conventions

- Test files live next to source files: `incident.test.ts` beside `incident.ts`.
- Use Vitest `describe`/`it` blocks with descriptive names (in English).
- Mock external services (DB, storage) in unit tests.

## Claude Code Tooling

> **DIRECTIVA OBLIGATORIA**: Antes de abordar cualquier tarea, consultar las herramientas disponibles (agentes, skills, comandos, MCP servers) y usar la más adecuada. No reinventar funcionalidad que ya existe en el tooling del proyecto. La selección de herramienta debe seguir la guía de selección al final de esta sección.

### Agents (18) — `.claude/agents/`

| Agent | Propósito | Cuándo usar |
|-------|-----------|-------------|
| database-architect | Diseño de BD, schemas, migraciones | Cambios en schema Drizzle, optimización queries |
| supabase-schema-architect | Schema Supabase + plan de migraciones | Nueva tabla/columna, `sql/0NN-*.sql`, índices |
| vercel-deployment-specialist | Despliegue en Vercel | Build/deploy, variables de entorno, rollback |
| frontend-developer | Desarrollo React/TypeScript frontend | Componentes nuevos, páginas, layouts |
| ui-ux-designer | Crítica UI/UX basada en investigación | Revisión de diseño, accesibilidad, usabilidad |
| backend-architect | Server Actions, state machines, queries Drizzle | Nueva mutación, transición de estado, webhook Intercom, query lenta |
| fullstack-developer | Desarrollo cross-stack completo | Features que tocan BD + API + UI a la vez |
| code-reviewer | Revisión de código y calidad | Pre-merge, auditoría de seguridad, calidad |
| typescript-pro | Patrones TypeScript avanzados | Generics complejos, type safety, inferencia |
| test-engineer | Estrategia y ejecución de tests | Tests nuevos, cobertura, estrategia testing |
| debugger | Investigación y resolución de bugs | Errores en producción, stack traces, race conditions |
| context-manager | Coordinación de contexto del proyecto | Tareas multi-agente, sesiones largas |
| prompt-engineer | Optimización de prompts LLM | Si se integra IA en la app |
| error-detective | Análisis patrones de error, cascadas | Errores recurrentes, correlación entre servicios |
| deployment-engineer | Despliegue y CI/CD | Pipeline Vercel, rollbacks, automatización |
| mcp-expert | Configuración de servidores MCP | Nuevos MCP servers, debug de conexiones |
| documentation-expert | Estándares de documentación | Actualizar docs, CLAUDE.md, proyecto_log |
| ai-engineer | Ingeniería AI/ML | Solo si se añade componente IA al proyecto |

### Skills (10) — `.claude/skills/`

| Skill | Propósito | Cuándo usar |
|-------|-----------|-------------|
| **react-best-practices** | 40+ reglas performance React/Next.js, 47 ficheros de reglas | Optimización rendering, bundles, data fetching |
| **supabase-postgres-best-practices** | Optimización Postgres y Supabase, 36 ficheros de reglas | Queries complejas, índices, full-text search |
| **emil-design-eng** | Filosofía Emil Kowalski: UI polish, animaciones | Microinteracciones, transiciones, detalles visuales |
| **ui-ux-pro-max** | Catálogo de estilos, paletas y tipografía (763 filas CSV) | Decisiones de diseño, paletas, tipografía |
| **frontend-design** | Interfaces production-grade con alto diseño | Landing pages, componentes con diseño distintivo |
| **mcp-builder** | Guía para crear servidores MCP | Integrar nuevos servicios externos vía MCP |
| **git-commit-helper** | Mensajes de commit descriptivos | Análisis de diffs para generar mensajes |
| **canvas-design** | Arte visual en .png/.pdf | Posters, diseños estáticos (poco uso en HSM) |
| **theme-factory** | Toolkit de temas (10 presets) | Slides, docs, landing pages (poco uso en HSM) |
| **file-organizer** | Organizar archivos y carpetas | Reestructuración de directorios |

> **Eliminadas (2026-08-31)**: `code-reviewer`, `senior-frontend` y `senior-fullstack`. Eran
> plantillas huecas: sus 9 scripts Python tenían el cuerpo vacío (`# Main logic here`,
> `findings = []` fijo) y sus 9 `references/*.md` eran relleno (`Pattern 1`, `Scenario 1/2/3`,
> `// Implementation details`). Reportaban "0 findings" siempre. Usar en su lugar
> `react-best-practices`, `supabase-postgres-best-practices` y el comando `/code-review`.

> **Nota Windows**: los scripts Python de las skills imprimen emoji y la consola es cp1252,
> lo que provoca `UnicodeEncodeError`. Ejecutarlos con `PYTHONIOENCODING=utf-8`.
> `ui-ux-pro-max` además solo busca en inglés (una query en español devuelve 0 resultados).

### Skills Built-in (del sistema)

| Skill | Propósito |
|-------|-----------|
| `anthropic-skills:pdf` | Leer, crear, combinar, dividir PDFs |
| `anthropic-skills:xlsx` | Leer, crear, editar hojas de cálculo |
| `anthropic-skills:pptx` | Crear y manipular presentaciones PowerPoint |
| `anthropic-skills:docx` | Crear y manipular documentos Word |
| `anthropic-skills:skill-creator` | Crear nuevas skills, medir rendimiento |
| `simplify` | Revisar código para calidad y eficiencia |
| `claude-api` | Construir apps con API Claude / Anthropic SDK |

### Commands (13) — `.claude/commands/`

| Comando | Propósito | Cuándo usar |
|---------|-----------|-------------|
| `/commit` | Git commit inteligente con linting previo | Siempre para commits (preferir sobre git manual) |
| `/code-review` | Revisión de calidad de código | Antes de merge o push importante |
| `/refactor-code` | Mejora y refactorización | Limpiar código existente |
| `/ultra-think` | Análisis profundo multi-dimensional | Decisiones arquitecturales complejas |
| `/todo` | Gestión de tareas del proyecto | Planificación y seguimiento |
| `/architecture-review` | Evaluación de arquitectura | Revisar decisiones de diseño del sistema |
| `/update-docs` | Sincronización documentación | Tras cambios significativos |
| `/explain-code` | Análisis y explicación de código | Entender código existente |
| `/nextjs-performance-audit` | Auditoría de rendimiento (bundle/runtime) | Página lenta, regresión de rendimiento |
| `/nextjs-bundle-analyzer` | Análisis del bundle y code splitting | Build pesado, imports que sobran |
| `/nextjs-api-tester` | Pruebas de rutas API | Solo `/api/upload` y `/api/webhooks/intercom` |
| `/supabase-migration-assistant` | Generar y validar migraciones | Cambio de schema con SQL versionado |
| `/supabase-security-audit` | Auditoría de permisos y accesos | Revisar grants de `hsm_app` y roles en actions |

### MCP Servers — `.mcp.json`

| Server | Tipo | Propósito | Estado |
|--------|------|-----------|--------|
| postgresql | Command | Conexión PostgreSQL directa al schema `hsm` | ✅ Funciona |
| github | Command | API GitHub | ⚠️ Solo lectura pública: `GITHUB_PERSONAL_ACCESS_TOKEN` vacío. Crear PRs/issues falla |
| supabase | HTTP | Gestión proyecto Supabase | ⚠️ Requiere OAuth interactivo (`/mcp` en terminal) |

Disponible fuera de `.mcp.json`: **context7** (documentación actualizada de librerías —
Next.js, Drizzle, TanStack). Para contenido web usar las herramientas integradas
**WebFetch** / **WebSearch**, no un MCP.

> **Eliminados (2026-08-31)**: `web-fetch`, `markitdown` y `figma`. Apuntaban a
> `@anthropic-ai/fetch-mcp`, `@anthropic-ai/markitdown-mcp` y `@anthropic-ai/figma-mcp`,
> paquetes que **no existen en npm (404)**: nunca pudieron arrancar. Sustitutos reales, si
> algún día se necesitan: `markitdown` y el GitHub oficial requieren **Docker** (no instalado);
> Figma Dev Mode es un servidor local en `http://127.0.0.1:3845/mcp` que exige la app de
> escritorio de Figma.

> **Credenciales**: `.mcp.json` contiene la contraseña de `hsm_app` en claro. El fichero está
> en `.gitignore` (verificado: nunca se ha subido con credenciales reales; las versiones
> históricas solo llevaban placeholders). No crear copias `.bak` — el `.gitignore` ya las cubre.

### Guía de Selección de Herramientas

| Tipo de tarea | Herramienta principal | Complemento |
|---------------|----------------------|-------------|
| **Nuevo componente UI** | agente `frontend-developer` | skill `emil-design-eng` + `ui-ux-pro-max` |
| **Feature fullstack** | agente `fullstack-developer` | agente `backend-architect` para la capa de Server Actions |
| **Cambio en BD/schema** | agente `supabase-schema-architect` | comando `/supabase-migration-assistant` + skill `supabase-postgres-best-practices` |
| **Server Actions / webhooks** | agente `backend-architect` | skill `supabase-postgres-best-practices` |
| **Optimizar performance** | skill `react-best-practices` | comando `/nextjs-performance-audit` o `/nextjs-bundle-analyzer` |
| **Auditar permisos/accesos** | comando `/supabase-security-audit` | agente `code-reviewer` |
| **Code review** | comando `/code-review` | agente `code-reviewer` para revisión profunda |
| **Bug fixing** | agente `debugger` | agente `error-detective` si es recurrente |
| **Commit** | comando `/commit` | skill `git-commit-helper` para analizar diffs |
| **Decisión arquitectural** | comando `/ultra-think` | comando `/architecture-review` |
| **Diseño UI/UX** | skill `ui-ux-pro-max` | agente `ui-ux-designer` para crítica |
| **Animaciones/polish** | skill `emil-design-eng` | skill `frontend-design` |
| **Testing** | agente `test-engineer` | — |
| **Documentación** | comando `/update-docs` | agente `documentation-expert` |
| **Deploy** | agente `vercel-deployment-specialist` | `deployment-engineer` es genérico: preferir el de Vercel |
| **Nuevo MCP server** | skill `mcp-builder` | agente `mcp-expert` |

### Sinergias y Prioridades entre Herramientas

Cuando hay solapamiento entre herramientas:
- **Performance React**: `react-best-practices` (40+ reglas específicas) es la referencia principal
- **Code review**: `/code-review` (rápido) → agente `code-reviewer` (profundo)
- **Commits**: `/commit` (workflow principal) → `git-commit-helper` (solo analizar diffs)
- **UI/UX**: `ui-ux-pro-max` (catálogo de estilos) + agente `ui-ux-designer` (crítica investigativa) — usar juntos
- **Postgres**: `supabase-postgres-best-practices` (reglas de referencia) + agente `database-architect` (aplica con contexto)
- **Diseño**: la skill `frontend-design` del repo se solapa con el plugin de usuario del mismo
  nombre; al invocarla por nombre puede haber ambigüedad

### Componentes traídos de aitmpl.com (2026-08-31)

De `davila7/claude-code-templates` (catálogo de aitmpl.com: 435 agentes, 346 comandos, 101 MCPs)
se instalaron 2 agentes y 5 comandos. Cada uno lleva una sección **"Adaptaciones para HSM"**
justo tras su título que corrige lo que el componente genérico daba por supuesto:

- `supabase-schema-architect` y `/supabase-security-audit` asumían **RLS**. HSM **no usa RLS**:
  controla el acceso con los GRANT del rol `hsm_app` y con comprobación de rol NextAuth dentro
  de cada Server Action. La nota reinterpreta la auditoría en esos términos.
- `supabase-schema-architect` y `/supabase-migration-assistant` asumían migraciones
  **transaccionales**; el SQL Editor de Supabase no soporta `BEGIN`/`COMMIT`.
- `/nextjs-api-tester` asumía una API REST completa; aquí solo existen 2 endpoints y el resto
  son Server Actions que se prueban con Vitest.
- Los comandos de rendimiento y bundle llevan recordatorio de **no arrancar servidores locales
  sin preguntar**.

**Al añadir componentes de este catálogo: leerlos enteros primero.** Tres skills de la misma
fuente resultaron ser plantillas huecas y tres MCPs apuntaban a paquetes npm inexistentes.

### Contexto de proyecto en los agentes

Los 16 agentes llevan al inicio un bloque **"Project context: Hardware Support Manager (HSM)"**
con el stack real y una lista explícita de lo que **no** deben proponer (REST/microservicios,
GraphQL, Prisma, MongoDB, Redis, Redux, Express, NestJS, Kubernetes, Docker, Vue, Angular).
Los agentes vienen de `claude-code-templates` y son genéricos; sin ese bloque contradecían la
arquitectura de este proyecto. **Mantener el bloque al editar o añadir agentes.**

## Deployment

- **Platform**: Vercel
- **Database**: Supabase PostgreSQL (connection via pooler, schema `hsm`)
- **File storage**: Vercel Blob
- **Environment variables**: Set in Vercel dashboard (never in code)

### Deploy Workflow

```bash
npm run build         # Verify build passes locally
npm run lint          # Verify no lint errors
npm test              # Verify tests pass
# Push to main branch -- Vercel deploys automatically
```

## Security

### Environment Variables

- **NEVER** hardcode secrets, API keys, tokens, or passwords in code.
- Use `process.env.VARIABLE_NAME` to access secrets.
- Local development: `.env` or `.env.local` (already in `.gitignore`).
- Production: Vercel environment variables dashboard.

```typescript
// WRONG
const dbUrl = "postgresql://user:password@host/db";

// CORRECT
const dbUrl = process.env.DATABASE_URL;
```

### Required Environment Variables

```bash
DATABASE_URL=              # Supabase PostgreSQL pooler connection string
NEXTAUTH_SECRET=           # NextAuth.js secret (generate with openssl rand -base64 32)
NEXTAUTH_URL=              # App URL (http://localhost:3000 in dev)
BLOB_READ_WRITE_TOKEN=     # Vercel Blob token
INTERCOM_ACCESS_TOKEN=     # Intercom API key (for API calls)
INTERCOM_WEBHOOK_SECRET=   # Secret for webhook HMAC verification
INTERCOM_ADMIN_ID=         # Intercom admin ID for sync notes (e.g., 8601230)
```

### Auth Security

- All server actions must verify session before executing.
- Role-based access: check user role for destructive or admin-only operations.
- Validate all inputs with Zod on the server side, even if also validated on client.

## Common Issues

**Build fails with type errors**
- Run `npm run build` locally before pushing. Next.js build is stricter than `tsc`.
- Check that all server actions have `"use server"` directive.

**Database connection errors**
- Verify `DATABASE_URL` is set and correct.
- Supabase pooler requires `prepare: false` in the postgres-js client options.
- Connection uses a dedicated `hsm_app` role with access to the `hsm` schema only.

**Drizzle schema out of sync**
- Run `npm run db:push` (dev) or `npm run db:migrate` (prod) after schema changes.
- If `db:push` fails, check for breaking changes (dropping columns with data).

**File uploads failing**
- Verify `BLOB_READ_WRITE_TOKEN` is set.
- Check file size limits in the upload route.
- Ensure the `/api/upload` route handles multipart form data correctly.

**State transition rejected**
- Check the state machine definition for allowed transitions.
- Verify the current state is correct (may be stale -- refetch).
- Check if the transition requires specific conditions (e.g., all fields filled).

**Spanish characters not displaying**
- Ensure files are saved as UTF-8.
- Check that `<html lang="es">` is set in the root layout.

**TanStack Query cache stale after mutation**
- Invalidate relevant query keys after successful server action mutations.
- Use `queryClient.invalidateQueries({ queryKey: [...] })` in `onSuccess`.

**Search/filter with `unaccent()` fails on Supabase pooler**
- Supabase pooler does not support `unaccent()` (even as `extensions.unaccent()`).
- Use plain `ILIKE` for text search instead.

**DDL migrations fail with `hsm_app` role**
- The `hsm_app` role only has SELECT/INSERT/UPDATE/DELETE privileges.
- Run DDL migrations (CREATE TABLE, ALTER TYPE, DROP COLUMN) as `postgres` in Supabase SQL Editor.
- Split `ALTER TYPE` and `UPDATE` into separate statements (Supabase doesn't support `BEGIN`/`COMMIT`).
