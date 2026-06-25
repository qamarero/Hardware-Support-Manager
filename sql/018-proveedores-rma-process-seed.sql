-- ⑨ — Carga de procedimientos de RMA de los proveedores/fabricantes.
-- Datos facilitados por Domi. UPSERT seguro: actualiza el proveedor si ya
-- existe (match por nombre o email), lo crea si no. NO duplica.
-- Ejecutar en el SQL editor de Supabase. Revisa antes el SELECT de abajo.

-- (0) VERIFICACIÓN — ver qué proveedores hay ya (ejecuta esto primero):
--   SELECT id, name, email, rma_url FROM hsm.providers WHERE deleted_at IS NULL ORDER BY name;
-- Si algún nombre difiere mucho de los patrones de abajo, avísame y ajusto el WHERE.

-- 1) SAT GEON ---------------------------------------------------------------
WITH up AS (
  UPDATE hsm.providers SET
    email = COALESCE(NULLIF(email, ''), 'sat@g-on.es'),
    rma_process = '{"method":"email","emailTo":"sat@g-on.es","emailCc":"","requiresForm":false,"formType":"","formUrl":"","allowsDirectToClient":false,"steps":"1) Enviar email a sat@g-on.es solicitando el RMA. 2) Responden aprobando o rechazando. 3) Si aprueban, envían un PDF con el número identificativo del RMA."}'::jsonb,
    updated_at = now()
  WHERE deleted_at IS NULL AND (name ILIKE '%geon%' OR name ILIKE '%g-on%' OR email ILIKE '%g-on.es%')
  RETURNING id
)
INSERT INTO hsm.providers (name, email, rma_process)
SELECT 'SAT GEON', 'sat@g-on.es',
  '{"method":"email","emailTo":"sat@g-on.es","emailCc":"","requiresForm":false,"formType":"","formUrl":"","allowsDirectToClient":false,"steps":"1) Enviar email a sat@g-on.es solicitando el RMA. 2) Responden aprobando o rechazando. 3) Si aprueban, envían un PDF con el número identificativo del RMA."}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM up);

-- 2) JASSWAY ----------------------------------------------------------------
WITH up AS (
  UPDATE hsm.providers SET
    email = COALESCE(NULLIF(email, ''), 'sat@jassway.es'),
    rma_url = COALESCE(NULLIF(rma_url, ''), 'https://soporte.jassway.net/tickets.php'),
    rma_process = '{"method":"portal_y_email","emailTo":"sat@jassway.es","emailCc":"hardware@qamarero.com","requiresForm":true,"formType":"web","formUrl":"https://soporte.jassway.net/tickets.php","allowsDirectToClient":false,"steps":"1) Abrir ticket en el portal (soporte.jassway.net/tickets.php). 2) Avisar por email a sat@jassway.es (CC hardware@qamarero.com). 3) Responden con el nº de RMA y las instrucciones de envío."}'::jsonb,
    updated_at = now()
  WHERE deleted_at IS NULL AND (name ILIKE '%jassway%' OR email ILIKE '%jassway%')
  RETURNING id
)
INSERT INTO hsm.providers (name, email, rma_url, rma_process)
SELECT 'JASSWAY', 'sat@jassway.es', 'https://soporte.jassway.net/tickets.php',
  '{"method":"portal_y_email","emailTo":"sat@jassway.es","emailCc":"hardware@qamarero.com","requiresForm":true,"formType":"web","formUrl":"https://soporte.jassway.net/tickets.php","allowsDirectToClient":false,"steps":"1) Abrir ticket en el portal (soporte.jassway.net/tickets.php). 2) Avisar por email a sat@jassway.es (CC hardware@qamarero.com). 3) Responden con el nº de RMA y las instrucciones de envío."}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM up);

-- 3) PC MIRA ----------------------------------------------------------------
WITH up AS (
  UPDATE hsm.providers SET
    email = COALESCE(NULLIF(email, ''), 'sat@pcmira.com'),
    rma_url = COALESCE(NULLIF(rma_url, ''), 'https://www.pcmira.com/soporte/#1709116148078-b31995e3-0ffc'),
    rma_process = '{"method":"portal","emailTo":"sat@pcmira.com","emailCc":"","requiresForm":true,"formType":"web","formUrl":"https://www.pcmira.com/soporte/#1709116148078-b31995e3-0ffc","allowsDirectToClient":false,"steps":"Abrir ticket OBLIGATORIAMENTE a través del portal. Contacto: sat@pcmira.com."}'::jsonb,
    updated_at = now()
  WHERE deleted_at IS NULL AND (name ILIKE '%pc mira%' OR name ILIKE '%pcmira%' OR email ILIKE '%pcmira%')
  RETURNING id
)
INSERT INTO hsm.providers (name, email, rma_url, rma_process)
SELECT 'PC Mira', 'sat@pcmira.com', 'https://www.pcmira.com/soporte/#1709116148078-b31995e3-0ffc',
  '{"method":"portal","emailTo":"sat@pcmira.com","emailCc":"","requiresForm":true,"formType":"web","formUrl":"https://www.pcmira.com/soporte/#1709116148078-b31995e3-0ffc","allowsDirectToClient":false,"steps":"Abrir ticket OBLIGATORIAMENTE a través del portal. Contacto: sat@pcmira.com."}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM up);

