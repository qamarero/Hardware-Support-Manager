# Handoff — 2026-09-09 · Corcho: notas del equipo

Para retomar desde cualquier terminal. Todo lo descrito está en `main` y subido a GitHub.

---

## 1. Estado en una línea

El Corcho pasó de pintar incidencias automáticamente a ser un tablero de **notas que
escribe el equipo**. Está terminado, verificado contra datos reales y commiteado.
**Falta desplegarlo** (despliegue manual, es una restricción deliberada del equipo).

---

## 2. Qué hay que hacer para arrancar mañana

```bash
git pull                 # 3 commits nuevos, el último es f09c974
npm install              # por si acaso
```

**`.env.local` no está en el repo** (`.gitignore`) y hace falta para levantar en local.
Si el terminal nuevo no lo tiene:

1. `DATABASE_URL` → Vercel → equipo **Qamarero** → proyecto `hardware-support-manager`
   → Settings → Environment Variables → fila `DATABASE_URL` → menú `···` → *Copy to
   Clipboard* (copia el par `DATABASE_URL=...` entero, hay que quitarle el prefijo).
   Apunta al pooler: `hsm_app.thkrkubkiasfqmiiwfbj@aws-0-eu-west-3.pooler.supabase.com:6543`.
2. `NEXTAUTH_SECRET` → cualquier valor aleatorio nuevo sirve, solo firma sesiones locales:
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
3. `NEXTAUTH_URL=http://localhost:3000`

`BLOB_READ_WRITE_TOKEN` e Intercom **no hacen falta** para el corcho ni para Mi día.

**Login en local:** solo pide correo, no contraseña (ver §6). Con `domingo.bueno@qamarero.com` entra.

---

## 3. Commits de esta sesión

| Commit | Qué |
|---|---|
| `b04af18` | ✨ El corcho pasa a ser notas del equipo, con aviso en Mi día |
| `4f88fc4` | 🩹 Formulario que arrastraba la nota anterior, avatar real, pie que se partía |
| `f09c974` | 🚸 Dar por hecha ya no borra: tacha y es reversible |

Base: `6a10d29` (4-sep), que es **lo que sigue corriendo en producción**.

---

## 4. Cómo está construido (y por qué)

**Una nota del corcho ES un recordatorio.** No hay tabla nueva: se reutiliza
`hsm.reminders`, que ya tenía dueño, autor, vínculo polimórfico a incidencia/RMA,
título, texto y estado. Eso dio gratis completar, reasignar y posponer.

Migración **`sql/028-corcho-notas.sql` — YA APLICADA** en Supabase:

- `due_at` y `user_id` pasan a admitir nulo (nota sin fecha / para todo el equipo)
- `kind` (`nota` | `seguimiento`) — **imprescindible**: `ronda-actions.tsx:116` crea un
  recordatorio "Seguimiento X" por cada pulsación de «Siguiente paso» en la ronda diaria;
  sin separar los dos tipos el corcho se llenaría de automáticos
- `color` — papel del post-it, seis colores
- Tabla `hsm.reminder_views` — el "visto" **por persona**, distinto de "hecho"

**Estados de una nota:**

| Estado | En el corcho | En el aviso de Mi día |
|---|---|---|
| `pendiente` | Sí, a color | Sí, si me toca y no la he abierto |
| `hecho` | Sí, gris y tachada, al final | No |
| `descartado` | No (papelera) | No |

**Los tres botones de la nota:** ✏️ editar · ✓/↺ marcar hecha (reversible, **no borra**)
· 🗑️ papelera (lo único que la quita).

**El aviso de Mi día** cuenta las notas dirigidas a mí *o a todo el equipo* que aún no he
abierto. Abrir una la marca vista **solo para mí**; sigue en el tablero para los demás.

### Ficheros

