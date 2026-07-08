-- 022 — Ronda diaria compartida: marca "revisada hoy" por equipo.
--
-- Reemplaza el localStorage por una tabla en BD para que la marca sea
-- COMPARTIDA: si un técnico marca una incidencia/RMA como revisada hoy,
-- desaparece de la ronda de sus compañeros. Una fila por (entidad, día);
-- "revisada hoy" = existe fila con review_date = hoy. Desmarcar = borrar.
--
-- Aditivo y no destructivo. Aplicado 2026-07-08 vía MCP (rol con DDL).

create table if not exists hsm.daily_reviews (
  id uuid primary key default gen_random_uuid(),
  entity_type hsm.entity_type not null,
  entity_id uuid not null,
  review_date date not null,
  reviewed_by_user_id uuid references hsm.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint daily_reviews_unique unique (entity_type, entity_id, review_date)
);

create index if not exists daily_reviews_date_idx on hsm.daily_reviews (review_date);

grant select, insert, update, delete on hsm.daily_reviews to hsm_app;
