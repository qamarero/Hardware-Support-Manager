-- 008: Create support_submissions table for public form submissions from CX team
-- Follows the same pattern as intercom_inbox (review queue)

-- Create enums
CREATE TYPE hsm.support_submission_status AS ENUM ('pendiente', 'convertida', 'descartada');
CREATE TYPE hsm.support_submission_priority AS ENUM ('baja', 'media', 'alta', 'critica');

-- Create table
CREATE TABLE hsm.support_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status hsm.support_submission_status NOT NULL DEFAULT 'pendiente',

  -- Submitter info
  submitter_name VARCHAR(255) NOT NULL,
  submitter_email VARCHAR(500) NOT NULL,

  -- Client info
  client_name VARCHAR(500) NOT NULL,
  client_id UUID REFERENCES hsm.clients(id) ON DELETE SET NULL,

  -- Incident data
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  priority hsm.support_submission_priority NOT NULL DEFAULT 'media',

  -- Device info (optional)
  device_type VARCHAR(100),
  device_brand VARCHAR(255),
  device_model VARCHAR(255),
  device_serial_number VARCHAR(255),

  -- Contact info
  contact_phone VARCHAR(50),
  intercom_url VARCHAR(1000),

  -- Review metadata
  converted_incident_id UUID REFERENCES hsm.incidents(id) ON DELETE SET NULL,
  converted_by_user_id UUID REFERENCES hsm.users(id) ON DELETE SET NULL,
  converted_at TIMESTAMP WITH TIME ZONE,
  dismissed_by_user_id UUID REFERENCES hsm.users(id) ON DELETE SET NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  dismiss_reason TEXT,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast filtering by status + sorting by date
CREATE INDEX support_submissions_status_created_idx
  ON hsm.support_submissions(status, created_at DESC);

-- Grant permissions to hsm_app role
GRANT SELECT, INSERT, UPDATE, DELETE ON hsm.support_submissions TO hsm_app;
