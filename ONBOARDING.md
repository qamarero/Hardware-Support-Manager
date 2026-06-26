# ONBOARDING — Hardware Support Manager (HSM)

> Documento operativo para teletrabajar desde otro terminal sin perder contexto.
> Mantener en español, UTF-8. Última revisión: **2026-06-26**.
> Fuentes de verdad: este doc (operativa) · `docs/proyecto_log.md` (changelog histórico) · el plan de proyectos en `C:/Users/Qamarero/.claude/plans/de-la-ficha-de-binary-conway.md` (estado actual ①-⑨).

---

## 1. Qué es HSM y para quién

HSM es una aplicación web **interna** (Next.js 15 App Router) del departamento de soporte hardware de **Qamarero**. Actúa como intermediario entre **cliente ↔ proveedor/SAT ↔ almacén/oficina**: gestiona **incidencias** (`INC-YYYY-NNNNN`) y **RMAs** (`RMA-YYYY-NNNNN`) a lo largo de su ciclo de vida con máquinas de estado, audit trail (`event_logs`), SLA con pausa, adjuntos y una integración con **Intercom** (webhook entrante + sincronización de notas). El usuario principal es **Domi** (soporte hardware, admin Intercom `8601230`). No lo usan clientes finales; toda la UI y textos van en **español**.

---

## 2. Arranque rápido desde otro terminal

> El harness de Claude Code crea **un worktree por sesión** bajo `.claude/worktrees/<nombre>`. Antes de tocar nada, verifica que tu worktree está sincronizado con `main`.

```bash
# 1) ¿En qué rama/worktree estoy y cuánto me separo de main?
git rev-parse --abbrev-ref HEAD
git rev-list --left-right --count HEAD...main   # salida "A<TAB>B": A=adelante, B=detrás

# 2) Si estás DETRÁS y SIN commits propios (A=0), pon al día con fast-forward:
git merge --ff-only main

# 3) Dependencias + entorno
npm install
cp .env.example .env.local        # rellena las 9 variables (ver §3)

# 4) Verificación (NO dependas del dev server)
npm run build && npm run lint
```

| Comando | Para qué |
|---|---|
| `npm run dev` | Servidor de desarrollo (`localhost:3000`, Turbopack) |
| `npm run build` | Build de producción + valida tipos (Turbopack) |
| `npm run lint` | ESLint |
| `npm test` | Vitest (run único) |
| `npm run test:watch` | Vitest en watch |
| `npm run db:push` | Push del schema Drizzle (solo dev) |
| `npm run db:generate` | Generar SQL de migración |
| `npm run db:migrate` | Aplicar migraciones generadas (prod) |
| `npm run db:studio` | Drizzle Studio (GUI de BD) |

> ⚠️ **Para a `dev` antes de `build`.** Lanzar `npm run build` con el dev server (Turbopack) corriendo corrompe `.next` → errores 500 en peticiones RSC. Solución: parar dev, borrar `.next`, reiniciar.

---

## 3. Variables de entorno (9)

En local viven en `.env.local`. En producción están en el **dashboard de Vercel**; **tras cambiarlas hay que hacer Redeploy manual** (el build congela el valor anterior).

| Variable | Qué es / gotcha |
|---|---|
| `DATABASE_URL` | Cadena del **pooler de Supabase, transaction mode (puerto 6543)**. Rol dedicado **`hsm_app`** (solo DML: SELECT/INSERT/UPDATE/DELETE, **sin DDL**), esquema `hsm`. El cliente postgres-js usa **`prepare: false`** (obligatorio con el pooler). |
| `NEXTAUTH_SECRET` | Secreto de NextAuth v5 (`openssl rand -base64 32`). |
| `NEXTAUTH_URL` | URL de la app. Prod: `https://hardware-support-manager.vercel.app` (también sirve el formulario público `/submit`). |
| `BLOB_READ_WRITE_TOKEN` | Token del store **Vercel Blob** (público, `hardware-support-manager-blob`). **Sin él los adjuntos fallan en silencio.** |
| `INTERCOM_ACCESS_TOKEN` | API key de Intercom (llamadas a la API v2.11). |
| `INTERCOM_WEBHOOK_SECRET` | Secreto para verificación HMAC del webhook (las apps privadas pueden no firmar → fallback a validación de estructura). |
| `INTERCOM_ADMIN_ID` | `8601230` (Domi). Admin que firma las notas automáticas. **Sin él las notas a Intercom fallan en silencio** (el default `"0"` las rechaza). |
| `MAIN_PORTAL_API_KEY` | Shared secret (`X-API-Key`) para `GET /api/external/metrics` (consumido por el HW Main Portal). |
| `HSM_PUBLIC_API_KEY` | Shared secret (`X-API-Key`) para `/api/external/incidents` (datos detallados + PII). Sin él el endpoint responde 503. |

