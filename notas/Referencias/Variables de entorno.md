---
tags: [referencia, entorno, seguridad]
aliases: []
updated: 2026-07-10
---

# Variables de entorno

HSM necesita **9 variables** para arrancar. En local viven en `.env.local` (copia de `.env.example`, ya en `.gitignore`); en producción están en el **dashboard de Vercel**. Nunca se hardcodean secretos: en código se accede siempre con `process.env.NOMBRE`. Contexto general en [[Arquitectura]] y el flujo de despliegue en [[Deploy]].

> Copia rápida para empezar en otra máquina: `cp .env.example .env.local` y rellena los 9 valores.

## Regla de oro en producción (Vercel)

- Las variables se editan en el **dashboard de Vercel**, no en el código.
- **Tras cambiar una variable hay que hacer Redeploy manual**: el build congela el valor anterior, así que un cambio no surte efecto hasta relanzar el despliegue. Ver [[Deploy]].
- **Nunca** commitees secretos. `.env.local` está gitignored. `.mcp.json` (que lleva el PAT de Supabase) también es local y gitignored: hay que recrearlo al teletrabajar.

## Base de datos y auth

### `DATABASE_URL`
- Cadena del **pooler de Supabase en transaction mode (puerto 6543)**. Ver [[Supabase]].
- Rol dedicado **`hsm_app`**: solo DML (SELECT/INSERT/UPDATE/DELETE), **sin DDL**; esquema `hsm`.
- El cliente postgres-js usa **`prepare: false`** (obligatorio con el pooler). Sin él, fallan las conexiones.
- Formato: `postgresql://hsm_app.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`.

### `NEXTAUTH_SECRET`
- Secreto de NextAuth v5. Se genera con `openssl rand -base64 32`.

### `NEXTAUTH_URL`
- URL de la app. Prod: `https://hardware-support-manager.vercel.app` (también sirve el formulario público `/submit`). Dev: `http://localhost:3000`.

## Adjuntos

### `BLOB_READ_WRITE_TOKEN`
- Token del store **Vercel Blob** (`hardware-support-manager-blob`).
- **Gotcha: sin él los adjuntos fallan en silencio** (sin error visible). Si al subir un archivo no pasa nada, revisa esta variable primero.

## Intercom

Detalle de la integración en [[Intercom]] y su uso operativo en [[Escalaciones Intercom]].

### `INTERCOM_ACCESS_TOKEN`
- API key de Intercom para las llamadas a la API v2.11.

### `INTERCOM_WEBHOOK_SECRET`
- Secreto para la verificación **HMAC** del webhook entrante.
- Gotcha: las apps privadas pueden no firmar la petición → hay un fallback a validación de estructura.

### `INTERCOM_ADMIN_ID`
- `8601230` (Domi). Admin que **firma las notas automáticas** que HSM postea en Intercom.
- **Gotcha: sin él las notas fallan en silencio** (el default `"0"` las rechaza). Para obtener el ID: `curl -s https://api.intercom.io/admins -H "Authorization: Bearer $INTERCOM_ACCESS_TOKEN" -H "Intercom-Version: 2.11"`.

## API externa (integraciones)

Ambos son **shared secrets** que el consumidor envía en la cabecera **`X-API-Key`**. Los endpoints viven en `src/app/api/external/*`.

### `MAIN_PORTAL_API_KEY`
- Shared secret para `GET /api/external/metrics`, consumido por el **HW Main Portal**.
- Se genera con `openssl rand -base64 32`.

### `HSM_PUBLIC_API_KEY`
- Shared secret para `/api/external/incidents` (datos detallados de incidencias + **PII**).
- **Gotcha: sin él el endpoint responde 503.**

## Tabla resumen

| Variable | Ámbito | Gotcha principal |
|---|---|---|
| `DATABASE_URL` | BD | pooler 6543, rol `hsm_app` sin DDL, `prepare: false` |
| `NEXTAUTH_SECRET` | Auth | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Auth | prod = dominio Vercel; dev = `localhost:3000` |
| `BLOB_READ_WRITE_TOKEN` | Adjuntos | sin él, adjuntos fallan **en silencio** |
| `INTERCOM_ACCESS_TOKEN` | Intercom | API v2.11 |
| `INTERCOM_WEBHOOK_SECRET` | Intercom | HMAC; fallback a validación de estructura |
| `INTERCOM_ADMIN_ID` | Intercom | `8601230`; sin él las notas fallan en silencio |
| `MAIN_PORTAL_API_KEY` | API externa | `X-API-Key` para `/api/external/metrics` |
| `HSM_PUBLIC_API_KEY` | API externa | `X-API-Key`; sin él `/api/external/incidents` da 503 |

## Diagnóstico rápido

- **No conecta a la BD** → revisa `DATABASE_URL` (pooler + `prepare: false`, rol `hsm_app`). Ver [[Supabase]].
- **Los adjuntos no suben** → falta `BLOB_READ_WRITE_TOKEN`.
- **Las notas no llegan a Intercom** → falta `INTERCOM_ADMIN_ID` (o es `"0"`). Ver [[Intercom]].
- **`/api/external/incidents` devuelve 503** → falta `HSM_PUBLIC_API_KEY`.
- **El cambio de una variable no hace efecto en prod** → falta el **Redeploy manual** en Vercel. Ver [[Deploy]].

## Relacionado

- [[Deploy]]
- [[Supabase]]
- [[Intercom]]
- [[Escalaciones Intercom]]
- [[Arquitectura]]
- [[ONBOARDING]]
- [[Inicio]]
