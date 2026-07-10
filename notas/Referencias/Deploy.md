---
tags: [referencia, deploy, vercel]
aliases: []
updated: 2026-07-10
---

# Deploy

Cómo se pone HSM en producción. Plataforma **Vercel**, base de datos **Supabase PostgreSQL** (por pooler, esquema `hsm`) y ficheros en **Vercel Blob**.

> **El despliegue es MANUAL.** El auto-deploy en push a `main` está **desactivado**: tras hacer push, hay que **lanzar el deploy a mano** desde Vercel. (Históricamente push-a-main disparaba deploy automático, pero ya no.)

## Antes de desplegar: verificación local

Se trabaja siempre en la raíz del repo sobre `main`, sin worktrees (ver [[Operativa]]). Antes de subir nada:

```bash
npm run build && npm run lint
```

- `npm run build` valida tipos y hace el build de producción (Turbopack).
- `npm run lint` corre ESLint.
- Añade `npm test` (Vitest) si el cambio toca máquinas de estado, validadores o utils.

> ⚠️ **Para el `dev` server antes de `build`.** Lanzar `npm run build` con el dev (Turbopack) corriendo corrompe `.next` → errores 500 en peticiones RSC. Solución: parar `dev`, borrar `.next`, reiniciar.

## Flujo de despliegue

1. **Sincronizar** la raíz con `origin/main` (ver [[Operativa]]).
2. **Editar** (verifica el wiring proto vs shadcn legacy antes de tocar un componente — ver [[Arquitectura]]).
3. **Verificar**: `npm run build && npm run lint` (+ `npm test` si aplica).
4. **Gate Intercom** si el cambio toca la bandeja o las transiciones (ver más abajo).
5. **Commit** con formato emoji del repo (`✨ feat:`, `🐛 fix:`, `📝 docs:`) y trailer:
   ```
   Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
   ```
6. **Push** a `main`.
7. **Deploy manual** en Vercel.
8. **Migración SQL** si la hay: se aplica **a mano** en el SQL Editor de Supabase como rol `postgres` (ver [[Supabase]]).

## Gate Intercom (obligatorio si tocas bandeja o transiciones)

La integración de Intercom es **intocable**. Si el cambio afecta a `/intercom` o a las transiciones de estado, comprueba los **6 puntos** antes de commitear (detalle en [[Escalaciones Intercom]] y [[Intercom]]):

1. `/intercom` carga y sus 3 pestañas funcionan.
2. Abrir una conversación carga el hilo.
3. Importar por URL entra en la bandeja.
4. Convertir crea la incidencia y queda "convertida".
5. Una nota manual aparece e Intercom la recibe.
6. Una transición de estado postea la nota con el label nuevo.

## Variables de entorno

En local viven en `.env.local`; en producción están en el **dashboard de Vercel**. **Tras cambiar una variable en Vercel hay que hacer Redeploy manual** (el build congela el valor anterior). Detalle completo en [[Variables de entorno]].

Gotchas de deploy relevantes:

- **`DATABASE_URL`**: pooler de Supabase en transaction mode (puerto 6543), rol `hsm_app` (solo DML, sin DDL), esquema `hsm`. El cliente postgres-js usa `prepare: false` (obligatorio con el pooler).
- **`BLOB_READ_WRITE_TOKEN`**: token del store Vercel Blob (`hardware-support-manager-blob`). **Sin él los adjuntos fallan en silencio.**
- **`NEXTAUTH_URL`** en prod: `https://hardware-support-manager.vercel.app` (también sirve el formulario público `/submit`).
- **`INTERCOM_ADMIN_ID`** = `8601230`. Sin él las notas automáticas a Intercom fallan en silencio.

## Migraciones de base de datos

Las migraciones son **aditivas** y se aplican **a mano** por el propietario en el SQL Editor de Supabase como rol `postgres` (el rol `hsm_app` no tiene DDL). Reglas clave:

- `ALTER TYPE ... ADD VALUE` / `RENAME VALUE` van en **sentencia separada** de su uso (el editor no soporta `BEGIN`/`COMMIT` explícito).
- **Backup/export de `incidents` + `event_logs`** antes de cualquier migración de enum.
- **Nunca** DROP destructivo.

Carpeta `sql/` con los ficheros numerados. Más en [[Supabase]].

## Notas y pendientes

- **No existe `vercel.json`** en la raíz del repo todavía. Hará falta crearlo para el **Vercel Cron** del email digest (`RESEND_API_KEY` + `CRON_SECRET` + entrada de cron → `GET /api/cron/daily-digest`).
- Webhook de Intercom en producción: `POST /api/webhooks/intercom` (app "Hw sync HSM", workspace `hckfnffg`).

## Relacionado

- [[Operativa]]
- [[Variables de entorno]]
- [[Supabase]]
- [[Intercom]]
- [[Escalaciones Intercom]]
- [[Arquitectura]]
- [[ONBOARDING]]
- [[CLAUDE]]
- [[proyecto_log]]
- [[Inicio]]
