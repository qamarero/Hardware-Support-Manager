-- 024 — Reporte semanal de métricas de RMA (PROYECTO ⑫)
-- Anotaciones editables (semáforo, responsable, comentario) por métrica y
-- semana, compartidas con el equipo. Los valores numéricos NO se guardan aquí.
-- Ejecutar como `postgres` en el SQL Editor de Supabase (hsm_app no tiene DDL).

CREATE TABLE IF NOT EXISTS hsm.rma_metric_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key    varchar(64) NOT NULL,
  week_start    date NOT NULL,
  status        varchar(12),                       -- 'verde' | 'ambar' | 'rojo' | null
  owner_user_id uuid REFERENCES hsm.users(id) ON DELETE SET NULL,
  comment       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rma_metric_reviews_unique UNIQUE (metric_key, week_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON hsm.rma_metric_reviews TO hsm_app;
