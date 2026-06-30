-- 020 — Registro de equipos físicos (assets)
--
-- Unidades físicas en oficina, con o sin RMA (incluidos equipos previos a la
-- herramienta). Sirve para etiquetar (QR) e identificar el equipo físico.
-- Aditivo. Ejecutar como rol postgres en el SQL Editor de Supabase.

CREATE TABLE IF NOT EXISTS hsm.assets (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code           varchar(20) NOT NULL UNIQUE,          -- EQ-YYYY-NNNNN
  device_type          varchar(100),
  device_brand         varchar(255),
  device_model         varchar(255),
  device_serial_number varchar(255),
  client_name          varchar(500),
  status               varchar(40) NOT NULL DEFAULT 'en_oficina',
  location             varchar(255),
  notes                text,
  article_id           uuid REFERENCES hsm.articles(id),
  rma_id               uuid REFERENCES hsm.rmas(id),
  incident_id          uuid REFERENCES hsm.incidents(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assets_status_idx ON hsm.assets(status);
CREATE INDEX IF NOT EXISTS assets_serial_idx ON hsm.assets(device_serial_number);
