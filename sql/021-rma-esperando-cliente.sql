-- 021 — Nuevo estado de RMA "esperando_cliente" (pausa el SLA).
--
-- Estado para cuando el RMA queda a la espera del cliente (p. ej. equipo
-- reparado/recibido, pendiente de que el cliente confirme o recoja). Pausa el
-- reloj de SLA igual que enviado_proveedor / en_proveedor (ver
-- PAUSED_RMA_STATES en src/lib/constants/statuses.ts).
--
-- Aditivo y no destructivo. ADD VALUE no puede usarse en la MISMA transacción
-- en la que se emplea el valor; aquí solo lo añadimos, así que es seguro.
-- Aplicado el 2026-07-01 vía MCP (rol con DDL).

ALTER TYPE hsm.rma_status ADD VALUE IF NOT EXISTS 'esperando_cliente';
