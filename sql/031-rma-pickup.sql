-- ============================================================================
-- 031: recogida TIPSA del RMA pedida a MainOps.
--
-- Ejecutar como `postgres` en el SQL Editor de Supabase: el rol hsm_app no
-- tiene DDL. Sin BEGIN/COMMIT. Aditivo e idempotente: se puede volver a pegar.
--
-- APLICAR ANTES DE DESPLEGAR EL CODIGO: Drizzle pide la columna en cada
-- consulta de RMAs, y sin ella la lista y la ficha fallan.
--
-- POR QUE
-- Desde un RMA con logistica «Nosotros recogemos y enviamos», el tecnico pide a
-- MainOps que programe una recogida TIPSA en casa del cliente. MainOps es quien
-- habla con TIPSA y avisa a HSM por webhook de cada cambio de estado
-- (contrato: docs/connectors/mainops-recogidas-contrato.md).
--
-- Esta columna guarda la ULTIMA foto de esa recogida tal como la manda MainOps
-- (PickupDTO): { pickup_id, rma_id, rma_number, status, status_label,
-- pickup_date, time_from, time_to, tipsa_code, albaran, incidence, last_event,
-- cancel_reason, created_at, updated_at }.
--
-- LO QUE ESTA COLUMNA NO HACE, Y ES A PROPOSITO
-- No es el historial: cada cambio queda en hsm.event_logs (accion 'pickup'),
-- que es donde la ficha ya pinta la cronologia del RMA. Y no mueve el estado del
-- RMA: eso lo decide una persona.
-- ============================================================================

ALTER TABLE hsm.rmas
  -- NULL = nunca se ha pedido recogida. Sin DEFAULT a proposito: '{}' haria
  -- creer a la ficha que hay una recogida sin estado.
  ADD COLUMN IF NOT EXISTS pickup jsonb;

-- Sin indice: el webhook busca el RMA por su id (clave primaria), que viene en
-- pickup.rma_id del propio aviso.

GRANT SELECT, INSERT, UPDATE, DELETE ON hsm.rmas TO hsm_app;

-- Comprobacion: una fila (pickup | jsonb | YES) y 0 RMAs con recogida.
SELECT c.column_name, c.data_type, c.is_nullable,
       (SELECT count(*) FROM hsm.rmas WHERE pickup IS NOT NULL) AS rmas_con_recogida
  FROM information_schema.columns c
 WHERE c.table_schema = 'hsm'
   AND c.table_name = 'rmas'
   AND c.column_name = 'pickup';
