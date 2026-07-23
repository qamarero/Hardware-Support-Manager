-- 026 — Equipos: historial por unidad + situación real (PROYECTO equipos)
-- Ejecutar como `postgres` en el SQL Editor de Supabase (hsm_app no tiene DDL).

-- Historial (seguimiento individual) de cada equipo.
CREATE TABLE IF NOT EXISTS hsm.asset_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id     uuid NOT NULL REFERENCES hsm.assets(id) ON DELETE CASCADE,
  action       varchar(40) NOT NULL,              -- created | status_change | assigned | returned | note
  from_status  varchar(40),
  to_status    varchar(40),
  client_name  varchar(500),
  note         text,
  user_id      uuid REFERENCES hsm.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS asset_events_asset_idx ON hsm.asset_events (asset_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON hsm.asset_events TO hsm_app;

-- Situación real: los equipos actuales ("en_oficina") pasan a "disponible".
UPDATE hsm.assets SET status = 'disponible' WHERE status = 'en_oficina';
ALTER TABLE hsm.assets ALTER COLUMN status SET DEFAULT 'disponible';

-- Limpiar el uso del campo Cliente como etiqueta (RMA / REACONDICIONADO).
UPDATE hsm.assets SET client_name = NULL
 WHERE upper(trim(client_name)) IN ('RMA', 'REACONDICIONADO');
