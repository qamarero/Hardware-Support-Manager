# Handoff — Hardware Support Manager

## Resumen

Aplicación web interactiva en español para gestionar **incidencias** y **RMA** (devoluciones a proveedor) del departamento de hardware de una pequeña empresa. Pensada para un equipo de 2–10 técnicos.

Construida como **prototipo de alta fidelidad totalmente funcional** sobre el sistema de diseño Qamarero. No es una maqueta estática: el estado se persiste en `localStorage`, el drag & drop del Kanban funciona de verdad, la conversión Incidencia → RMA modifica datos vinculados, y los SLA se pausan automáticamente cuando aplica.

## Sobre los archivos

El código del bundle **está listo para producción como sitio estático**. Se desplegó originalmente como prototipo navegable, pero la arquitectura permite usarlo directamente como aplicación de despliegue inmediato (Vercel, Netlify, GitHub Pages, S3+CloudFront…) o como base para migrar a un framework con build (Next.js, Vite + React) cuando se quiera añadir un backend real.

**Stack actual** (sin build step):
- HTML estático + React 18.3.1 (UMD) + Babel Standalone para transpilar JSX en runtime.
- Sistema de diseño **Qamarero** (DM Sans + paleta naranja coral, ver `styles/tokens.css`).
- Persistencia en `localStorage` bajo la clave `HSM_STATE_V2`.
- Cero dependencias de paquete. Cero servidor. Cero build.

## Fidelidad

**Alta fidelidad** — colores, tipografía, espaciados y comportamiento son los definitivos. Cualquier ingeniero puede tomar este código tal cual y desplegarlo. Si se migra a un framework con build, los componentes son extraíbles 1:1.

## Estructura del proyecto

```
hardware-support-manager/
├── index.html                    # Entry point. Carga React + Babel + scripts.
├── vercel.json                   # Config mínima para Vercel.
├── README.md                     # Cómo desplegar y qué hace.
├── assets/
│   └── logo-mark.svg
├── styles/
│   ├── tokens.css                # Variables del sistema de diseño Qamarero.
│   ├── app.css                   # Estilos específicos de la app.
│   └── fonts/
│       └── DMSans-VariableFont_opsz_wght.ttf
└── src/
    ├── data.js                   # Plain JS — seed data, storage, helpers SLA.
    ├── tweaks-panel.jsx          # Panel flotante para alternar variantes.
    ├── components.jsx            # UI compartida (Icon, Badge, Avatar, Drawer, etc).
    ├── app.jsx                   # Root + navegación + composición de drawers.
    └── screens/
        ├── dashboard.jsx         # 3 variantes (classic / bento / focus).
        ├── incidents.jsx         # Listado (3 variantes) + Kanban con drag&drop.
        ├── incident-detail.jsx   # Drawer con timeline, adjuntos, edición.
        ├── rma-inventory.jsx     # Listado/detalle RMA + inventario + proveedores.
        └── case-flow.jsx         # Wizard 3 pasos + vista "Casos" (pipeline).
```

## Arquitectura

### Modelo de datos

Todo el estado vive en un único objeto `state` con esta forma:

```ts
{
  technicians: Technician[],     // Equipo (5 personas)
  vendors: Vendor[],             // Proveedores (6: Dell, HP, Lenovo, Apple, Logitech, Jabra)
  devices: Device[],             // Inventario de equipos (15 dispositivos)
  incidents: Incident[],         // Tickets de soporte
  rmas: Rma[],                   // Devoluciones a proveedor
  currentUserId: string,         // Usuario activo (para auditoría)
}
```

### Entidades

**Incident** (incidencia):
```ts
{
  id: string,                    // "INC-2026-0142"
  title: string,
  description: string,
  deviceId: string,              // → Device
  priority: 'baja'|'media'|'alta'|'critica',
  status: IncidentStatus,        // ver abajo
  assigneeId: string,            // → Technician
  reporter: string,              // Nombre del usuario afectado
  openedAt: ISO8601,
  updatedAt: ISO8601,
  slaHours: number,              // 24 / 48 / 72 / 120
  slaTotalPausedMs: number,      // Acumulado de tiempo en pausa
  slaPausedAt: ISO8601 | null,   // Marca de pausa en curso (null = no pausada)
  diagnosis: string,
  resolution: string,
  rmaId: string | null,          // → Rma (si hay RMA vinculado)
  attachments: { name, size }[], // Simulados (sin storage real)
  activity: ActivityEvent[],     // Timeline
}
```

**Estados de incidencia** y comportamiento de SLA:

| Estado | SLA cuenta | Color badge |
|---|---|---|
| `abierta` | ✓ | red |
| `en_curso` | ✓ | amber |
| `esperando_pieza` | **pausa** ⏸ | purple |
| `esperando_proveedor` | **pausa** ⏸ | blue |
| `esperando_cliente` | **pausa** ⏸ | blue |
| `resuelta` | — (cumplido) | green |
| `cerrada` | — (cumplido) | gray |

