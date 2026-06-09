-- ============================================================================
-- Importación masiva inbox Logística & RMA — 2026-04-08
-- 18 incidencias extraídas de Intercom (tickets #73735559 al #90024520)
-- Ejecutar en Supabase SQL Editor contra schema hsm
-- ============================================================================

DO $$
DECLARE
  base_val   INTEGER;
  year_val   INTEGER := 2026;
  pfx        TEXT    := 'INC';

  FUNCTION num(offset INTEGER) RETURNS TEXT LANGUAGE sql AS $f$
    SELECT pfx || '-' || year_val || '-' || LPAD((base_val + offset)::text, 5, '0')
  $f$;

BEGIN
  -- Reservar 18 números de secuencia de forma atómica
  INSERT INTO hsm.sequences (prefix, year, last_value)
  VALUES (pfx, year_val, 18)
  ON CONFLICT (prefix, year) DO UPDATE
    SET last_value = hsm.sequences.last_value + 18
  RETURNING last_value INTO base_val;

  base_val := base_val - 17; -- primer número del lote

  -- --------------------------------------------------------
  -- 1. Manuel Osorio Buitrago — LAMARTA (IC #89357232)
  -- --------------------------------------------------------
  INSERT INTO hsm.incidents (
    incident_number, client_name, category, priority, status,
    title, description,
    device_brand, device_type,
    intercom_escalation_id, contact_name, contact_phone,
    created_at, state_changed_at
  ) VALUES (
    pfx||'-'||year_val||'-'||LPAD((base_val+0)::text,5,'0'),
    'Manuel Osorio Buitrago - LAMARTA',
    'periferico', 'alta', 'nuevo',
    'Aqprox táctil no responde (reincidente)',
    'IC #89357232 · 04/04/2026. Pantalla Aqprox falla el táctil: no responde o hace toques donde no se han hecho. Segunda vez con este equipo, ya estuvo en garantía. Urgencia: Alta.',
    'Aqprox', 'TPV',
    '89357232', 'Manuel Osorio Buitrago', '+34604026341',
    '2026-04-04 00:00:00+00', now()
  );

  -- --------------------------------------------------------
  -- 2. Jose Manuel Sanchez — Asador del Real (IC #89146253)
  -- --------------------------------------------------------
  INSERT INTO hsm.incidents (
    incident_number, client_name, category, priority, status,
    title, description,
    device_brand, device_type,
    intercom_escalation_id, contact_name, contact_phone,
    created_at, state_changed_at
  ) VALUES (
    pfx||'-'||year_val||'-'||LPAD((base_val+1)::text,5,'0'),
    'Jose Manuel Sanchez - Asador del Real',
    'impresora', 'alta', 'nuevo',
    'Impresora Aqprox imprime en blanco — acepta RMA',
    'IC #89146253 · 03/04/2026. Impresora Aqprox imprime en blanco. Probados diferentes papeles que sí funcionan. Cliente acepta condiciones RMA. Email: jsanchezco@telefonica.net. Urgencia: Alta.',
    'Aqprox', 'Impresora',
    '89146253', 'Jose Manuel Sanchez', '+34629078518',
    '2026-04-03 00:00:00+00', now()
  );

  -- --------------------------------------------------------
  -- 3. Salvador — MAÑEO (IC #89739392)
  -- --------------------------------------------------------
  INSERT INTO hsm.incidents (
    incident_number, client_name, category, priority, status,
    title, description,
    device_type,
    intercom_escalation_id, contact_name, contact_phone,
    created_at, state_changed_at
  ) VALUES (
    pfx||'-'||year_val||'-'||LPAD((base_val+2)::text,5,'0'),
    'Salvador - MAÑEO',
    'impresora', 'baja', 'nuevo',
    'Impresora intermitente — requiere refresco diario',
    'IC #89739392 · 06/04/2026. Todos los días hay que refrescar pantalla y probar impresora. Vuelve a funcionar pero luego deja de imprimir y se pierden comandas. JSPrintManager revisado: OK. Impresora funciona en este momento. Email: maneo.restaurante@gmail.com. Urgencia: Baja.',
    'Impresora',
    '89739392', 'Salvador', '+34627923012',
    '2026-04-06 00:00:00+00', now()
  );

  -- --------------------------------------------------------
  -- 4. Vanesa — Tapeando (IC #87542276)
  -- --------------------------------------------------------
  INSERT INTO hsm.incidents (
    incident_number, client_name, category, priority, status,
    title, description,
    device_type,
    intercom_escalation_id, contact_name, contact_phone,
    created_at, state_changed_at
  ) VALUES (
    pfx||'-'||year_val||'-'||LPAD((base_val+3)::text,5,'0'),
    'Vanesa - Tapeando',
    'hardware', 'alta', 'nuevo',
    'Ordenador no pasa de pantalla azul (BSOD)',
    'IC #87542276 · 30/03/2026. Ordenador atascado en pantalla azul. Único paso realizado: reiniciar. Sin resolución. Urgencia: Alta.',
    'Ordenador',
    '87542276', 'Vanesa', '+34699174006',
    '2026-03-30 00:00:00+00', now()
  );

  -- --------------------------------------------------------
  -- 5. Luisa Albatera — El Irlandes (IC #84002163)
  -- --------------------------------------------------------
  INSERT INTO hsm.incidents (
    incident_number, client_name, category, priority, status,
    title, description,
    device_type,
    intercom_escalation_id, contact_name, contact_phone,
    created_at, state_changed_at
  ) VALUES (
    pfx||'-'||year_val||'-'||LPAD((base_val+4)::text,5,'0'),
    'Luisa Albatera - El Irlandes',
    'impresora', 'alta', 'nuevo',
    'Impresora forzada/atascada al sacar papel',
    'IC #84002163 · 17/03/2026. Impresora forzada/atascada al sacar papel. Paso indicado: corroborar que no tenga nada atascado. Tiene modelo y vídeos en el hilo. Email: luisa.albatera.1969@gmail.com. Urgencia: Alta.',
    'Impresora',
    '84002163', 'Luisa Albatera', '+34639463322',
    '2026-03-17 00:00:00+00', now()
  );

  -- --------------------------------------------------------
  -- 6. Veronica Giuliani Ochoa — Gilda Company (IC #84409512)
  -- --------------------------------------------------------
  INSERT INTO hsm.incidents (
    incident_number, client_name, category, priority, status,
    title, description,
    device_brand, device_type,
    intercom_escalation_id, contact_name, contact_phone,
    pickup_address, pickup_postal_code, pickup_city,
    created_at, state_changed_at
  ) VALUES (
    pfx||'-'||year_val||'-'||LPAD((base_val+5)::text,5,'0'),
    'Veronica Giuliani Ochoa - Gilda & Company',
    'monitor', 'alta', 'nuevo',
    'RMA Pantalla XPOS — entra en restauración constantemente',
    'IC #84409512 · 18/03/2026. Pantalla XPOS en uso desde noviembre. Entra en estado de restauración constantemente, tarda +30 min en iniciarse. Datos de recogida completos. DNI contacto: 24375595B. Email: info@gildandcompany.com. Urgencia: Alta.',
    'XPOS', 'Pantalla TPV',
    '84409512', 'Veronica Giuliani Ochoa', '+34685252071',
    'Calle Santo Cáliz 7 bajo derecha', '46001', 'Valencia',
    '2026-03-18 00:00:00+00', now()
  );

  -- --------------------------------------------------------
  -- 7. Jose — Mesón el Lobo (IC #84622965)
  -- --------------------------------------------------------
  INSERT INTO hsm.incidents (
    incident_number, client_name, category, priority, status,
    title, description,
    device_brand, device_type,
    intercom_escalation_id, contact_name, contact_phone,
    created_at, state_changed_at
  ) VALUES (
    pfx||'-'||year_val||'-'||LPAD((base_val+6)::text,5,'0'),
    'Jose - Mesón el Lobo',
    'red', 'alta', 'nuevo',
    'Impresora GEON LAN no conecta a la red (DHCP activo)',
    'IC #84622965 · 19/03/2026. No puede conectar impresora GEON LAN a la red. DHCP activo y no puede desactivarlo. Tampoco conecta a la IO generada. Pasos realizados: asignación IP estándar. Email: pintorjose415@gmail.com. Urgencia: Alta.',
    'GEON', 'Impresora LAN',
    '84622965', 'Jose', '+34616252281',
    '2026-03-19 00:00:00+00', now()
  );

  -- --------------------------------------------------------
  -- 8. Antonio Aragona — Il Boccaccio (IC #85620350)
  -- --------------------------------------------------------
  INSERT INTO hsm.incidents (
    incident_number, client_name, category, priority, status,
    title, description,
    device_brand, device_model, device_serial_number,
    intercom_escalation_id, contact_name, contact_phone,
    pickup_address, pickup_postal_code, pickup_city,
    created_at, state_changed_at
  ) VALUES (
    pfx||'-'||year_val||'-'||LPAD((base_val+7)::text,5,'0'),
    'Antonio Aragona - Il Boccaccio',
    'impresora', 'alta', 'nuevo',
    'RMA Aqprox impresora en blanco — recogida pendiente',
    'IC #85620350 · 24/03/2026. Impresora Aqprox (Mylar) imprime en blanco. Probado método uña, cambio posición papel, sin resultado. Cliente escalado para gestión RMA. Fecha recogida: PENDIENTE. Email contacto: toluci67@gmail.com.',
    'Aqprox', 'Printer USB + LAN', 'APPPOS80AM-USBLAN2401742',
    '85620350', 'Antonio Aragona', '+34640114448',
    'Avenida Gamonal 7', '29630', 'Benalmádena',
    '2026-03-24 00:00:00+00', now()
  );

  -- --------------------------------------------------------
  -- 9. Jose Cervera vivancos — taburete cojo 2 (IC #76385410)
  -- --------------------------------------------------------
  INSERT INTO hsm.incidents (
    incident_number, client_name, category, priority, status,
    title, description,
    intercom_escalation_id, contact_name, contact_phone,
    created_at, state_changed_at
  ) VALUES (
    pfx||'-'||year_val||'-'||LPAD((base_val+8)::text,5,'0'),
    'Jose Cervera vivancos - taburete cojo 2',
    'red', 'alta', 'nuevo',
    'Red Qamarero2.4G sin internet',
    'IC #76385410 · 13/02/2026. Red Qamarero2.4G no tiene internet. Paso indicado: corroborar cables. Imagen adjunta en ticket. Conversación Intercom cerrada.',
    '76385410', 'Jose Cervera vivancos', '+34661640055',
    '2026-02-13 00:00:00+00', now()
  );

  -- --------------------------------------------------------
  -- 10. Nuevo Café Bar Baviera — Baviera (IC #77680163)
  -- --------------------------------------------------------
  INSERT INTO hsm.incidents (
    incident_number, client_name, category, priority, status,
    title, description,
    device_type, device_serial_number,
    intercom_escalation_id, contact_name, contact_phone,
    created_at, state_changed_at
  ) VALUES (
    pfx||'-'||year_val||'-'||LPAD((base_val+9)::text,5,'0'),
    'Nuevo Café Bar Baviera - Baviera',
    'hardware', 'alta', 'nuevo',
    'TPV no enciende — posible placa base dañada por pico de voltaje',
    'IC #77680163 · 20/02/2026. Cargador estropeado y la pantalla dejó de encenderse (posible pico de alto voltaje dañó la placa base). Enviado enlace de cargador compatible: tampoco enciende. Posible también la clavija. Posible RMA. Email: bgt_pringues94@hotmail.com. SN: F1SGNL12SA2521170201.',
    'TPV', 'F1SGNL12SA2521170201',
    '77680163', 'Nuevo Café Bar Baviera', '+34648180603',
    '2026-02-20 00:00:00+00', now()
  );

  -- --------------------------------------------------------
  -- 11. Carlos Galvan — The break coffee (IC #78527256)
  -- --------------------------------------------------------
  INSERT INTO hsm.incidents (
    incident_number, client_name, category, priority, status,
    title, description,
    device_type,
    intercom_escalation_id, contact_name, contact_phone,
    created_at, state_changed_at
  ) VALUES (
    pfx||'-'||year_val||'-'||LPAD((base_val+10)::text,5,'0'),
    'Carlos Galvan - The break coffee',
    'periferico', 'alta', 'nuevo',
    'Táctil TPV intermitente — selecciona pocos productos',
    'IC #78527256 · 23/02/2026. Táctil no funciona con normalidad. AnyDesk: comandos salen correctamente. Comanda de prueba: solo deja seleccionar unos pocos productos. 2 vídeos adjuntos en ticket. Email: carlosgalvan85@gmail.com. Urgencia: Alta.',
    'TPV',
    '78527256', 'Carlos Galvan', '+34637821204',
    '2026-02-23 00:00:00+00', now()
  );

  -- --------------------------------------------------------
  -- 12. José Luciano — Fogón y Leña (IC #81498635)
  -- --------------------------------------------------------
  INSERT INTO hsm.incidents (
    incident_number, client_name, category, priority, status,
    title, description,
    device_type,
    intercom_escalation_id, contact_name, contact_phone,
    created_at, state_changed_at
  ) VALUES (
    pfx||'-'||year_val||'-'||LPAD((base_val+11)::text,5,'0'),
    'José Luciano - Fogón y Leña',
    'impresora', 'alta', 'nuevo',
    'Impresora imprime en blanco — pasos básicos agotados',
    'IC #81498635 · 08/03/2026. Impresora imprime en blanco. Pasos realizados: papel al revés, todas las caras, verificación atasco (cliente insiste en que no). Es papel térmico. Se le indicó darle la vuelta: sigue imprimiendo en blanco. Email: bodegaparada23@gmail.com.',
    'Impresora',
    '81498635', 'José Luciano', '+34672887379',
    '2026-03-08 00:00:00+00', now()
  );

  -- --------------------------------------------------------
  -- 13. Laura — La Montanera de San Pedro (IC #81536151)
  -- --------------------------------------------------------
  INSERT INTO hsm.incidents (
    incident_number, client_name, category, priority, status,
    title, description,
    device_type,
    intercom_escalation_id, contact_name, contact_phone,
    created_at, state_changed_at
  ) VALUES (
    pfx||'-'||year_val||'-'||LPAD((base_val+12)::text,5,'0'),
    'Laura - La Montanera de San Pedro',
    'impresora', 'alta', 'nuevo',
    'Impresora USB Barra no detectada — posible error de pantalla',
    'IC #81536151 · 08/03/2026. No detecta impresora USB Barra. Posible error por la pantalla. Pasos: cambio cable USB, sigue sin detectar. Imagen adjunta. Tel: 603978458.',
    'Impresora USB',
    '81536151', 'Laura', '+34603978458',
    '2026-03-08 00:00:00+00', now()
  );

  -- --------------------------------------------------------
  -- 14. Cristian — ORIGEN x GASTROPUB (IC #82595251)
  -- --------------------------------------------------------
  INSERT INTO hsm.incidents (
    incident_number, client_name, category, priority, status,
    title, description,
    device_brand, device_type, device_serial_number,
    intercom_escalation_id, contact_name, contact_phone,
    pickup_address, pickup_city,
    created_at, state_changed_at
  ) VALUES (
    pfx||'-'||year_val||'-'||LPAD((base_val+13)::text,5,'0'),
    'Cristian - ORIGEN x GASTROPUB',
    'hardware', 'alta', 'nuevo',
    'RMA GEON TPV no enciende — menos de 1 año',
    'IC #82595251 · 12/03/2026. TPV GEON con menos de un año no enciende. Cliente ha probado de todo. Escalado para gestión RMA. SN: F15GML128A2501170294. Email: restauranteflorin@gmail.com.',
    'GEON', 'TPV', 'F15GML128A2501170294',
    '82595251', 'Cristian', '+34643143295',
    'Cardenal Bartolomé de la Cueva 9', 'Cuéllar (Segovia)',
    '2026-03-12 00:00:00+00', now()
  );

  -- --------------------------------------------------------
  -- 15. Samuel Martinez — (IC #73735559)
  -- --------------------------------------------------------
  INSERT INTO hsm.incidents (
    incident_number, client_name, category, priority, status,
    title, description,
    device_type,
    intercom_escalation_id, contact_name, contact_phone,
    created_at, state_changed_at
  ) VALUES (
    pfx||'-'||year_val||'-'||LPAD((base_val+14)::text,5,'0'),
    'Samuel Martinez',
    'impresora', 'alta', 'nuevo',
    'Impresora actúa raro al sacar papel — posible RMA',
    'IC #73735559 · 02/02/2026. Impresora actúa raro al sacar papel. Realizados todos los pasos de puesta en marcha tras configuración. Parece algo interno de la impresora. Se propone revisión por HW y si preciso RMA. Vídeo adjunto. Conversación Intercom cerrada.',
    'Impresora',
    '73735559', 'Samuel Martinez', '+34635861968',
    '2026-02-02 00:00:00+00', now()
  );

  -- --------------------------------------------------------
  -- 16. Roberto Rodriguez — Fermar (IC #74015205)
  -- --------------------------------------------------------
  INSERT INTO hsm.incidents (
    incident_number, client_name, category, priority, status,
    title, description,
    device_type,
    intercom_escalation_id, contact_name, contact_phone,
    created_at, state_changed_at
  ) VALUES (
    pfx||'-'||year_val||'-'||LPAD((base_val+15)::text,5,'0'),
    'Roberto Rodriguez - Fermar',
    'monitor', 'media', 'nuevo',
    'RMA pantalla — pendiente hablar con Domi',
    'IC #74015205 · 03/02/2026. RMA de pantalla. Paso previo: hablar con Domi (comercial/gestor). Email: roberto741013@gmail.com. Urgencia: Media.',
    'Pantalla',
    '74015205', 'Roberto Rodriguez', '+34632267294',
    '2026-02-03 00:00:00+00', now()
  );

  -- --------------------------------------------------------
  -- 17. German Munoz — Restaurante Con Acento (IC #90024520)
  -- --------------------------------------------------------
  INSERT INTO hsm.incidents (
    incident_number, client_name, category, priority, status,
    title, description,
    device_type, device_model, device_serial_number,
    intercom_escalation_id, contact_name, contact_phone,
    pickup_address, pickup_postal_code, pickup_city,
    created_at, state_changed_at
  ) VALUES (
    pfx||'-'||year_val||'-'||LPAD((base_val+16)::text,5,'0'),
    'German Munoz - Restaurante Con Acento',
    'hardware', 'alta', 'nuevo',
    'RMA KDS 10POS se apaga sola — meses de intentos sin solución',
    'IC #90024520 · 07/04/2026. KDS 10POS se apaga sola. Lleva meses con el problema, se ha conectado varias veces en remoto sin éxito. Franja recogida: miércoles a viernes 13:00-16:00. Email: conacentocordoba@gmail.com. SN: 215J202504160046.',
    'KDS', '10 POS', '215J202504160046',
    '90024520', 'German Munoz', '+34658231260',
    'Avenida Al Nasir 13', '14006', 'Córdoba',
    '2026-04-07 00:00:00+00', now()
  );

  -- --------------------------------------------------------
  -- 18. Lucia Toledano — Punto G (IC #88791230)
  -- --------------------------------------------------------
  INSERT INTO hsm.incidents (
    incident_number, client_name, category, priority, status,
    title, description,
    device_type, device_model,
    intercom_escalation_id, contact_name, contact_phone,
    created_at, state_changed_at
  ) VALUES (
    pfx||'-'||year_val||'-'||LPAD((base_val+17)::text,5,'0'),
    'Lucia Toledano - Punto G',
    'monitor', 'alta', 'nuevo',
    'RMA Pantalla 10POS — táctil sin respuesta, pasos agotados',
    'IC #88791230 · 02/04/2026. Pantalla 10POS con táctil sin responder desde hace semanas. Pasos agotados: reinstalación controlador (auto y manual), actualización Windows, calibración pantalla. Resultado: Doesn''t Work. Gestionar RMA.',
    'Pantalla', '10POS',
    '88791230', 'Lucia Toledano', '+34634956497',
    '2026-04-02 00:00:00+00', now()
  );

END $$;

-- ============================================================================
-- Verificación: muestra los 18 incidentes recién creados
-- ============================================================================
SELECT
  incident_number,
  client_name,
  category,
  priority,
  status,
  LEFT(title, 60) AS title_short,
  intercom_escalation_id AS ic_id,
  created_at::date AS fecha_ic
FROM hsm.incidents
WHERE intercom_escalation_id IN (
  '89357232','89146253','89739392','87542276','84002163',
  '84409512','84622965','85620350','76385410','77680163',
  '78527256','81498635','81536151','82595251','73735559',
  '74015205','90024520','88791230'
)
ORDER BY created_at;
