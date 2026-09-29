-- ============================================================================
-- 029: sincronizacion de clientes desde CX Advisor.
--
-- Ejecutar como `postgres` en el SQL Editor de Supabase: el rol hsm_app no
-- tiene DDL. Sin BEGIN/COMMIT, que el editor de Supabase no los soporta.
-- Idempotente: se puede volver a pegar sin efecto.
--
-- POR QUE
-- hsm.clients se lleno a mano (sql/006-seed-from-document.sql, 44 clientes
-- sacados del documento de actividad). Cualquier restaurante que no estuviera
-- en aquel documento no aparece en el buscador de /submit, asi que soporte
-- tiene que escribirlo como texto libre y la incidencia nace sin cliente
-- enlazado. Ejemplo real: "CX - Green Planet" (Teruel), que existe en CX
-- Advisor desde agosto y en HSM no.
--
-- A partir de aqui los clientes se traen de core.locations de CX Advisor
-- (proyecto olcxbtvjkjmofrbvzpat) y se mantienen al dia solos.
-- ============================================================================

-- ---------------------------------------------------------------- columnas --
ALTER TABLE hsm.clients
  -- hubspot_deal_id de CX Advisor: es su clave primaria y la unica que existe
  -- SIEMPRE. restaurant_id_backend no vale como clave de sync porque es NULL
  -- en ~500 locations (sobre todo bajas antiguas).
  ADD COLUMN IF NOT EXISTS cx_deal_id     varchar(64),
  -- Etapa comercial tal cual viene de CX Advisor ("4. Restaurantes Activos",
  -- "0.b Lost Deal"...). Se guarda para poder avisar en el buscador de que un
  -- cliente esta de baja, no para filtrarlo: soporte necesita poder abrir
  -- incidencias de bajas que aun tienen hardware nuestro sin devolver.
  ADD COLUMN IF NOT EXISTS business_stage varchar(100),
  ADD COLUMN IF NOT EXISTS province       varchar(120),
  -- 'manual' = dado de alta desde HSM; 'cx_advisor' = espejado.
  -- El sync SOLO toca las filas 'cx_advisor', asi que lo que se escriba a mano
  -- aqui no lo pisa nadie.
  ADD COLUMN IF NOT EXISTS source         varchar(20) NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS synced_at      timestamptz;

-- ----------------------------------------------------------------- indices --
-- UNIQUE: es la clave del upsert del sync (ON CONFLICT (cx_deal_id)).
-- Parcial sobre NOT NULL para que los clientes manuales, que no tienen
-- cx_deal_id, no choquen entre si: en un indice unico normal Postgres admite
-- varios NULL, pero el parcial deja ademas el indice mas pequeno.
CREATE UNIQUE INDEX IF NOT EXISTS clients_cx_deal_id_idx
  ON hsm.clients (cx_deal_id) WHERE cx_deal_id IS NOT NULL;

-- Busqueda del combobox: ILIKE '%texto%' sobre el nombre. Necesita trigramas,
-- porque un indice B-tree no sirve para un patron que empieza por comodin.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS clients_name_trgm_idx
  ON hsm.clients USING gin (name gin_trgm_ops);

-- El buscador tambien acepta el restaurant_id, y el sync casa por el la
-- primera vez para no duplicar lo que ya estaba dado de alta a mano.
CREATE INDEX IF NOT EXISTS clients_external_id_lower_idx
  ON hsm.clients (lower(external_id));

-- ------------------------------------------------------------------ grants --
GRANT SELECT, INSERT, UPDATE, DELETE ON hsm.clients TO hsm_app;

-- ------------------------------------------------------------ comprobacion --
-- Antes del primer sync: todo 'manual' y cx_deal_id a NULL.
-- Despues: ~4.100 filas 'cx_advisor'.
SELECT source, count(*) AS n, count(cx_deal_id) AS con_cx_deal_id
  FROM hsm.clients
 GROUP BY source
 ORDER BY source;
