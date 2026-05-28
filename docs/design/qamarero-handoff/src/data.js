// ═══════════════════════════════════════════════════════════════
// Hardware Support Manager — seed data + storage
// All persisted to localStorage under HSM_STATE_V1
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY = 'HSM_STATE_V2';

const TECHNICIANS = [
  { id: 'u1', name: 'Marta Ferrer', initials: 'MF', role: 'Lead técnico hardware' },
  { id: 'u2', name: 'Javier Ruiz', initials: 'JR', role: 'Técnico de soporte' },
  { id: 'u3', name: 'Lucía Mendoza', initials: 'LM', role: 'Técnico de soporte' },
  { id: 'u4', name: 'Diego Almeida', initials: 'DA', role: 'Técnico junior' },
  { id: 'u5', name: 'Sofía Castro', initials: 'SC', role: 'Manager hardware' },
];

const VENDORS = [
  { id: 'v1', name: 'Dell ProSupport', contact: 'soporte.es@dell.com', sla: '24h on-site', country: 'ES' },
  { id: 'v2', name: 'HP Cuidado de Negocio', contact: 'rma-spain@hp.com', sla: '48h', country: 'ES' },
  { id: 'v3', name: 'Lenovo Premier Support', contact: 'premier.iberia@lenovo.com', sla: '24h NBD', country: 'ES' },
  { id: 'v4', name: 'Apple Business Care', contact: 'business.support@apple.com', sla: '48h reparación', country: 'ES' },
  { id: 'v5', name: 'Logitech B2B', contact: 'b2b-es@logitech.com', sla: '5 días laborables', country: 'IE' },
  { id: 'v6', name: 'Jabra Iberia', contact: 'soporte@jabra.es', sla: '7 días', country: 'ES' },
];

const DEVICES = [
  { id: 'd1', model: 'Dell Latitude 7440', serial: 'LT7440-A8F2K9', type: 'Portátil', assignee: 'Carlos Vega', dept: 'Comercial', vendor: 'v1', warranty: '2027-04-12' },
  { id: 'd2', model: 'Dell OptiPlex 7010', serial: 'OP7010-Z2H1M5', type: 'Sobremesa', assignee: 'Recepción', dept: 'Oficina', vendor: 'v1', warranty: '2026-09-30' },
  { id: 'd3', model: 'HP EliteBook 845 G10', serial: 'EB845-K7P3Q2', type: 'Portátil', assignee: 'Isabel Romero', dept: 'Marketing', vendor: 'v2', warranty: '2027-01-22' },
  { id: 'd4', model: 'HP LaserJet Pro 4002dn', serial: 'LJP-4002-N9X', type: 'Impresora', assignee: 'Planta 2', dept: 'Oficina', vendor: 'v2', warranty: '2026-06-15' },
  { id: 'd5', model: 'Lenovo ThinkPad X1 Carbon Gen 11', serial: 'TPX1-G11-44A7', type: 'Portátil', assignee: 'Pablo Núñez', dept: 'Producto', vendor: 'v3', warranty: '2028-03-08' },
  { id: 'd6', model: 'Lenovo ThinkCentre M90q', serial: 'TCM90-Q1B6X', type: 'Sobremesa', assignee: 'Sala reuniones A', dept: 'Oficina', vendor: 'v3', warranty: '2027-11-04' },
  { id: 'd7', model: 'MacBook Pro 14" M3', serial: 'MBP14-M3-FW7K', type: 'Portátil', assignee: 'Andrea Solís', dept: 'Diseño', vendor: 'v4', warranty: '2027-07-19' },
  { id: 'd8', model: 'MacBook Air 13" M2', serial: 'MBA13-M2-JG2P', type: 'Portátil', assignee: 'Miguel Bravo', dept: 'Producto', vendor: 'v4', warranty: '2026-12-01' },
  { id: 'd9', model: 'Dell UltraSharp U2723QE', serial: 'U2723-MN8H3', type: 'Monitor', assignee: 'Pablo Núñez', dept: 'Producto', vendor: 'v1', warranty: '2027-02-28' },
  { id: 'd10', model: 'Logitech MX Master 3S', serial: 'MXM3S-7821', type: 'Periférico', assignee: 'Carlos Vega', dept: 'Comercial', vendor: 'v5', warranty: '2026-10-10' },
  { id: 'd11', model: 'Jabra Evolve2 75', serial: 'JE275-A1F4', type: 'Auricular', assignee: 'Atención cliente', dept: 'Soporte', vendor: 'v6', warranty: '2026-08-22' },
  { id: 'd12', model: 'Dell Latitude 5540', serial: 'LT5540-PQ19X', type: 'Portátil', assignee: 'Elena Vargas', dept: 'Finanzas', vendor: 'v1', warranty: '2027-05-30' },
  { id: 'd13', model: 'HP ProBook 450 G10', serial: 'PB450-G10-WB3', type: 'Portátil', assignee: 'Sin asignar', dept: 'Stock', vendor: 'v2', warranty: '2028-01-10' },
  { id: 'd14', model: 'iPad Pro 11" M4', serial: 'IPD11-M4-2K9C', type: 'Tablet', assignee: 'Equipo dirección', dept: 'Dirección', vendor: 'v4', warranty: '2027-06-04' },
  { id: 'd15', model: 'Lenovo Tab P12', serial: 'LTP12-V77Q', type: 'Tablet', assignee: 'Almacén', dept: 'Logística', vendor: 'v3', warranty: '2026-11-18' },
];