-- 4) PEDRO PORTO ------------------------------------------------------------
WITH up AS (
  UPDATE hsm.providers SET
    email = COALESCE(NULLIF(email, ''), 'tecnica.es@pedroporto.pt'),
    rma_process = '{"method":"email","emailTo":"tecnica.es@pedroporto.pt, jose.romero@pedroporto.pt","emailCc":"hardware@qamarero.com","requiresForm":true,"formType":"pdf","formUrl":"","allowsDirectToClient":false,"steps":"1) Rellenar el PDF con los datos del RMA. 2) Enviarlo por email a tecnica.es@pedroporto.pt y jose.romero@pedroporto.pt (CC hardware@qamarero.com)."}'::jsonb,
    updated_at = now()
  WHERE deleted_at IS NULL AND (name ILIKE '%pedro porto%' OR name ILIKE '%pedroporto%' OR email ILIKE '%pedroporto%')
  RETURNING id
)
INSERT INTO hsm.providers (name, email, rma_process)
SELECT 'Pedro Porto', 'tecnica.es@pedroporto.pt',
  '{"method":"email","emailTo":"tecnica.es@pedroporto.pt, jose.romero@pedroporto.pt","emailCc":"hardware@qamarero.com","requiresForm":true,"formType":"pdf","formUrl":"","allowsDirectToClient":false,"steps":"1) Rellenar el PDF con los datos del RMA. 2) Enviarlo por email a tecnica.es@pedroporto.pt y jose.romero@pedroporto.pt (CC hardware@qamarero.com)."}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM up);

-- 5) POSIFLEX ---------------------------------------------------------------
WITH up AS (
  UPDATE hsm.providers SET
    email = COALESCE(NULLIF(email, ''), 'sat@posiflex.es'),
    rma_url = COALESCE(NULLIF(rma_url, ''), 'https://www.posiflex.es/sat?ini=rma'),
    rma_process = '{"method":"portal_y_email","emailTo":"sat@posiflex.es","emailCc":"","requiresForm":true,"formType":"web","formUrl":"https://www.posiflex.es/sat?ini=rma","allowsDirectToClient":true,"steps":"1) Abrir ticket en el portal (posiflex.es/sat?ini=rma). 2) Enviar email a sat@posiflex.es. Permite recogida/envío directo al cliente en casos particulares."}'::jsonb,
    updated_at = now()
  WHERE deleted_at IS NULL AND (name ILIKE '%posiflex%' OR email ILIKE '%posiflex%')
  RETURNING id
)
INSERT INTO hsm.providers (name, email, rma_url, rma_process)
SELECT 'Posiflex', 'sat@posiflex.es', 'https://www.posiflex.es/sat?ini=rma',
  '{"method":"portal_y_email","emailTo":"sat@posiflex.es","emailCc":"","requiresForm":true,"formType":"web","formUrl":"https://www.posiflex.es/sat?ini=rma","allowsDirectToClient":true,"steps":"1) Abrir ticket en el portal (posiflex.es/sat?ini=rma). 2) Enviar email a sat@posiflex.es. Permite recogida/envío directo al cliente en casos particulares."}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM up);

-- 6) AQPROX -----------------------------------------------------------------
WITH up AS (
  UPDATE hsm.providers SET
    email = COALESCE(NULLIF(email, ''), 'rma@mylar.es'),
    rma_url = COALESCE(NULLIF(rma_url, ''), 'https://www.aqproxtpv.es/reparaciones/'),
    rma_process = '{"method":"portal_y_email","emailTo":"rma@mylar.es","emailCc":"anazaragoza@mylar.es","requiresForm":true,"formType":"web","formUrl":"https://www.aqproxtpv.es/reparaciones/","allowsDirectToClient":true,"steps":"1) Rellenar el formulario (aqproxtpv.es/reparaciones) y enviarlo por correo a rma@mylar.es (Fran y Sergio, técnicos). CC Ana Zaragoza (anazaragoza@mylar.es). Permite recogida/envío directo al cliente."}'::jsonb,
    updated_at = now()
  WHERE deleted_at IS NULL AND (name ILIKE '%aqprox%' OR email ILIKE '%aqprox%' OR email ILIKE '%mylar%')
  RETURNING id
)
INSERT INTO hsm.providers (name, email, rma_url, rma_process)
SELECT 'AQPROX', 'rma@mylar.es', 'https://www.aqproxtpv.es/reparaciones/',
  '{"method":"portal_y_email","emailTo":"rma@mylar.es","emailCc":"anazaragoza@mylar.es","requiresForm":true,"formType":"web","formUrl":"https://www.aqproxtpv.es/reparaciones/","allowsDirectToClient":true,"steps":"1) Rellenar el formulario (aqproxtpv.es/reparaciones) y enviarlo por correo a rma@mylar.es (Fran y Sergio, técnicos). CC Ana Zaragoza (anazaragoza@mylar.es). Permite recogida/envío directo al cliente."}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM up);
