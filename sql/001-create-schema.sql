-- ============================================================================
-- Hardware Support Manager (HSM) - Complete DDL Script
-- Target: Supabase PostgreSQL (schema: hsm)
-- Generated: 2026-03-28
--
-- Prerequisites:
--   - Schema "hsm" already exists
--   - Role "hsm_app" already exists with USAGE on schema hsm
-- ============================================================================

-- ============================================================================
-- 1. ENUM TYPES
-- ============================================================================

CREATE TYPE hsm.user_role AS ENUM ('admin', 'technician', 'viewer');

CREATE TYPE hsm.incident_status AS ENUM (
  'nuevo', 'en_triaje', 'en_diagnostico', 'esperando_repuesto',
  'en_reparacion', 'esperando_cliente', 'resuelto', 'cerrado', 'cancelado'
);

CREATE TYPE hsm.incident_priority AS ENUM ('baja', 'media', 'alta', 'critica');

CREATE TYPE hsm.incident_category AS ENUM (
  'hardware', 'periferico', 'red', 'almacenamiento', 'impresora', 'monitor', 'otro'
);

CREATE TYPE hsm.rma_status AS ENUM (
  'borrador', 'solicitado', 'aprobado_proveedor', 'enviado_proveedor',
  'recibido_proveedor', 'en_reparacion_proveedor', 'devuelto',
  'recibido_almacen', 'cerrado', 'cancelado'
);

CREATE TYPE hsm.entity_type AS ENUM ('incident', 'rma', 'event_log');

-- ============================================================================
-- 2. INDEPENDENT TABLES (no foreign keys to other hsm tables)
-- ============================================================================

-- Users
CREATE TABLE hsm.users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role        hsm.user_role NOT NULL DEFAULT 'technician',
  avatar_url  VARCHAR(500),
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

-- Providers
CREATE TABLE hsm.providers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255),
  website     VARCHAR(500),
  rma_url     VARCHAR(500),
  contacts    JSONB       DEFAULT '[]'::jsonb,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