// ── Generate dates relative to today ─────────────────────────
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
function daysAhead(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

const INCIDENT_STATUSES = ['abierta', 'en_curso', 'esperando_pieza', 'esperando_proveedor', 'esperando_cliente', 'resuelta', 'cerrada'];
const PRIORITIES = ['baja', 'media', 'alta', 'critica'];

// Estados que pausan el SLA — el tiempo en estos estados no cuenta porque
// depende de un tercero externo al equipo.
const PAUSED_STATUSES = new Set(['esperando_pieza', 'esperando_proveedor', 'esperando_cliente']);
const CLOSED_STATUSES = new Set(['resuelta', 'cerrada']);

const INCIDENTS = [
  {
    id: 'INC-2026-0142', title: 'MacBook Pro no carga — posible problema de placa',
    description: 'El equipo no enciende ni con cargador original. LED no responde. Se prueba con otro cargador conocido y mismo resultado. Probable fallo de placa base o chip de gestión de carga.',
    deviceId: 'd7', priority: 'alta', status: 'esperando_pieza',
    assigneeId: 'u1', reporter: 'Andrea Solís',
    openedAt: daysAgo(6), updatedAt: daysAgo(1), slaHours: 48,
    diagnosis: 'Sin respuesta al cargador. Pruebas con cargador propio y de prestamo dan mismo resultado. Solicitada placa de sustitución vía Apple Business Care.',
    resolution: '',
    rmaId: 'RMA-2026-018',
    attachments: [
      { name: 'foto_placa.jpg', size: '2.4 MB' },
      { name: 'log_diagnostico.txt', size: '12 KB' },
    ],
    activity: [
      { type: 'created', at: daysAgo(6), by: 'Andrea Solís', text: 'Reportó la incidencia desde portal interno.' },
      { type: 'assigned', at: daysAgo(6), by: 'Sofía Castro', text: 'Asignó la incidencia a Marta Ferrer.' },
      { type: 'status', at: daysAgo(5), by: 'Marta Ferrer', text: 'Estado cambiado a En curso. Diagnóstico inicial en curso.' },
      { type: 'comment', at: daysAgo(4), by: 'Marta Ferrer', text: 'Confirmado fallo de carga. Cargador y cable descartados. Solicito RMA.' },
      { type: 'rma', at: daysAgo(3), by: 'Marta Ferrer', text: 'Abierto RMA-2026-018 con Apple Business Care.' },
      { type: 'status', at: daysAgo(3), by: 'Marta Ferrer', text: 'Estado cambiado a Esperando pieza.' },
    ],
  },
  {
    id: 'INC-2026-0141', title: 'Impresora atasca papel constantemente',
    description: 'La impresora de planta 2 atasca papel cada 3-4 hojas desde ayer. Se ha hecho limpieza básica sin éxito.',
    deviceId: 'd4', priority: 'media', status: 'en_curso',
    assigneeId: 'u3', reporter: 'Equipo planta 2',
    openedAt: daysAgo(2), updatedAt: daysAgo(0.2), slaHours: 72,
    diagnosis: 'Rodillo de arrastre desgastado. Pedido kit de mantenimiento.',
    resolution: '',
    attachments: [],
    activity: [
      { type: 'created', at: daysAgo(2), by: 'Equipo planta 2', text: 'Reportó la incidencia.' },
      { type: 'assigned', at: daysAgo(2), by: 'Sofía Castro', text: 'Asignó a Lucía Mendoza.' },
      { type: 'comment', at: daysAgo(1), by: 'Lucía Mendoza', text: 'Limpieza realizada, problema persiste. Inspeccionando rodillos.' },
      { type: 'status', at: daysAgo(0.5), by: 'Lucía Mendoza', text: 'Estado: En curso. Pedido kit de mantenimiento.' },
    ],
  },
  {
    id: 'INC-2026-0140', title: 'ThinkPad: pantalla con líneas verticales',
    description: 'Aparecen líneas verticales rosas/verdes en el panel cuando se mueve la pantalla. Posible cable o panel dañado.',
    deviceId: 'd5', priority: 'alta', status: 'esperando_pieza',
    assigneeId: 'u2', reporter: 'Pablo Núñez',
    openedAt: daysAgo(4), updatedAt: daysAgo(2), slaHours: 48,
    diagnosis: 'Líneas aparecen al flexionar bisagra. Confirma cable de pantalla (LVDS) dañado. RMA solicitado a Lenovo.',
    resolution: '',
    rmaId: 'RMA-2026-017',
    attachments: [{ name: 'video_pantalla.mp4', size: '8.1 MB' }],
    activity: [
      { type: 'created', at: daysAgo(4), by: 'Pablo Núñez', text: 'Reportó la incidencia con video adjunto.' },
      { type: 'assigned', at: daysAgo(4), by: 'Sofía Castro', text: 'Asignó a Javier Ruiz.' },
      { type: 'comment', at: daysAgo(3), by: 'Javier Ruiz', text: 'Test con monitor externo OK → descartado GPU.' },
      { type: 'rma', at: daysAgo(2), by: 'Javier Ruiz', text: 'Abierto RMA-2026-017 con Lenovo Premier Support.' },
    ],
  },
  {
    id: 'INC-2026-0139', title: 'Teclado externo MX Keys no se conecta por Bluetooth',
    description: 'El teclado se empareja pero pierde conexión a los pocos minutos. Probado en 2 equipos distintos con mismo resultado.',
    deviceId: 'd10', priority: 'baja', status: 'abierta',
    assigneeId: 'u4', reporter: 'Carlos Vega',
    openedAt: daysAgo(1), updatedAt: daysAgo(1), slaHours: 120,
    diagnosis: '',
    resolution: '',
    attachments: [],
    activity: [
      { type: 'created', at: daysAgo(1), by: 'Carlos Vega', text: 'Reportó la incidencia.' },
      { type: 'assigned', at: daysAgo(1), by: 'Sofía Castro', text: 'Asignó a Diego Almeida.' },
    ],
  },
  {
    id: 'INC-2026-0138', title: 'EliteBook se sobrecalienta y se apaga',
    description: 'El portátil se apaga solo tras 20-30 minutos de uso normal. Ventiladores suenan al máximo poco antes.',
    deviceId: 'd3', priority: 'media', status: 'en_curso',
    assigneeId: 'u1', reporter: 'Isabel Romero',
    openedAt: daysAgo(3), updatedAt: daysAgo(0.1), slaHours: 72,
    diagnosis: 'Pasta térmica seca. Limpieza de ventiladores + reaplicación de pasta en curso.',
    resolution: '',
    attachments: [],
    activity: [
      { type: 'created', at: daysAgo(3), by: 'Isabel Romero', text: 'Reportó la incidencia.' },
      { type: 'assigned', at: daysAgo(3), by: 'Sofía Castro', text: 'Asignó a Marta Ferrer.' },
      { type: 'status', at: daysAgo(2), by: 'Marta Ferrer', text: 'En curso. Plan: limpieza + cambio de pasta térmica.' },
    ],
  },
  {
    id: 'INC-2026-0137', title: 'Auriculares Jabra: micrófono no funciona en llamadas',
    description: 'Solo en Teams. En otras apps el micro funciona. Driver actualizado sin cambios.',
    deviceId: 'd11', priority: 'media', status: 'resuelta',
    assigneeId: 'u2', reporter: 'Atención cliente',
    openedAt: daysAgo(8), updatedAt: daysAgo(5), slaHours: 72,
    diagnosis: 'Conflicto entre driver Jabra y configuración de Teams. Permiso de micrófono revocado tras update.',
    resolution: 'Reactivado permiso de micrófono en preferencias del sistema. Validado en llamada de prueba.',
    attachments: [],
    activity: [
      { type: 'created', at: daysAgo(8), by: 'Atención cliente', text: 'Reportó la incidencia.' },
      { type: 'assigned', at: daysAgo(8), by: 'Sofía Castro', text: 'Asignó a Javier Ruiz.' },
      { type: 'comment', at: daysAgo(6), by: 'Javier Ruiz', text: 'Detectado permiso revocado.' },
      { type: 'resolved', at: daysAgo(5), by: 'Javier Ruiz', text: 'Resuelto: permisos restaurados.' },
    ],
  },
  {
    id: 'INC-2026-0136', title: 'OptiPlex de recepción reinicia aleatoriamente',
    description: 'Reinicios espontáneos varias veces al día. Sin patrón claro.',
    deviceId: 'd2', priority: 'alta', status: 'cerrada',
    assigneeId: 'u3', reporter: 'Recepción',
    openedAt: daysAgo(14), updatedAt: daysAgo(9), slaHours: 48,
    diagnosis: 'Fuente de alimentación defectuosa. Voltaje inestable medido con multímetro.',
    resolution: 'Sustituida fuente de alimentación bajo garantía Dell. Sin reinicios en 5 días.',
    rmaId: 'RMA-2026-016',
    attachments: [],
    activity: [
      { type: 'created', at: daysAgo(14), by: 'Recepción', text: 'Reportó la incidencia.' },
      { type: 'assigned', at: daysAgo(14), by: 'Sofía Castro', text: 'Asignó a Lucía Mendoza.' },
      { type: 'rma', at: daysAgo(12), by: 'Lucía Mendoza', text: 'Abierto RMA-2026-016 con Dell.' },
      { type: 'comment', at: daysAgo(10), by: 'Lucía Mendoza', text: 'Recibida nueva fuente. Sustituida.' },
      { type: 'resolved', at: daysAgo(9), by: 'Lucía Mendoza', text: 'Resuelto. Cerrada tras 5 días sin incidentes.' },
    ],
  },
  {
    id: 'INC-2026-0135', title: 'Monitor U2723QE: parpadeo intermitente',
    description: 'Parpadeo cada pocos minutos. Cable DisplayPort ya cambiado. Persiste.',
    deviceId: 'd9', priority: 'media', status: 'esperando_pieza',
    assigneeId: 'u1', reporter: 'Pablo Núñez',
    openedAt: daysAgo(5), updatedAt: daysAgo(3), slaHours: 72,
    diagnosis: 'Tras descartar cable y puerto del equipo, el monitor sigue parpadeando con otro equipo. Solicito sustitución.',
    resolution: '',
    rmaId: 'RMA-2026-019',
    attachments: [],
    activity: [
      { type: 'created', at: daysAgo(5), by: 'Pablo Núñez', text: 'Reportó la incidencia.' },
      { type: 'assigned', at: daysAgo(5), by: 'Sofía Castro', text: 'Asignó a Marta Ferrer.' },
      { type: 'rma', at: daysAgo(3), by: 'Marta Ferrer', text: 'Abierto RMA-2026-019 con Dell.' },
    ],
  },
  {
    id: 'INC-2026-0134', title: 'iPad Pro: batería se descarga en pocas horas',
    description: 'Descarga del 100% al 20% en menos de 3h de uso ligero.',
    deviceId: 'd14', priority: 'baja', status: 'abierta',
    assigneeId: 'u4', reporter: 'Equipo dirección',
    openedAt: daysAgo(1), updatedAt: daysAgo(1), slaHours: 120,
    diagnosis: '',
    resolution: '',
    attachments: [],
    activity: [
      { type: 'created', at: daysAgo(1), by: 'Equipo dirección', text: 'Reportó la incidencia.' },
      { type: 'assigned', at: daysAgo(1), by: 'Sofía Castro', text: 'Asignó a Diego Almeida.' },
    ],
  },
  {
    id: 'INC-2026-0133', title: 'Latitude 5540: tecla Enter no responde',
    description: 'La tecla Enter del teclado integrado no responde. Resto OK.',
    deviceId: 'd12', priority: 'baja', status: 'en_curso',
    assigneeId: 'u3', reporter: 'Elena Vargas',
    openedAt: daysAgo(2), updatedAt: daysAgo(0.5), slaHours: 120,
    diagnosis: 'Limpieza del teclado realizada sin éxito. Posible cambio de teclado.',
    resolution: '',
    attachments: [],
    activity: [
      { type: 'created', at: daysAgo(2), by: 'Elena Vargas', text: 'Reportó la incidencia.' },
      { type: 'assigned', at: daysAgo(2), by: 'Sofía Castro', text: 'Asignó a Lucía Mendoza.' },
    ],
  },
  {
    id: 'INC-2026-0132', title: 'MacBook Air: Wi-Fi lento e intermitente',
    description: 'En oficina la conexión cae cada 10-15 min. Otros equipos cerca van bien.',
    deviceId: 'd8', priority: 'alta', status: 'resuelta',
    assigneeId: 'u2', reporter: 'Miguel Bravo',
    openedAt: daysAgo(9), updatedAt: daysAgo(7), slaHours: 48,
    diagnosis: 'Antena Wi-Fi suelta tras un cambio reciente de SSD.',
    resolution: 'Reasentada antena. Sin cortes en 48h.',
    attachments: [],
    activity: [
      { type: 'created', at: daysAgo(9), by: 'Miguel Bravo', text: 'Reportó la incidencia.' },
      { type: 'assigned', at: daysAgo(9), by: 'Sofía Castro', text: 'Asignó a Javier Ruiz.' },
      { type: 'resolved', at: daysAgo(7), by: 'Javier Ruiz', text: 'Resuelto: antena reasentada.' },
    ],
  },
  {
    id: 'INC-2026-0131', title: 'ThinkCentre M90q de sala A no enciende',
    description: 'Equipo de sala de reuniones A no responde a botón de encendido. Sin LED.',
    deviceId: 'd6', priority: 'critica', status: 'abierta',
    assigneeId: 'u1', reporter: 'Equipo IT',
    openedAt: daysAgo(0.2), updatedAt: daysAgo(0.2), slaHours: 24,
    diagnosis: '',
    resolution: '',
    attachments: [],
    activity: [
      { type: 'created', at: daysAgo(0.2), by: 'Equipo IT', text: 'Reportó la incidencia (reunión importante en 1h).' },
      { type: 'assigned', at: daysAgo(0.2), by: 'Sofía Castro', text: 'Asignó a Marta Ferrer.' },
    ],
  },
  {
    id: 'INC-2026-0130', title: 'Latitude 7440: pide reproducir el fallo desde el usuario',
    description: 'Usuario reporta cuelgues aleatorios, pero no consigue reproducirlos. Solicitada información detallada por correo.',
    deviceId: 'd1', priority: 'media', status: 'esperando_cliente',
    assigneeId: 'u4', reporter: 'Carlos Vega',
    openedAt: daysAgo(5), updatedAt: daysAgo(2), slaHours: 72,
    diagnosis: 'Sin error claro reproducible. Pendiente de que el usuario envíe captura y hora exacta del próximo cuelgue.',
    resolution: '',
    attachments: [],
    activity: [
      { type: 'created', at: daysAgo(5), by: 'Carlos Vega', text: 'Reportó la incidencia.' },
      { type: 'assigned', at: daysAgo(5), by: 'Sofía Castro', text: 'Asignó a Diego Almeida.' },
      { type: 'status', at: daysAgo(4), by: 'Diego Almeida', text: 'Estado cambiado a En curso.', newStatus: 'en_curso' },
      { type: 'comment', at: daysAgo(3), by: 'Diego Almeida', text: 'Pruebas de estrés OK. Solicito al usuario fecha/hora exacta del próximo cuelgue.' },
      { type: 'status', at: daysAgo(2), by: 'Diego Almeida', text: 'Estado cambiado a Esperando cliente. SLA pausado.', newStatus: 'esperando_cliente' },
    ],
  },
  {
    id: 'INC-2026-0129', title: 'ProBook 450: confirmación de cobertura con HP',
    description: 'Pendiente respuesta de HP sobre si el daño físico (caída) está cubierto por la póliza ADP del cliente.',
    deviceId: 'd13', priority: 'baja', status: 'esperando_proveedor',
    assigneeId: 'u2', reporter: 'Almacén',
    openedAt: daysAgo(7), updatedAt: daysAgo(3), slaHours: 120,
    diagnosis: 'Pantalla agrietada por caída. Enviadas fotos y nº de serie a HP para evaluar cobertura ADP.',
    resolution: '',
    attachments: [{ name: 'foto_pantalla_grieta.jpg', size: '1.8 MB' }],
    activity: [
      { type: 'created', at: daysAgo(7), by: 'Almacén', text: 'Reportó la incidencia.' },
      { type: 'assigned', at: daysAgo(7), by: 'Sofía Castro', text: 'Asignó a Javier Ruiz.' },
      { type: 'comment', at: daysAgo(5), by: 'Javier Ruiz', text: 'Documentación enviada a HP. Esperando respuesta sobre cobertura ADP.' },
      { type: 'status', at: daysAgo(3), by: 'Javier Ruiz', text: 'Estado cambiado a Esperando proveedor. SLA pausado.', newStatus: 'esperando_proveedor' },
    ],
  },
];

const RMAS = [
  {
    id: 'RMA-2026-019', vendorRmaNumber: 'DL-RMA-87423-ES', vendorId: 'v1', deviceId: 'd9',
    incidentId: 'INC-2026-0135',
    reason: 'Parpadeo intermitente persistente tras descartar cable y equipo origen.',
    status: 'autorizado',
    requestedAt: daysAgo(3), authorizedAt: daysAgo(2), shippedAt: null, receivedAt: null, resolvedAt: null,
    replacementSerial: null,
    cost: 0,
    notes: 'Pendiente preparar envío. Etiqueta de retorno recibida.',
  },
  {
    id: 'RMA-2026-018', vendorRmaNumber: 'AP-RMA-2K3F92', vendorId: 'v4', deviceId: 'd7',
    incidentId: 'INC-2026-0142',
    reason: 'Equipo no carga. Fallo confirmado en circuito de gestión de carga.',
    status: 'enviado',
    requestedAt: daysAgo(3), authorizedAt: daysAgo(3), shippedAt: daysAgo(1), receivedAt: null, resolvedAt: null,
    replacementSerial: null,
    cost: 0,
    notes: 'Enviado por MRW con seguimiento 8842XX1F. ETA recepción 2 días.',
  },
  {
    id: 'RMA-2026-017', vendorRmaNumber: 'LV-PR-49281', vendorId: 'v3', deviceId: 'd5',
    incidentId: 'INC-2026-0140',
    reason: 'Cable de pantalla LVDS dañado. Reemplazo bajo Premier Support.',
    status: 'recibido',
    requestedAt: daysAgo(2), authorizedAt: daysAgo(2), shippedAt: null, receivedAt: daysAgo(0.5), resolvedAt: null,
    replacementSerial: null,
    cost: 0,
    notes: 'Técnico Lenovo on-site programado mañana 10:00.',
  },
  {
    id: 'RMA-2026-016', vendorRmaNumber: 'DL-RMA-87102-ES', vendorId: 'v1', deviceId: 'd2',
    incidentId: 'INC-2026-0136',
    reason: 'Fuente de alimentación defectuosa, voltaje inestable.',
    status: 'cerrado',
    requestedAt: daysAgo(12), authorizedAt: daysAgo(12), shippedAt: daysAgo(11), receivedAt: daysAgo(10), resolvedAt: daysAgo(9),
    replacementSerial: 'PSU-DL-9921HX',
    cost: 0,
    notes: 'Sustituida y validada. Cerrado.',
  },
  {
    id: 'RMA-2026-015', vendorRmaNumber: 'HP-CRC-37291', vendorId: 'v2', deviceId: 'd4',
    incidentId: null,
    reason: 'Tóner defectuoso (preventivo, no asociado a incidencia).',
    status: 'sustituido',
    requestedAt: daysAgo(18), authorizedAt: daysAgo(17), shippedAt: daysAgo(16), receivedAt: daysAgo(14), resolvedAt: daysAgo(13),
    replacementSerial: 'TNR-HP-49A-9981',
    cost: 0,
    notes: 'Recibido nuevo tóner, sustituido en planta 2.',
  },
];

// ── Seed: full initial state ─────────────────────────────────
function freshState() {
  return {
    technicians: TECHNICIANS,
    vendors: VENDORS,
    devices: DEVICES,
    incidents: INCIDENTS,
    rmas: RMAS,
    currentUserId: 'u1',
  };
}

// ── Storage layer ─────────────────────────────────────────────
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = freshState();
      fresh.incidents = migrateIncidents(fresh.incidents);
      return fresh;
    }
    const parsed = JSON.parse(raw);
    // Basic shape check
    if (!parsed.incidents || !parsed.rmas) return freshState();
    parsed.incidents = migrateIncidents(parsed.incidents);
    return parsed;
  } catch (e) {
    console.warn('Storage load failed, using fresh state', e);
    return freshState();
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Save failed', e);
  }
}

