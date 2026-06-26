-- 019 — Prioridad binaria (operatividad del cliente)
--
-- La app pasa de 4 prioridades (baja/media/alta/critica) a 2:
--   media   = "Cliente puede operar"
--   critica = "Cliente no puede operar"
--
-- NO se cambia el enum incident_priority/support_submission_priority (media y
-- critica ya existen; baja/alta quedan huérfanos pero válidos). Esto solo
-- NORMALIZA los datos existentes para que filtros y selectores queden limpios.
-- Aditivo y seguro (solo UPDATE). Ejecutar como rol postgres en el SQL Editor.

UPDATE hsm.incidents          SET priority = 'media'   WHERE priority = 'baja';
UPDATE hsm.incidents          SET priority = 'critica' WHERE priority = 'alta';

UPDATE hsm.support_submissions SET priority = 'media'   WHERE priority = 'baja';
UPDATE hsm.support_submissions SET priority = 'critica' WHERE priority = 'alta';