---

## 4. Arquitectura en una vista

- **Next.js 15 App Router** + **Server Actions** (todas las mutaciones) + **queries server-side** (`src/server/queries/`). Único endpoint REST relevante para subidas: `/api/upload`; webhook en `/api/webhooks/intercom`; API externa en `/api/external/*`.
- **Drizzle ORM** sobre **Supabase PostgreSQL**, esquema `hsm` (un archivo por entidad en `src/lib/db/schema/`).
- **TanStack Query v5** (claves centralizadas en `src/lib/query-keys.ts` con helpers `invalidateIncidentQueries`/`invalidateRmaQueries`).
- **nuqs** (estado en URL: filtros/paginación/tabs), **React Hook Form + Zod** (validadores en `src/lib/validators/`, compartidos cliente/servidor), **NextAuth v5** (credenciales, roles admin/technician/viewer).

### DOS sistemas de UI conviven — ojo

El frontend se reescribió por completo (proyecto ③). **El sistema VIVO es "proto"**:

- **CSS plano**, no Tailwind para las pantallas nuevas: `src/app/proto-tokens.css` + `src/app/proto-app.css` (clases `.btn/.card/.kanban/.kcard/.drawer/.sla-bar/...`). Se cargan **después** de `globals.css` en `src/app/layout.tsx` para prevalecer.
- **Componentes proto** (los que renderizan la app real): `src/components/{incidents-v2, rmas-v2, dashboard-v2, providers-v2, users-v2, inventario-v2, tablero-v2, proto, shell, casos, mi-dia, reminders}` + las bandejas en `intercom/` y `submissions/` (re-estiladas pero con su lógica intacta).
- **Marca Qamarero**: naranja `#ff592f`, tipografía **DM Sans** (self-hosted) + **Space Mono** (números/IDs). **MODO CLARO FORZADO** — `ThemeProvider` usa `forcedTheme="light"`; las pantallas proto no tienen variante oscura.
- **shadcn antiguos = posible CÓDIGO MUERTO**: `src/components/{incidents, rmas, dashboard, clients, providers, users, warehouse, analytics}` son la UI anterior al rewrite. **Antes de tocar un componente, verifica el wiring real** en `src/app/(dashboard)/<ruta>/page.tsx` (p.ej. `incidents/page.tsx` importa `incidents-v2/incidents-screen`, `dashboard/page.tsx` importa `dashboard-v2/dashboard-screen`).

> Excepción importante: la **Bandeja Intercom** (`/intercom`) sigue montada sobre `src/components/intercom/*` (shadcn re-skin), NO proto. Las bandejas Intercom/Soporte conservan sus llamadas a server actions y sus `queryKeys`.

### Mapa de carpetas clave

```
src/
  app/(dashboard)/<ruta>/page.tsx   # cada ruta importa su pantalla proto -v2 (verifica aquí el wiring)
  app/proto-tokens.css · proto-app.css   # sistema de diseño VIVO
  app/api/{upload, webhooks/intercom, external/{metrics,incidents,rmas}}
  components/{...-v2, proto, shell, casos, mi-dia, reminders}   # UI VIVA
  components/{incidents, rmas, dashboard, ...}                  # UI legacy (posible muerta)
  lib/db/schema/        # tablas Drizzle (esquema hsm)
  lib/intercom/         # 🔒 INTOCABLE (client.ts, sync.ts, notes vía actions, types, detectores)
  lib/validators/ · lib/state-machines/ · lib/constants/statuses.ts · lib/query-keys.ts
  server/actions/ · server/queries/
sql/                    # 18 migraciones aditivas (se aplican A MANO en Supabase)
docs/proyecto_log.md    # changelog histórico
```