function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  const fresh = freshState();
  fresh.incidents = migrateIncidents(fresh.incidents);
  return fresh;
}

// ── Helpers ───────────────────────────────────────────────────
const STATUS_LABEL = {
  abierta: 'Abierta',
  en_curso: 'En curso',
  esperando_pieza: 'Esperando pieza',
  esperando_proveedor: 'Esperando proveedor',
  esperando_cliente: 'Esperando cliente',
  resuelta: 'Resuelta',
  cerrada: 'Cerrada',
};
const STATUS_BADGE = {
  abierta: 'red',
  en_curso: 'amber',
  esperando_pieza: 'purple',
  esperando_proveedor: 'blue',
  esperando_cliente: 'blue',
  resuelta: 'green',
  cerrada: 'gray',
};
const PRIORITY_LABEL = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' };

const RMA_STATUS_LABEL = {
  solicitado: 'Solicitado',
  autorizado: 'Autorizado',
  enviado: 'Enviado',
  recibido: 'Recibido',
  sustituido: 'Sustituido',
  cerrado: 'Cerrado',
};
const RMA_STATUS_BADGE = {
  solicitado: 'gray',
  autorizado: 'blue',
  enviado: 'amber',
  recibido: 'purple',
  sustituido: 'green',
  cerrado: 'gray',
};
const RMA_STATUS_ORDER = ['solicitado', 'authorized', 'enviado', 'recibido', 'sustituido', 'cerrado'];

