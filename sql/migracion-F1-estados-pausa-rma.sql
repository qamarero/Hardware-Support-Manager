-- ============================================================================
-- Migración F1 — Integración funcional del prototipo
-- Aditiva y NO destructiva. Aplicar en el SQL editor de Supabase.
-- (No requiere ventana de mantenimiento; son cambios aditivos.)
-- ============================================================================

-- 1) Nuevo estado de incidencia 'esperando_pieza' (destino al derivar a RMA;
--    pausa el SLA igual que esperando_cliente / esperando_proveedor).
--    El vocabulario visible ("Abierta", "En curso", "Esperando pieza"...) se
--    cambió SOLO en los labels de la app; los identificadores internos del
--    enum se conservan, así que NO hay renombrados ni reescritura de histórico.
ALTER TYPE hsm.incident_status ADD VALUE IF NOT EXISTS 'esperando_pieza';

-- 2) Pausa de SLA en RMA: columna acumuladora de tiempo en pausa (ms como
--    texto, mismo patrón que incidencias). El contador de antigüedad se
--    congela mientras el equipo está en el proveedor (enviado_proveedor /
--    en_proveedor).
ALTER TABLE hsm.rmas
  ADD COLUMN IF NOT EXISTS sla_paused_ms varchar(50) DEFAULT '0' NOT NULL;