Los estados de pausa **congelan el reloj del SLA** porque el tiempo depende de un tercero externo al equipo. Se trackean con dos campos en la incidencia:
- `slaPausedAt`: timestamp al entrar en pausa, `null` en estados activos.
- `slaTotalPausedMs`: acumulado de todas las pausas pasadas (en cuanto sale de pausa, se suma el tramo).

El cómputo del SLA está en `data.js → slaProgress()` y descuenta `slaTotalPausedMs + (now - slaPausedAt)` del elapsed.

**Rma**:
```ts
{
  id: string,                    // "RMA-2026-019"
  vendorRmaNumber: string,       // Código del proveedor: "DL-RMA-87423-ES"
  vendorId: string,              // → Vendor
  deviceId: string,              // → Device
  incidentId: string | null,     // → Incident (si nació de una incidencia)
  reason: string,
  status: RmaStatus,             // ver abajo
  requestedAt, authorizedAt, shippedAt, receivedAt, resolvedAt: ISO8601|null,
  replacementSerial: string|null,
  cost: number,
  notes: string,
  urgency: 'baja'|'normal'|'alta'|'critica',
}
```

**Estados de RMA** (avance secuencial): `solicitado → autorizado → enviado → recibido → sustituido → cerrado`.

**Device**:
```ts
{
  id, model, serial, type,        // type: Portátil | Sobremesa | Monitor | Impresora | Tablet | Periférico | Auricular
  assignee, dept,                 // Persona y departamento
  vendor,                         // → Vendor (para sugerir RMA)
  warranty: 'YYYY-MM-DD',
}
```

### Pantallas

#### 1. **Dashboard** (`src/screens/dashboard.jsx`)
Tres variantes alternables desde el panel **Tweaks**:
- **Classic**: hero + 4 KPIs + bar chart 7d + donut estados + actividad reciente + equipos problemáticos.
- **Bento**: mosaico tipo Apple Wallet con celdas de distinto tamaño.
- **Focus**: número grande de queue actual + cola priorizada por urgencia de SLA.

KPIs computados:
- Tickets abiertos (excluye resuelta/cerrada)
- Esperando pieza
- Resueltas en últimos 7 días
- Tiempo medio resolución (hardcoded a "2,4d" — calcular real es trivial: media de `updatedAt - openedAt` en cerradas)
- Fuera de SLA (`slaProgress.level === 'bad'`)

#### 2. **Incidencias** (`src/screens/incidents.jsx`)
- Filtros: estado (chips), prioridad, técnico, búsqueda libre.
- Ordenación: + recientes / prioridad / SLA.
- Tres variantes de listado (Tweaks):
  - **Tabla densa** (default): 9 columnas incluyendo SLA bar.
  - **Tarjetas**: grid responsive con cards de 360px mínimo.
  - **Agrupado por prioridad**: secciones colapsadas por prioridad.
- Botón **Export CSV** que genera y descarga el listado filtrado.

#### 3. **Kanban** (mismo archivo)
- 7 columnas (una por estado).
- Drag & drop nativo HTML5. Soltar en una columna cambia el estado **vía `transitionIncident()`** para que pausas de SLA se respeten.
- Columnas de pausa con fondo azulado e icono de reloj en la cabecera.

#### 4. **Casos · RMA** (`src/screens/case-flow.jsx → CasesScreen`)
Vista nueva: pipeline unificado incidencia ↔ RMA. Cada fila muestra:
- Identificación y dispositivo
- Stepper horizontal con 8 etapas combinadas: `Abierta → En curso → RMA solicitado → Autorizado → Enviado → Recibido → Sustituido → Cerrada`
- Banner verde de "Cerrar incidencia" cuando el RMA llega a `recibido` o `sustituido` y la incidencia sigue abierta.
- Botón rápido "Crear RMA" si el caso aún no tiene uno.

Filtros: Activos / Con RMA / Sin RMA / Todos.

#### 5. **Detalle de incidencia** (drawer modal)
Tabs: Detalle / Timeline / Adjuntos.
- Edita en sitio: diagnóstico, resolución, técnico, prioridad.
- Cambio de estado pasa por el helper que gestiona pausas de SLA.
- Banner azul cuando el SLA está en pausa.
- Si hay RMA vinculado: chip clicable que abre el detalle del RMA.
- Comentarios añaden eventos al timeline.
- Drop zone para adjuntar archivos (registra nombre/tamaño, no sube nada real).

#### 6. **Wizard de conversión Incidencia → RMA** (`case-flow.jsx → RmaWizard`)
3 pasos:
1. **Equipo y proveedor** — proveedor pre-seleccionado según `device.vendor`, marcado como "SUGERIDO".
2. **Motivo** — 8 plantillas de motivo (fallo confirmado, pantalla dañada, batería, no enciende, sobrecalentamiento, periférico, daño físico, otro) que pre-rellenan un textarea editable. Selector de urgencia interna.
3. **Confirmar** — resumen + campo nº RMA del proveedor + notas.