function formatDate(iso, opts = {}) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (opts.relative) {
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 1) return 'ahora mismo';
    if (diffMin < 60) return `hace ${diffMin} min`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `hace ${diffH} h`;
    const diffD = Math.round(diffH / 24);
    if (diffD < 7) return `hace ${diffD} d`;
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  }
  if (opts.short) return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function slaProgress(incident) {
  const opened = new Date(incident.openedAt).getTime();
  const limit = opened + incident.slaHours * 3600 * 1000;
  const now = Date.now();
  const isPaused = PAUSED_STATUSES.has(incident.status);
  const isClosed = CLOSED_STATUSES.has(incident.status);

  // Tiempo total pausado: acumulado + pausa actual si está en curso
  let pausedMs = incident.slaTotalPausedMs || 0;
  if (isPaused && incident.slaPausedAt) {
    pausedMs += now - new Date(incident.slaPausedAt).getTime();
  }
  const effectiveElapsed = Math.max(0, (now - opened) - pausedMs);
  const total = limit - opened;
  const pct = Math.min(100, Math.max(0, (effectiveElapsed / total) * 100));
  const remainingMs = total - effectiveElapsed;

  let level = 'ok';
  if (pct >= 100) level = 'bad';
  else if (pct >= 70) level = 'warn';
  if (isPaused) level = 'paused';

  return { pct, level, remainingMs, isClosed, isPaused, pausedMs };
}

