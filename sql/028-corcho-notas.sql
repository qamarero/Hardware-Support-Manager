-- 028 — Corcho: notas de equipo sobre la tabla de recordatorios
-- Ejecutar como `postgres` en el SQL Editor de Supabase (hsm_app no tiene DDL).
--
-- Una nota del corcho ES un recordatorio, con tres diferencias:
--   · puede no tener fecha (una nota suelta no vence),
--   · puede no tener dueño (nota para todo el equipo),
--   · tiene color de papel.
-- `kind` separa las dos caras: 'nota' se pinta en el corcho, 'seguimiento' es
-- la agenda de siempre (ronda diaria y fichas) y sigue en el lateral de Mi día.

ALTER TABLE hsm.reminders ALTER COLUMN due_at DROP NOT NULL;
ALTER TABLE hsm.reminders ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE hsm.reminders ADD COLUMN IF NOT EXISTS kind  varchar(20) NOT NULL DEFAULT 'seguimiento';
ALTER TABLE hsm.reminders ADD COLUMN IF NOT EXISTS color varchar(20) NOT NULL DEFAULT 'amarillo';

-- Todo lo que ya existía es agenda, no notas del corcho.
UPDATE hsm.reminders SET kind = 'seguimiento' WHERE kind <> 'seguimiento';

-- El corcho lista notas pendientes, las más nuevas primero.
CREATE INDEX IF NOT EXISTS reminders_kind_status_idx
  ON hsm.reminders (kind, status, created_at DESC);

-- "Visto" por persona: separa "me he enterado" de "está hecho". La nota sigue
-- en el tablero para los demás aunque yo la haya visto.
CREATE TABLE IF NOT EXISTS hsm.reminder_views (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id uuid NOT NULL REFERENCES hsm.reminders(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES hsm.users(id) ON DELETE CASCADE,
  seen_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reminder_views_unique UNIQUE (reminder_id, user_id)
);
CREATE INDEX IF NOT EXISTS reminder_views_user_idx ON hsm.reminder_views (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON hsm.reminder_views TO hsm_app;
