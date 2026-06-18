-- A2 — Recordatorios / agenda
-- Tabla nueva en el schema hsm. Aditiva, idempotente.
-- Ejecutar en el SQL editor de Supabase.

DO $$ BEGIN
  CREATE TYPE hsm.reminder_status AS ENUM ('pendiente', 'hecho', 'descartado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE hsm.reminder_entity_type AS ENUM ('incident', 'rma');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS hsm.reminders (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES hsm.users(id) ON DELETE CASCADE,
  created_by_user_id uuid REFERENCES hsm.users(id) ON DELETE SET NULL,
  entity_type        hsm.reminder_entity_type,
  entity_id          uuid,
  title              varchar(500) NOT NULL,
  note               text,
  due_at             timestamptz NOT NULL,
  status             hsm.reminder_status NOT NULL DEFAULT 'pendiente',
  completed_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reminders_user_status_due_idx ON hsm.reminders (user_id, status, due_at);
CREATE INDEX IF NOT EXISTS reminders_entity_idx ON hsm.reminders (entity_type, entity_id);