function slaText(incident) {
  const { remainingMs, isClosed, isPaused } = slaProgress(incident);
  if (isClosed) return 'cumplido';
  if (isPaused) return 'SLA en pausa';
  if (remainingMs <= 0) {
    const overH = Math.round(Math.abs(remainingMs) / 3600000);
    return `+${overH}h fuera de SLA`;
  }
  const h = Math.round(remainingMs / 3600000);
  if (h < 24) return `${h}h restantes`;
  return `${Math.round(h / 24)}d restantes`;
}

// ── Status transition helper ─────────────────────────────────
// Encapsula el cambio de estado para que la lógica de pausa de SLA
// quede en un solo sitio. Devuelve la incidencia actualizada.
function transitionIncident(incident, newStatus, byName) {
  const now = new Date().toISOString();
  const wasPaused = PAUSED_STATUSES.has(incident.status);
  const willPause = PAUSED_STATUSES.has(newStatus);
  let slaTotalPausedMs = incident.slaTotalPausedMs || 0;
  let slaPausedAt = incident.slaPausedAt || null;

  if (wasPaused && !willPause) {
    // Saliendo de pausa: acumular tiempo pausado
    if (slaPausedAt) {
      slaTotalPausedMs += Date.now() - new Date(slaPausedAt).getTime();
    }
    slaPausedAt = null;
  } else if (!wasPaused && willPause) {
    // Entrando en pausa: marcar inicio
    slaPausedAt = now;
  }
  // Si pasa de pausa a pausa (p.ej. esperando_pieza → esperando_proveedor)
  // mantenemos slaPausedAt — sigue pausado sin interrupción.

  return {
    ...incident,
    status: newStatus,
    slaTotalPausedMs,
    slaPausedAt,
    updatedAt: now,
    activity: [...(incident.activity || []), {
      type: 'status', at: now, by: byName || 'Sistema',
      text: `Estado cambiado a ${STATUS_LABEL[newStatus]}.${willPause && !wasPaused ? ' SLA pausado.' : (wasPaused && !willPause ? ' SLA reanudado.' : '')}`,
      newStatus,
    }],
  };
}

