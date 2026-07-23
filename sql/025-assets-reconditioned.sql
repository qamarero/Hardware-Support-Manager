-- 025 — Equipos: flag "reacondicionado" (revisado y listo para reutilizar con clientes)
-- Ejecutar como `postgres` en el SQL Editor de Supabase (hsm_app no tiene DDL).
-- Los GRANT de tabla ya cubren la columna nueva; no hace falta re-conceder.

ALTER TABLE hsm.assets
  ADD COLUMN IF NOT EXISTS reconditioned boolean NOT NULL DEFAULT false;