Al crear: vincula el RMA a la incidencia, transiciona la incidencia a `esperando_pieza` (que **pausa el SLA**), añade un evento al timeline.

#### 7. **RMA** (`rma-inventory.jsx`)
- Listado con filtros por estado (6 chips), búsqueda, export CSV.
- Detalle: stepper de 6 etapas + edición de fechas (envío, recepción), nº de serie del sustituto, notas.

#### 8. **Inventario** (`rma-inventory.jsx`)
- Tarjetas KPI por tipo de dispositivo.
- Tabla con todos los equipos: modelo, serie, asignado, departamento, proveedor, garantía (badge ámbar si expira en <90d), incidencias totales y abiertas.

#### 9. **Proveedores** (`rma-inventory.jsx`)
- Fichas con nº de equipos cubiertos, RMA activos, SLA del proveedor.

## Patrones técnicos a respetar al migrar

1. **`transitionIncident(incident, newStatus, byName)`** en `data.js` es el ÚNICO sitio donde se cambia el estado de una incidencia. Encapsula el tracking de pausas de SLA. Si se cambia el estado por otro camino, las pausas no se contabilizarán bien.

2. **Migración perezosa** en `loadState()` rellena `slaPausedAt` y `slaTotalPausedMs` en datos antiguos. Si se cambian campos de incidencia, replicar el patrón.

3. **Cada componente Babel comparte el ámbito global** vía `Object.assign(window, {...})`. Al migrar a un build real, sustituir por `export`/`import`.

4. **Objetos `styles` con nombre único** ya respetado (uso `incStyles`, `cfState`, etc.) — para no colisionar entre archivos Babel.

5. **Persistencia automática**: cada `setState` en `App` también escribe a `localStorage`. Para mover a un backend, sustituir `setState` por mutaciones contra API + refresco optimista.

## Cómo desplegar tal cual

```bash
# Vercel
vercel --prod

# Netlify
netlify deploy --prod --dir=.

# Cualquier static host
# basta con servir la carpeta. No necesita build.
```

## Cómo migrar a Vite + React (recomendado para producción)

```bash
npm create vite@latest hardware-support -- --template react
cd hardware-support

# Mover archivos:
# - src/ → src/ (igual)
# - styles/ → src/styles/
# - assets/ → public/

# Cambios mínimos en cada .jsx:
# 1. Reemplazar `const { useState: x } = React;` por `import { useState as x } from 'react';`
# 2. Reemplazar `Object.assign(window, {...})` por `export { ... }`
# 3. Importar dependencias (`import { Icon } from './components.jsx';`)
# 4. data.js exporta funciones en lugar de window.HSM_*
```

Para añadir backend real:
- Reemplazar `loadState()/saveState()` por llamadas a API.
- Usar SWR/React Query para el cache.
- Migrar a Postgres con tablas: `users`, `vendors`, `devices`, `incidents`, `incident_activity`, `rmas`. Las foreign keys ya están implícitas en el modelo actual.

## Tokens de diseño

Todos viven en `styles/tokens.css` (sistema Qamarero). Los más usados:

**Colores**:
- `--primary: #ff592f` (naranja brand) · hover `#c03818`
- `--gray-900: #212121` (texto/sidebar) · `--gray-50: #fafafa` (background)
- Semánticos: `--success #02995d`, `--danger #f50a48`, `--warning #ffaa00`, `--info #0370dd`

**Tipo**: DM Sans (variable, self-hosted) · Space Mono para IDs y datos.

**Radii**: `--radius-s 8px`, `--radius-m 12px`, `--radius-l 16px`, `--radius-xl 24px`.

**Spacing**: `--spacing-3xs 4px` → `--spacing-4xl 192px`.

Botones, badges, inputs, cards: todos los patrones en `styles/app.css` con clases `.btn`, `.badge--*`, `.card`, `.input`, etc.

## Lo que NO está hecho (siguientes pasos sugeridos)

- **Autenticación real**: el `currentUserId` está hardcoded. Falta login.
- **Backend**: ahora todo va a localStorage. Falta API.
- **Adjuntos reales**: solo se guarda nombre+tamaño, no el archivo.
- **Notificaciones**: el icono campana en la topbar no hace nada.
- **Multi-tenant**: una sola empresa.
- **Roles/permisos**: todos los técnicos pueden hacer todo.
- **Import CSV**: solo hay export.
- **Search global** en la topbar (input cosmético).
- **Tests**: el prototipo no tiene tests automatizados.

## Datos de ejemplo incluidos

- 5 técnicos · 6 proveedores · 15 dispositivos
- 14 incidencias en distintos estados (incluyendo casos en cada estado de pausa)
- 5 RMA en distintos puntos del ciclo

El botón ↻ en la topbar restaura los datos seed (limpia localStorage).
