---
tags: [referencia, bd, supabase]
aliases: []
updated: 2026-07-10
---

# Supabase

Base de datos de HSM: **PostgreSQL en Supabase**, esquema `hsm`. Todo pasa por el **pooler** (Supavisor). El cliente Drizzle vive en `src/lib/db/index.ts` (driver postgres-js). Ver también [[Variables de entorno]] y [[Arquitectura]].

## Datos del proyecto

- **Ref del proyecto**: `thkrkubkiasfqmiiwfbj`
- **Esquema**: `hsm` (todas las tablas van ahí; un fichero por entidad en `src/lib/db/schema/`).
- **Conexión**: pooler de Supabase en **transaction mode, puerto `6543`** (cadena en `DATABASE_URL`).
- **Rol dedicado**: `hsm_app`.

## Conexión (postgres-js / Drizzle)

Todo se configura en `src/lib/db/index.ts`. Opciones clave del cliente `postgres()`:

- **`prepare: false` — OBLIGATORIO.** Sin esto el pooler (transaction mode) falla. No quitarlo.
- `max: 20` — 20 conexiones cliente. El SSR del dashboard lanza hasta 4 queries en paralelo y `/api/external/metrics` lanza 11; con un `max` bajo una sola request agotaba el pool. Supavisor multiplexa por detrás, así que subir aquí es seguro.
- `idle_timeout: 60` — libera conexiones ociosas a los 60 s.
- `connect_timeout: 10` — falla rápido si no conecta.
- `statement_timeout: 15000` — 15 s máximo por sentencia, evita queries colgadas.

El `db` se exporta como **singleton perezoso vía Proxy**: no se llama a `getDb()` (ni se necesita `DATABASE_URL`) hasta el primer acceso a una propiedad.

## Permisos: hsm_app solo hace DML

El rol `hsm_app` tiene **únicamente** `SELECT / INSERT / UPDATE / DELETE` sobre el esquema `hsm`. **No tiene DDL.**

- La app (runtime) usa `hsm_app` → nunca intentar `CREATE TABLE`, `ALTER TYPE`, `DROP COLUMN`, etc. con ella.
- Las **migraciones DDL se aplican A MANO como rol `postgres`** en el **SQL Editor de Supabase** (ver [[Deploy]] y el workflow de cambios en [[ONBOARDING]]).
- Carpeta `sql/`: migraciones **aditivas** numeradas (`001`…`020`). Reglas:
  - `ALTER TYPE ... ADD VALUE` / `RENAME VALUE` van en **sentencia separada** de su uso (el editor no soporta `BEGIN`/`COMMIT` explícito).
  - **Backup/export de `incidents` + `event_logs`** antes de cualquier migración de enum.
  - Nunca `DROP` destructivo.

> El MCP de Supabase está conectado en **lectura-escritura** (ref `thkrkubkiasfqmiiwfbj`). Permite `execute_sql`/`apply_migration` directos, pero **mostrar siempre el SQL antes de aplicar** y nunca `DELETE`/`DROP`/`TRUNCATE` sin confirmación.

## Gotchas del pooler

### `unaccent()` NO funciona → usar `translate()` + `ILIKE`
La extensión `unaccent()` **no es accesible por el pooler** (ni como `extensions.unaccent()`). Para búsqueda insensible a acentos/mayúsculas se emula con `lower(translate(...))` + `ILIKE`. Está en `src/lib/utils/sql-search.ts` (`accentInsensitiveLike`, `accentNormalizedConcat`), con un mapeo de acentos ES/CAT/PT built-in y sin extensiones.

### `pg_trgm` SÍ está disponible
`pg_trgm` está instalado y **sí es alcanzable por el pooler** (el `search_path` del rol `hsm_app` incluye `public`), a diferencia de `unaccent`. Se usa para búsqueda difusa tolerante a erratas vía `word_similarity(...)` (ver `fuzzyWordMatch` y `relevanceScore` en `src/lib/utils/sql-search.ts`; umbral por defecto `0.4`).

## Comandos Drizzle habituales

- `npm run db:push` — push del schema (solo dev).
- `npm run db:generate` — generar SQL de migración.
- `npm run db:migrate` — aplicar migraciones generadas (prod).
- `npm run db:studio` — Drizzle Studio (GUI de BD).

> En la práctica, en HSM las migraciones se aplican **a mano en el SQL Editor** (carpeta `sql/`) por lo del rol sin DDL; ver [[Deploy]].

## Relacionado

- [[Variables de entorno]] — `DATABASE_URL` y demás secretos
- [[Arquitectura]] — cómo encaja la BD con el resto del stack
- [[Deploy]] — aplicar migraciones y redeploy
- [[Dominio]] — entidades que viven en el esquema `hsm`
- [[Intercom]] — otra integración con secretos propios
- [[Operativa]] · [[Inicio]] · [[Cómo usar esta bóveda]]
- [[ONBOARDING]] · [[CLAUDE]]
