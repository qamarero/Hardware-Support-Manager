-- ============================================================================
-- 030: identificador de restaurante tecleado a mano en /submit.
--
-- Ejecutar como `postgres` en el SQL Editor de Supabase: el rol hsm_app no
-- tiene DDL. Sin BEGIN/COMMIT. Idempotente.
--
-- POR QUE
-- El buscador solo ofrece clientes con restaurant_id, asi que un restaurante
-- que todavia no ha llegado desde CX Advisor no se puede seleccionar. Hasta
-- ahora eso obligaba a escribirlo como texto libre y la incidencia nacia sin
-- nada con que identificar el local.
--
-- Con esta columna, soporte puede teclear el restaurant_id que ve en el panel
-- interno y queda guardado EN LA SUMISION.
--
-- LO QUE ESTA COLUMNA NO HACE, Y ES A PROPOSITO
-- No crea ningun cliente ni escribe en hsm.clients, y muchisimo menos en
-- CX Advisor, que sigue siendo la fuente de verdad en un solo sentido. Si
-- diera de alta la ficha, un acento o una mayuscula distinta bastarian para
-- duplicar el restaurante: exactamente el problema que se acaba de arreglar
-- con el espejo de CX Advisor. Es una anotacion que una persona verifica.
-- ============================================================================

ALTER TABLE hsm.support_submissions
  -- restaurant_id tal cual lo tecleo quien reporta. Se valida el FORMATO en el
  -- formulario (36 caracteres con guiones), no que exista: la gracia es
  -- precisamente poder reportar restaurantes que aun no estan.
  ADD COLUMN IF NOT EXISTS manual_client_external_id varchar(255);

-- La bandeja comprueba en cada visita si ese id ya casa con un cliente: un
-- restaurante que no estaba al reportarse puede haber llegado con el sync de
-- esta madrugada. El indice hace esa comprobacion inmediata.
CREATE INDEX IF NOT EXISTS support_submissions_manual_ext_id_idx
  ON hsm.support_submissions (lower(manual_client_external_id))
  WHERE manual_client_external_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON hsm.support_submissions TO hsm_app;

-- Comprobacion: 0 antes de que nadie use el alta manual.
SELECT count(*) AS sumisiones_con_id_a_mano
  FROM hsm.support_submissions
 WHERE manual_client_external_id IS NOT NULL;
