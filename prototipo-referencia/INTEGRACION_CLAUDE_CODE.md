# Integración en tu proyecto con Claude Code

Esta guía te dice **exactamente qué hacer** para llevar el diseño y la lógica de este
prototipo a tu app real, trabajando con Claude Code sobre tu repositorio.

---

## Paso 1 — Mete estos archivos en tu repo

Copia la carpeta completa del prototipo dentro de tu proyecto, por ejemplo en
`/prototipo-referencia/`. Así Claude Code puede leerla como referencia sin mezclarla
todavía con tu código de producción.

```
tu-repo/
├── (tu código actual…)
└── prototipo-referencia/        ← descomprime aquí el zip que te pasé
    ├── README.md                 ← documentación técnica completa
    ├── index.html
    ├── src/
    ├── styles/
    └── assets/
```

Haz commit de esa carpeta para tenerla versionada:

```bash
git add prototipo-referencia
git commit -m "Añade prototipo de referencia (diseño + lógica incidencias/RMA)"
```

---

## Paso 2 — Pega este prompt en Claude Code

Abre Claude Code en la raíz del repo y pégale esto (ajusta lo que está entre `«»`):

> Tengo un prototipo de referencia en `prototipo-referencia/`. Es una app de gestión de
> incidencias y RMA de hardware, hecha en React (vía Babel en runtime) con datos ficticios
> en localStorage. Quiero **integrar su diseño y su lógica en mi app real**, que está en
> «describe tu stack: p.ej. Next.js 14 con App Router / Vite + React / etc.» y cuyos datos
> viven en «describe dónde: p.ej. Postgres con Prisma / Supabase / Airtable / un Excel que
> quiero migrar».
>
> Antes de escribir código:
> 1. Lee `prototipo-referencia/README.md` entero — documenta el modelo de datos, las
>    pantallas y los patrones técnicos (sobre todo `transitionIncident()` y el cómputo de
>    SLA con pausas).
> 2. Revisa mi código actual y dime un **plan de integración por fases**: qué componentes
>    porto tal cual, qué hay que adaptar, y cómo reemplazo la capa de datos (localStorage)
>    por mi backend real.
> 3. No empieces a codificar hasta que validemos el plan.

Claude Code te devolverá un plan. Revísalo con él antes de dejar que toque nada.

---

## Paso 3 — Las 3 cosas que SÍ o SÍ hay que adaptar

El 80% del prototipo es reutilizable tal cual. Solo estas 3 piezas tocan datos reales:

### 1. La capa de datos (`src/data.js`)

Hoy hace esto:

```js
function loadState() { /* lee de localStorage */ }
function saveState(state) { /* escribe en localStorage */ }
```

Hay que reemplazarlo por llamadas a tu backend. **Nada más del prototipo lee localStorage
directamente** — toda la app pasa por el objeto `state` y por `setState`. Ese es el único
punto de acoplamiento.

### 2. El modelo de datos → tus tablas reales

El prototipo usa estas entidades (detalladas en el README). Tu base de datos debería tener
tablas equivalentes:

| Entidad prototipo | Tabla sugerida | Notas |
|---|---|---|
| `incidents` | `incidencias` | incluye campos de SLA (`slaHours`, `slaPausedAt`, `slaTotalPausedMs`) |
| `incident.activity[]` | `incidencia_eventos` | el timeline, una fila por evento |
| `rmas` | `rmas` | FK a incidencia origen |
| `devices` | `equipos` | inventario |
| `vendors` | `proveedores` | |
| `technicians` | `usuarios` / `tecnicos` | aquí conectas tu login real |

### 3. El usuario actual (`state.currentUserId`)

En el prototipo está fijo. En real, sale de tu sistema de login (cada técnico el suyo) —
así el campo "quién hizo qué" en el timeline queda bien atribuido.

---

## Paso 4 — Lógica que debes CONSERVAR intacta

Estas funciones son lógica de negocio pura (no dependen de datos ficticios). Pórtalas tal
cual; aquí está el valor real de la app:

- **`transitionIncident(incident, nuevoEstado, autor)`** — el ÚNICO sitio donde cambia el
  estado de una incidencia. Gestiona la pausa/reanudación del SLA. Si cambias estados por
  otro camino, los SLA no se calcularán bien.
- **`slaProgress(incident)`** — calcula % de SLA consumido descontando el tiempo en pausa.
- **Estados que pausan SLA**: `esperando_pieza`, `esperando_proveedor`, `esperando_cliente`.
- **El wizard de conversión Incidencia → RMA** — al crear el RMA vincula ambas entidades y
  pasa la incidencia a "esperando pieza".

---

## Paso 5 — Migrar tus datos actuales

Si hoy tienes las incidencias/equipos en un Excel, CSV o similar:

- Pídele a Claude Code que escriba un **script de importación** que lea tu fichero y rellene
  las tablas. El formato de cada entidad está en el README.
- O pásame a mí el export (CSV/Excel) y te preparo el seed real ya formateado, listo para
  cargar.

---

## Recomendación de stack si aún no lo has decidido

Para una herramienta interna de un equipo de 2-10 técnicos, lo más rápido y robusto:

- **Next.js** (o Vite + React) para el front — los componentes del prototipo encajan directo.
- **Supabase** para datos + login: Postgres gestionado, API automática y autenticación
  incluida. Reemplazas `loadState/saveState` por llamadas al cliente de Supabase y tienes
  multiusuario real casi sin esfuerzo.
- **Vercel** para desplegar (ya lo tenías pensado).

Si me confirmas el stack que vas a usar, te genero el esquema SQL de las tablas y el código
de la capa de datos ya escrito para que Claude Code solo tenga que enchufarlo.