// ── Migration ───────────────────────────────────────────────
// Para datos seed antiguos o de versiones anteriores: añadir slaTotalPausedMs
// y, si está en estado pausado, inferir slaPausedAt del último cambio de
// estado encontrado en el activity log.
function migrateIncidents(incidents) {
  return incidents.map(inc => {
    if (inc.slaTotalPausedMs !== undefined && inc.slaPausedAt !== undefined) return inc;
    const isPaused = PAUSED_STATUSES.has(inc.status);
    let slaPausedAt = null;
    if (isPaused) {
      // buscar el último evento que mencione el cambio al estado pausado
      const events = [...(inc.activity || [])].reverse();
      const pauseLabel = STATUS_LABEL[inc.status];
      const match = events.find(a =>
        a.type === 'status' && (a.newStatus === inc.status || (a.text || '').includes(pauseLabel))
      );
      slaPausedAt = match ? match.at : inc.updatedAt;
    }
    return { ...inc, slaTotalPausedMs: 0, slaPausedAt };
  });
}

function exportCsv(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function nextIncidentId(state) {
  const max = state.incidents.reduce((acc, i) => {
    const m = i.id.match(/INC-\d{4}-(\d{4})/);
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
  }, 0);
  return `INC-2026-${String(max + 1).padStart(4, '0')}`;
}

function nextRmaId(state) {
  const max = state.rmas.reduce((acc, r) => {
    const m = r.id.match(/RMA-\d{4}-(\d{3})/);
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
  }, 0);
  return `RMA-2026-${String(max + 1).padStart(3, '0')}`;
}

// Expose globals for Babel scripts
Object.assign(window, {
  HSM_STORAGE: { loadState, saveState, resetState, freshState },
  HSM_DATA: {
    STATUS_LABEL, STATUS_BADGE, PRIORITY_LABEL,
    RMA_STATUS_LABEL, RMA_STATUS_BADGE,
    INCIDENT_STATUSES, PRIORITIES,
    PAUSED_STATUSES, CLOSED_STATUSES,
  },
  HSM_UTIL: {
    formatDate, slaProgress, slaText, exportCsv,
    nextIncidentId, nextRmaId, daysAgo,
    transitionIncident,
  },
});