```
sql/028-corcho-notas.sql                     migración (aplicada)
src/lib/db/schema/reminders.ts               due_at/user_id nullable, kind, color
src/lib/db/schema/reminder-views.ts          NUEVO — "visto" por persona
src/lib/constants/corcho.ts                  NUEVO — paleta y etiquetas
src/lib/validators/reminder.ts               corkNoteSchema / updateCorkNoteSchema
src/lib/validators/reminder.test.ts          NUEVO — 16 tests
src/lib/utils/date-format.ts                 formatRelativeShort ("3 min", "2 h")
src/server/queries/reminders.ts              getCorkNotes, getUnseenCorkNoteCount
src/server/actions/reminders.ts              createCorkNote, updateCorkNote,
                                             setCorkNoteDone, markCorkNoteSeen
src/components/tablero-v2/corcho-screen.tsx  reescrita
src/components/tablero-v2/note-editor.tsx    NUEVO — drawer de alta/edición
src/components/mi-dia/mi-dia-screen.tsx      tarjeta de aviso
src/app/proto-app.css                        estilos .postit__* y .cork__*
```

---

## 5. Pendiente inmediato

1. **Desplegar.** Manual, lo hace Domi. Producción sigue en `6a10d29`.
   El orden es seguro: la migración ya está aplicada y solo añade columnas anulables y
   una tabla, así que el código viejo convive con el esquema nuevo sin romperse.

2. **Tres notas de prueba en el tablero**, todas en estado `hecho` (se ven tachadas):
   - «Nota de Prueba» (vinculada a INC-2026-00092)
   - «Confirmar con el proveedor la fecha de recogida» (RMA-2026-00032)
   - «Revisar las etiquetas del lote de equipos reacondicionados»

   Se creyeron borradas con el botón viejo, pero solo quedaron ocultas. Para quitarlas
   de verdad hay que pasarles la papelera.

---

## 6. Hallazgos abiertos (salieron depurando, ninguno es de este cambio)

**Seguridad — el login no comprueba contraseña.**
[`src/lib/auth/config.ts:80`](../src/lib/auth/config.ts) tiene
`// TODO: Re-enable password verification` y `authorize()` valida solo que el correo
exista. Cualquiera que conozca un correo del equipo entra como esa persona, y la app
está publicada en `soporte.hardware.qamarero.com`.

**Seguridad — cinco rutas fuera del middleware.**
`isOnDashboard` en el mismo fichero es una lista blanca escrita a mano y le faltan
`/corcho`, `/mi-dia`, `/casos`, `/inventario` y `/tablero`. Renderizan sin sesión (las
server actions sí piden sesión, así que no filtran datos, pero la página se pinta).
Conviene invertirlo: proteger todo el grupo `(dashboard)` y excluir lo público.

**UX — error de login engañoso.** Un fallo de conexión a la base de datos se le muestra
al usuario como «No se encontró ninguna cuenta con ese correo electrónico».

**Documentación — CLAUDE.md desfasado** en el bloque de MCP: dice que `.mcp.json`
contiene la contraseña de `hsm_app` (tiene el placeholder
`postgresql://user:password@localhost:5432/dbname`) y que se eliminaron `web-fetch`,
`markitdown` y `figma` (siguen los tres en `.mcp.json`, y por eso fallan al conectar).

**Repo — `drizzle/` sin trackear.** Tres ficheros de migración generados por
`db:generate`, de antes de esta sesión. Decidir si se commitean o se ignoran.

---

## 7. Trampas conocidas

- **`npm run build` tumba el `next dev`**: comparten la carpeta `.next`. Parar el
  servidor antes de construir.
- **La consola de Windows es cp1252**: los `print` con acentos salen mal aunque el
  fichero esté bien en UTF-8. Verificar con `python -c "'ñ' in open(...).read()"`,
  no fiarse de lo que se ve en pantalla.
- **El MCP de Supabase pide OAuth interactivo** y no se puede autorizar desde una sesión
  no interactiva; los MCP `web-fetch`, `markitdown` y `figma` no conectan (ver §6).
- **Vercel no despliega solo**: es a propósito, no está roto.

---

## 8. Verificado el 9-sep contra la base de datos real

Crear nota suelta · crear nota vinculada a RMA-2026-00032 y asignada a un técnico ·
seis colores · aviso en Mi día pasando de «2 notas sin ver» a «1 nota sin ver» al abrir
una · editar nota existente · marcar hecha (tachada, se queda) · desmarcar (vuelve a
color) · avatar real del técnico en el pie.

`npm run build` correcto · `npm run lint` sin errores nuevos en los ficheros tocados ·
**210/210 tests**.
