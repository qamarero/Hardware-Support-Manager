# ONBOARDING — Hardware Support Manager (HSM)

> Documento operativo para teletrabajar desde otro terminal sin perder contexto.
> Mantener en español, UTF-8. Última revisión: **2026-07-07**.
> Fuentes de verdad: este doc (operativa) · `docs/proyecto_log.md` (changelog histórico) · el plan de proyectos en `C:/Users/Qamarero/.claude/plans/de-la-ficha-de-binary-conway.md` (estado actual ①-⑪).

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
sql/                    # 20 migraciones aditivas (se aplican A MANO en Supabase)
docs/proyecto_log.md    # changelog histórico
```

---

## 5. Estado de proyectos (①-⑪)

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
| ⑩ | **Etiquetas físicas con QR** (RMA + equipos sin RMA) | **COMPLETADO** — ruta `/etiqueta/[tipo]/[id]` (QR SVG `react-qr-code`); formatos **100×150** (etiquetadora) y **hoja A4** (recortable + normas + recepción); tabla **`hsm.assets`** + `/equipos`; acceso desde ficha y tabla de RMA. Pendiente menor: A4 también para equipos. |
| ⑪ | **Seguimiento diario ("Ronda")** en Mi día | **COMPLETADO** — Mi día a 2 columnas (Ronda principal + recordatorios lateral); vistas **Tarjetas** (gamify) y **Tabla** sobre incidencias mías + RMA activos (viejas→nuevas); marca "revisada hoy" (localStorage, `use-daily-review`), "Contacté" auditable (`event_logs`/`logContact`), hint de Intercom orientativo (`use-client-reply-status`, NO autoritativo), "Siguiente paso" (recordatorio). Fix: clic en recordatorio abre su ficha. Tabla de incidencias con orden "+ antiguas" + columna Seguimiento. |

---

## 6. Reglas y gotchas NO negociables

> 🔒 **Lee esta caja antes de tocar nada de Intercom, BD o el sistema de UI.**

- **INTERCOM INTOCABLE.** No tocar `src/lib/intercom/*`, las server actions `notes.ts` ni `intercom-inbox.ts`, ni el webhook `src/app/api/webhooks/intercom/route.ts`. **Gate de 6 puntos** antes de cualquier commit que toque la bandeja o las transiciones: (1) `/intercom` carga y sus 3 pestañas funcionan · (2) abrir conversación carga el hilo · (3) importar por URL entra en bandeja · (4) convertir crea incidencia y queda "convertida" · (5) nota manual aparece e Intercom la recibe · (6) transición de estado postea la nota con el label nuevo.
- **Modo claro forzado.** No introducir dark mode; las pantallas proto no lo soportan.
- **Migraciones ADITIVAS, aplicadas A MANO por el propietario** en el **SQL Editor de Supabase como rol `postgres`** (el rol `hsm_app` no tiene DDL). Carpeta `sql/` (**20** ficheros numerados `001`-`020`, más auxiliares). Reglas: `ALTER TYPE ... ADD VALUE` / `RENAME VALUE` van en **sentencia separada** de su uso (no en la misma transacción; el editor no soporta BEGIN/COMMIT explícito). **Backup/export de `incidents` + `event_logs` antes de cualquier migración de enum.** Nunca DROP destructivo.
- **Pooler `prepare: false`**; rol `hsm_app` sin DDL.
- **Proto vivo vs shadcn legacy** (ver §4): verifica el `page.tsx` antes de editar un componente.
- **IGNORAR directorios de referencia del prototipo**: `prototipo-referencia/`, `Codigo-rediseño/`, `docs/design/qamarero-handoff/`. Son fuentes visuales, no código de la app.
- **UTF-8 / español** en todos los textos de UI.
- **Para `dev` antes de `build`** (Turbopack corrompe `.next` → 500 RSC; borrar `.next`).
- **MCP Supabase conectado READ-WRITE** (proyecto ref `thkrkubkiasfqmiiwfbj`, esquema `hsm`). Permite `execute_sql`/`apply_migration` directos → **mostrar siempre el SQL antes de aplicar** y **nunca** DELETE/DROP/TRUNCATE sin confirmación. `.mcp.json` es local y gitignored (lleva el PAT) → recrearlo al teletrabajar; los cambios solo surten efecto al **reiniciar** Claude Code.

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

## Sesión 2026-06-26 (resumen para retomar en teletrabajo)

> Todo lo de abajo está **commiteado y desplegado en `main`** (commits `94a18ff`, `37f00ff`, `297187a`). La migración `sql/019` está **aplicada** en Supabase. Build + lint en verde en cada commit.

**MCP de Supabase** en `.mcp.json` (ref `thkrkubkiasfqmiiwfbj`, features `database,docs,debugging`). Ahora en **lectura-escritura** (se quitó `--read-only`) → el asistente puede aplicar migraciones/SQL directamente, mostrándolas antes y sin SQL destructivo sin confirmación. ⚠️ **`.mcp.json` es local y gitignored** (contiene el PAT de Supabase): al teletrabajar desde otro equipo hay que **recrearlo** (copiar el bloque `supabase` con un PAT). Cambios en `.mcp.json` solo surten efecto al **reiniciar** Claude Code.

**① Estados NO lineales** (Kanban + ficha incidencia + ficha RMA): `transitionIncident`/`transitionRma` aceptan un flag `force` que omite el grafo pero conserva pausa de SLA, auto-cierre de la incidencia al cerrar el RMA y outcome obligatorio. Los selectores "Cambiar estado…" listan todos los estados y el Kanban deja soltar en cualquier columna. Arreglado de paso el error del Kanban (`esperando_pieza` faltaba en el validador). Sin migración. → memoria `estados-no-lineales`.

**② Enlace Incidencia → RMA visible**: `getIncidents` trae `rmaCount` + último RMA; **badge clicable "RMA-…"** en la lista; sección **"RMAs vinculados"** + botón **"Ver RMA-…"** en el drawer de la incidencia (vía `useDrawers().openRma`).

**③ Conversación de Intercom en POPUP** (no desplegable): `ConversationThread` (acordeón que crecía sin fin) → botón **"Ver conversación"** que abre `ConversationPopup` (portado a `document.body`, z-index por encima del drawer). En la ficha de RMA se retiró la pestaña "Conversación".

**④ Prioridad BINARIA**: 4 niveles → 2 — **"Cliente puede operar"** (`media`) y **"Cliente no puede operar"** (`critica`). Selectores/filtros/badge binarios; los datos antiguos se mapean con `priorityBucket()`. La migración `sql/019` colapsó los datos (baja→media, alta→critica). Los RMA no tienen prioridad. → memoria `prioridad-binaria`.

**⑤ Formulario público `/submit`**: email permitido solo `@qamarero.com` (quitado `qami.es`); URL de Intercom **opcional**; botón **"Enviar formulario"**.

**Para retomar (pendiente):**
- Si trabajas desde otro equipo: recrear `.mcp.json` (token Supabase) y `.env.local`.
- Validar en runtime tras el deploy (estados libres, popup, prioridad binaria, formulario) + repaso rápido de Intercom (convertir desde la bandeja).
- **Rotar el PAT de Supabase** (se pegó en el chat al conectar el MCP).
- Opcional: guard de duplicados en `createRma`; simplificar los ajustes de SLA al modelo binario (hoy `/settings` aún muestra 4 prioridades).
- Del plan ④ (pendientes mayores): A6.2 filtro fino del webhook, A7 email/Resend + Vercel Cron, A8 métricas big-data por `articleId`.

---

## Sesión 2026-06-30 (PROYECTO ⑩ — etiquetas físicas con QR)

> Todo **commiteado y desplegado en `main`** (commits `de0ca81`, `b5793bd`, `dc1f98c`, `104d4ee`, `67026ea`, `98f80fc`, `e8bb33e`). Migración `sql/020` **aplicada** en Supabase. Build + lint en verde por commit. Dependencia nueva: **`react-qr-code`**.

**Idea:** identificar físicamente cada equipo con una etiqueta **QR + datos**. El QR apunta a una ruta protegida; con sesión iniciada en el dispositivo (JWT persistente) se abre directo al escanear, sin pedir login.

**Fase 1 — Etiqueta de RMA (`b5793bd`):**
- Ruta limpia `src/app/etiqueta/[tipo]/[id]/page.tsx` (server, `auth()`, `tipo` = `rma`|`equipo`, formato `?f=etiqueta|envio`). Auth: `/etiqueta` y `/equipos` añadidos a `isOnDashboard` en `src/lib/auth/config.ts`.
- `src/components/etiquetas/label-print-client.tsx`: **dos formatos** — `Label100x150` (`@page 100mm 150mm`, etiquetadora) y `ShippingSheet` (A4 para cliente/fabricante: cabecera, datos, **zona recortable** ✂ con QR, **normas** + **recepción**). QR = `window.location.origin + recordPath`. Botón "Etiqueta" en el drawer de RMA.

**Fase 2 — Equipos sin RMA (`dc1f98c`):**
- Tabla **`hsm.assets`** (`sql/020`): `asset_code` `EQ-YYYY-NNNNN` (`generateSequentialId("EQ")`), datos de equipo, `client_name`, `status`/`location`, FK opcionales a article/rma/incident. Schema/validator/queries/actions nuevos (`fetchAssets` tolera tabla ausente → `[]`).
- Página `/equipos` (`equipos-v2`) + ficha `/equipos/[id]` (objetivo del QR de equipo). Sidebar: "Equipos" (icono `Tag`) en Catálogo.

**Oficialización A4 (`104d4ee`, `67026ea`):**
- Logo: `BrandMark` local (viewBox `0 0 48 48`) porque el `QamareroLogo` compartido (42×48) recortaba el círculo naranja.
- Recepción real: **P.º Alcalde Marqués del Contadero, s/n, Casco Antiguo, 41001 Sevilla** · 9:00–18:00 · tel. **602 687 553** · hardware@qamarero.com.
- 6 normas + **aviso en negrita** ("Todo envío que no cumpla estas condiciones será rechazado y devuelto"). Recortable agrandado (QR 40 mm).

**Acceso + consistencia (`98f80fc`, `e8bb33e`):**
- Tabla de RMA: columna "Etiqueta" con icono 🖨 por fila → `/etiqueta/rma/{id}` en pestaña nueva (`stopPropagation`).
- Ficha de RMA: botón "Etiqueta" **siempre naranja** (se quitó la condición por `WAREHOUSE_RMA_STATUSES`), movido al inicio de la fila; "Editar datos" debajo a la izquierda.

**Texto libre de cliente (`de0ca81`):** `Combobox` de cliente (crear/editar incidencia) con `allowFreeText` → permite usar un cliente no registrado escribiéndolo (`clientName`).

**Para retomar (pendiente):**
- A4 también para equipos (hoy A4 solo RMA; 100×150 para ambos).
- Revisar la redacción final de las normas con uso real.
- Sigue pendiente: **rotar el PAT de Supabase** (se expuso en chat); simplificar `/settings` al modelo binario de prioridad; guard de duplicados en `createRma`.
- ⚠️ **Trampa de ruta**: el `cwd` es el worktree pero el repo raíz tiene su propia copia de cada archivo. Editar SIEMPRE por la ruta del worktree (`…/.claude/worktrees/<nombre>/src/…`); si no, el commit sale vacío y el build compila código viejo.