-- Sequences (for INC-YYYY-NNNNN / RMA-YYYY-NNNNN generation)
CREATE TABLE hsm.sequences (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  prefix      VARCHAR(10) NOT NULL,
  year        INTEGER     NOT NULL,
  last_value  INTEGER     NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX sequences_prefix_year_idx ON hsm.sequences (prefix, year);

-- App Settings
CREATE TABLE hsm.app_settings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         VARCHAR(255) NOT NULL UNIQUE,
  value       JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. DEPENDENT TABLES (have foreign keys)
-- ============================================================================

-- Incidents (depends on: users)
CREATE TABLE hsm.incidents (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_number       VARCHAR(20) NOT NULL UNIQUE,
  client_name           VARCHAR(500),
  assigned_user_id      UUID        REFERENCES hsm.users(id) ON DELETE SET NULL,
  category              hsm.incident_category NOT NULL,
  priority              hsm.incident_priority NOT NULL DEFAULT 'media',
  status                hsm.incident_status   NOT NULL DEFAULT 'nuevo',
  title                 VARCHAR(500) NOT NULL,
  description           TEXT,
  device_type           VARCHAR(100),
  device_brand          VARCHAR(255),
  device_model          VARCHAR(255),
  device_serial_number  VARCHAR(255),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at           TIMESTAMPTZ,
  state_changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RMAs (depends on: incidents, providers)
CREATE TABLE hsm.rmas (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rma_number                VARCHAR(20) NOT NULL UNIQUE,
  incident_id               UUID        REFERENCES hsm.incidents(id) ON DELETE RESTRICT,
  provider_id               UUID        NOT NULL REFERENCES hsm.providers(id) ON DELETE RESTRICT,
  client_name               VARCHAR(500),
  client_external_id        VARCHAR(255),
  client_intercom_url       VARCHAR(1000),
  status                    hsm.rma_status NOT NULL DEFAULT 'borrador',
  device_type               VARCHAR(100),
  device_brand              VARCHAR(255),
  device_model              VARCHAR(255),
  device_serial_number      VARCHAR(255),
  tracking_number_outgoing  VARCHAR(255),
  tracking_number_return    VARCHAR(255),
  provider_rma_number       VARCHAR(255),
  client_local              VARCHAR(255),
  address                   TEXT,
  postal_code               VARCHAR(20),
  phone                     VARCHAR(50),
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  state_changed_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event Logs (depends on: users)
CREATE TABLE hsm.event_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type hsm.entity_type NOT NULL,
  entity_id   UUID        NOT NULL,
  action      VARCHAR(255) NOT NULL,
  from_state  VARCHAR(100),
  to_state    VARCHAR(100),
  user_id     UUID        REFERENCES hsm.users(id) ON DELETE SET NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Attachments (depends on: users)
CREATE TABLE hsm.attachments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type hsm.entity_type NOT NULL,
  entity_id   UUID        NOT NULL,
  file_name   VARCHAR(500) NOT NULL,
  file_url    VARCHAR(1000) NOT NULL,
  file_size   INTEGER     NOT NULL,
  file_type   VARCHAR(255) NOT NULL,
  uploaded_by UUID        REFERENCES hsm.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. TRIGGER: auto-update updated_at columns
-- ============================================================================

CREATE OR REPLACE FUNCTION hsm.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON hsm.users
  FOR EACH ROW EXECUTE FUNCTION hsm.update_updated_at();

CREATE TRIGGER trg_providers_updated_at
  BEFORE UPDATE ON hsm.providers
  FOR EACH ROW EXECUTE FUNCTION hsm.update_updated_at();

CREATE TRIGGER trg_incidents_updated_at
  BEFORE UPDATE ON hsm.incidents
  FOR EACH ROW EXECUTE FUNCTION hsm.update_updated_at();

CREATE TRIGGER trg_rmas_updated_at
  BEFORE UPDATE ON hsm.rmas
  FOR EACH ROW EXECUTE FUNCTION hsm.update_updated_at();

CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON hsm.app_settings
  FOR EACH ROW EXECUTE FUNCTION hsm.update_updated_at();

-- ============================================================================
-- 5. GRANTS
-- ============================================================================

GRANT ALL ON ALL TABLES IN SCHEMA hsm TO hsm_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA hsm TO hsm_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA hsm TO hsm_app;

-- ============================================================================
-- 6. SEED DATA
-- ============================================================================

-- Admin users (password: admin123, bcrypt hash)
INSERT INTO hsm.users (name, email, password_hash, role) VALUES
  ('Administrador', 'admin@hardware-support.local', '$2b$10$yxjsfQYhdmI3nVPAOzXPEebC5/htWbI8gJSjcVvTxGkR6GrgEg1v6', 'admin'),
  ('Domingo Bueno', 'domingo.bueno@qamarero.com', '$2b$10$yxjsfQYhdmI3nVPAOzXPEebC5/htWbI8gJSjcVvTxGkR6GrgEg1v6', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Providers
INSERT INTO hsm.providers (name, email, contacts) VALUES
  ('GEON', 'sat@g-on.es', '[]'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO hsm.providers (name, email, rma_url, contacts) VALUES
  ('JASSWAY', 'sat@jassway.es', 'soporte.jassway.net/tickets.php', '[]'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO hsm.providers (name, email, rma_url, contacts) VALUES
  ('PC Mira', 'sat@pcmira.com', 'pcmira.com/soporte/', '[]'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO hsm.providers (name, rma_url, contacts) VALUES
  ('Posiflex', 'posiflex.es/sat?ini=rma', '[]'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO hsm.providers (name, contacts) VALUES
  ('Pedro Porto', '[{"name": "Soporte Tecnico ES", "email": "tecnica.es@pedroporto.pt", "role": "SAT"}, {"name": "Jose Romero", "email": "jose.romero@pedroporto.pt", "role": "Comercial"}]'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO hsm.providers (name, contacts) VALUES
  ('AQPROX', '[{"name": "Ana Zaragoza", "email": "anazaragoza@mylar.es", "role": "Comercial"}, {"name": "Fran y Sergio", "email": "rma@mylar.es", "phone": "954186767", "role": "Tecnico"}]'::jsonb)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Done. All objects created in hsm schema with grants to hsm_app.
-- ============================================================================