---

## 5. Estado de proyectos (①-⑨)

> Fuente de verdad del estado: el plan en `C:/Users/Qamarero/.claude/plans/de-la-ficha-de-binary-conway.md`. Changelog histórico: `docs/proyecto_log.md`.

| # | Proyecto | Estado |
|---|---|---|
| ① | Rediseño design-system (herencia de tokens, R0-R7) | **Superado por ③** |
| ② | Integración funcional del prototipo (fases F) | **Superado por ③** |
| ③ | **Rewrite TOTAL del frontend desde el prototipo (proto, W0-W5)** | **COMPLETADO** — origen del sistema "proto"; drawers laterales en vez de páginas `[id]` |
| ④ | **HSM como asistente diario** | **EN CURSO** — hechos **A1** (badges + buscador global + campana/centro de avisos), **A2** (recordatorios: modelo + acciones + quick-add), **A3** ("Mi día" `/mi-dia`), **A4** (contexto de cliente + registro progresivo + catálogo `articles`), **A5** (redefinición de estados incidencia/RMA + arreglo "Derivar a RMA" → `esperando_pieza` con SLA en pausa), **A6.1** (reglas de captura Intercom). **Pendiente:** A6.2 (filtro fino del webhook), A7 (email/Resend + Vercel Cron), A8 (métricas big-data por `articleId` + base de conocimiento de proveedores). |
| ⑤ | QoL de uso diario (QW · TR · AG) | **COMPLETADO** |
| ⑥ | Descartar en la Bandeja Intercom (botón en ficha + descarte en bloque) | **COMPLETADO** |
| ⑦ | Pulir RMA: resultado (`outcome`) visible + captura obligatoria al cerrar | **COMPLETADO** |
| ⑧ | Formulario público `/submit` + Bandeja Soporte (+ adjuntos en el form) | **COMPLETADO** |
| ⑨ | Procedimientos de proveedor + correo de RMA + datos de recogida (P1-P4) | **COMPLETADO** |

---

## 6. Reglas y gotchas NO negociables

> 🔒 **Lee esta caja antes de tocar nada de Intercom, BD o el sistema de UI.**

- **INTERCOM INTOCABLE.** No tocar `src/lib/intercom/*`, las server actions `notes.ts` ni `intercom-inbox.ts`, ni el webhook `src/app/api/webhooks/intercom/route.ts`. **Gate de 6 puntos** antes de cualquier commit que toque la bandeja o las transiciones: (1) `/intercom` carga y sus 3 pestañas funcionan · (2) abrir conversación carga el hilo · (3) importar por URL entra en bandeja · (4) convertir crea incidencia y queda "convertida" · (5) nota manual aparece e Intercom la recibe · (6) transición de estado postea la nota con el label nuevo.
- **Modo claro forzado.** No introducir dark mode; las pantallas proto no lo soportan.
- **Migraciones ADITIVAS, aplicadas A MANO por el propietario** en el **SQL Editor de Supabase como rol `postgres`** (el rol `hsm_app` no tiene DDL). Carpeta `sql/` (**18** ficheros numerados `001`-`018`, más auxiliares). Reglas: `ALTER TYPE ... ADD VALUE` / `RENAME VALUE` van en **sentencia separada** de su uso (no en la misma transacción; el editor no soporta BEGIN/COMMIT explícito). **Backup/export de `incidents` + `event_logs` antes de cualquier migración de enum.** Nunca DROP destructivo.
- **Pooler `prepare: false`**; rol `hsm_app` sin DDL.
- **Proto vivo vs shadcn legacy** (ver §4): verifica el `page.tsx` antes de editar un componente.
- **IGNORAR directorios de referencia del prototipo**: `prototipo-referencia/`, `Codigo-rediseño/`, `docs/design/qamarero-handoff/`. Son fuentes visuales, no código de la app.
- **UTF-8 / español** en todos los textos de UI.
- **Para `dev` antes de `build`** (Turbopack corrompe `.next` → 500 RSC; borrar `.next`).
- **MCP Supabase conectado READ-ONLY** (proyecto ref `thkrkubkiasfqmiiwfbj`, esquema `hsm`). Sirve para consultar, no para escribir.

