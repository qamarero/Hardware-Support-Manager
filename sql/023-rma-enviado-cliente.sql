-- 023 — Nuevo estado de RMA "enviado_cliente" (pausa el SLA).
--
-- El equipo reparado/sustituido se ha ENVIADO al cliente y estamos a la espera
-- de que confirme la recepción. Va entre "recibido_oficina" y "entregado_cliente".
-- Fuera de nuestro alcance → pausa el SLA (ver PAUSED_RMA_STATES).
--
-- Aditivo y no destructivo. Aplicado 2026-07-08 vía MCP (rol con DDL).

ALTER TYPE hsm.rma_status ADD VALUE IF NOT EXISTS 'enviado_cliente';
