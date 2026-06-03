# Hardware Support Manager

Aplicación web interactiva para gestionar incidencias y RMA del departamento de hardware.

## Stack

HTML estático + React 18 + Babel standalone (sin build).
Persistencia en `localStorage` (clave `HSM_STATE_V1`).
Diseñado con el sistema **Qamarero**.

## Despliegue en Vercel

Es un sitio puramente estático. Despliega tal cual:

```bash
# Opción 1 — drag & drop en vercel.com
# Opción 2 — CLI
npm i -g vercel
vercel
```

No requiere `package.json`, build step ni framework. `vercel.json` solo activa `cleanUrls`.

## Estructura

```
index.html               ← entrada
styles/
  tokens.css             ← variables del DS Qamarero
  app.css                ← estilos de la app
  fonts/                 ← DM Sans variable
src/
  data.js                ← seed + helpers + storage
  components.jsx         ← UI compartida (badges, drawer, icons…)
  tweaks-panel.jsx       ← panel de variantes
  app.jsx                ← root + navegación
  screens/
    dashboard.jsx        ← 3 variantes (classic / bento / focus)
    incidents.jsx        ← 3 listados + kanban con drag&drop
    incident-detail.jsx  ← drawer con timeline + adjuntos + form
    rma-inventory.jsx    ← RMA list/detail/form + inventario + proveedores
assets/
  logo-mark.svg
```

## Funcionalidades

- **Dashboard** con 3 variantes (cambia desde Tweaks): clásico, bento, focus.
- **Listado de incidencias** con 3 variantes: tabla densa, tarjetas, agrupado por prioridad.
- **Kanban** con drag & drop entre estados.
- **Detalle de incidencia** con timeline, comentarios, adjuntos (simulados) y cambio de estado/asignado/prioridad.
- **Crear/editar incidencias** desde formulario.
- **Convertir incidencia → RMA** con un click.
- **RMA**: listado, detalle con stepper, formulario.
- **Inventario** de equipos con búsqueda y filtros.
- **Proveedores** con vista de fichas.
- **Export CSV** en todos los listados.
- **Persistencia** en localStorage (botón restaurar arriba a la derecha).

## Datos de ejemplo

15 equipos (Dell, HP, Lenovo, Apple, Logitech, Jabra), 6 proveedores, 5 técnicos,
12 incidencias con timelines y 5 RMA en distintos estados — todos en español.