---

## 7. Datos reales de referencia (para no re-consultar)

- **`rmas.incident_id`** es FK **nullable** a `incidents.id`, con `onDelete: restrict` y **SIN unique** → caben **N RMAs por incidencia** (verificado en `src/lib/db/schema/rmas.ts:42`).
- Cobertura aproximada (cifras de referencia del propietario, snapshot — confirmar contra BD si son load-bearing): **~12 de ~53 incidencias** tienen RMA; **~17 RMAs** en total.
- **NO existe** una acción de `event_log` llamada "derivado a RMA" como tipo propio; la derivación se registra como transición + evento de texto.
- Enums: `incident_status` (~12 valores: legacy renombrados + nuevos como `esperando_pieza`), `rma_status` (~15 valores incluyendo `entregado_cliente`, `rechazado` y retrocesos de admin).

---

## 8. Deploy

- **Vercel, push-to-main = deploy automático.** Tras cambiar variables de entorno en Vercel → **Redeploy manual**.
- **NO existe `vercel.json` en la raíz del repo todavía** (los `vercel.json` que aparecen están dentro de los dirs de referencia, no cuentan). Será necesario crearlo para el **Vercel Cron de A7** (`RESEND_API_KEY` + `CRON_SECRET` + entrada de cron → `GET /api/cron/daily-digest`).
- Webhook Intercom: `POST /api/webhooks/intercom` (app "Hw sync HSM", workspace `hckfnffg`).

---

## 9. Workflow de cambios

1. **Sincronizar** el worktree con `main` (§2).
2. **Editar** (verifica el wiring proto vs legacy antes de tocar un componente).
3. **Verificar**: `npm run build && npm run lint` (+ `npm test` con Vitest si aplica).
4. **Gate Intercom** (§6) si el cambio toca bandeja o transiciones.
5. **Commit** con el formato emoji del repo (p.ej. `✨ feat:`, `🐛 fix:`, `📝 docs:`) y trailer:
   ```
   Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
   ```
6. **Push**.
7. **Migración SQL** (si la hay): mostrarla al propietario para que la aplique a mano en el SQL Editor de Supabase (rol `postgres`). No intentar aplicarla con `hsm_app`.

---

## Sesión en curso (2026-06-26)

**Conexión del MCP de Supabase** (read-only, ref `thkrkubkiasfqmiiwfbj`) en `.mcp.json` (gitignored) para que el asistente consulte la BD directamente.

**① Transiciones de estado LIBRES / no lineales** (Kanban + ficha incidencia + ficha RMA). El estado pasa a entenderse como "situación actual", no como flujo rígido:
- Servidor: `transitionIncident` y `transitionRma` aceptan un flag `force` que **omite la validación del grafo** pero **conserva** la pausa de SLA, el auto-cierre de la incidencia al cerrar el RMA y el outcome obligatorio. El auto-cierre interno ahora va con `force` para no quedar bloqueado por el grafo.
- Validadores: `transitionIncidentSchema` añade `esperando_pieza` + `force`; `transitionRmaSchema` añade `force`.
- UI: los selectores "Cambiar estado…" de ambas fichas listan **todos** los estados vivos; el Kanban permite **soltar en cualquier columna** (fuerza el salto si no es natural).
- **Arreglado de paso el error del Kanban**: la columna "Esperando resolución del RMA" (`esperando_pieza`) faltaba en el validador → daba "Datos inválidos". **Sin migración SQL** (el valor ya existía en el enum).

**② Visibilidad del enlace Incidencia → RMA** (antes solo se veía desde el lado RMA y en Casos):
- `getIncidents` trae `rmaCount` + último RMA (subconsultas correlacionadas).
- **Badge clicable** "RMA-…" en la lista de incidencias (abre el drawer del RMA).
- Sección **"RMA(s) vinculados"** en el drawer de la incidencia + el botón "Crear RMA" pasa a **"Ver RMA-…"** cuando ya existe. Reutiliza `useDrawers().openRma`.

Pendiente: validar en runtime tras el deploy; (opcional) guard de duplicados en `createRma`.
