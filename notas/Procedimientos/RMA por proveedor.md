---
tags: [rma, procedimiento, proveedor]
aliases: []
updated: 2026-07-10
---

# RMA por proveedor

Cómo tramitar un RMA con un proveedor, paso a paso desde la ficha del RMA: consultar el **procedimiento propio del proveedor**, capturar los **datos de recogida/envío** (pop-up), **generar el correo** al proveedor y elegir el **destino del envío** (oficina / SAT / cliente).

Todo esto vive en el drawer del RMA (`src/components/rmas-v2/rma-detail-drawer.tsx`), pestaña **Detalle**. Los tres botones aparecen juntos: **Etiqueta**, **Datos de recogida/envío** y **Generar correo**. Ver [[Estados de RMA]] para saber en qué estado tocar cada cosa y [[Dominio]] para el modelo general.

## Idea de fondo

Cada proveedor se tramita distinto (email, portal web, formulario, si permite envío directo al cliente…). En vez de recordarlo de memoria, el procedimiento se **configura una vez en la ficha del proveedor** y la app lo muestra en el sitio donde se usa: el wizard de RMA y el drawer del RMA.

## Paso 1 — Consultar el procedimiento del proveedor

En la parte superior de la pestaña **Detalle** aparece el panel **"Cómo tramitar con {proveedor}"** (`src/components/providers/provider-rma-procedure.tsx`), que solo se muestra si el RMA tiene proveedor asignado.

Lee del proveedor el objeto `rmaProcess` (`ProviderRmaProcess` en `src/lib/db/schema/providers.ts`, columna jsonb `rma_process`) y muestra:

- **Método**: Solo email / Solo portal web / Portal + email de aviso (`method`).
- **Abrir portal / formulario**: enlace a `rmaUrl` o `formUrl` (se le antepone `https://` si falta).
- **Email del proveedor** (`emailTo`) como botón para copiarlo al portapapeles, y **CC** (`emailCc`) si lo hay.
- **Etiquetas** de aviso: "Requiere formulario/PDF" (`requiresForm` + `formType`) y, según `allowsDirectToClient`, **"Permite envío directo al cliente"** o **"Recogemos y enviamos nosotros"**.
- **Pasos** libres del procedimiento (`steps`), texto multilinea.

Si el proveedor no tiene procedimiento configurado, el panel avisa de que hay que editarlo en **Proveedores → {proveedor}**.

## Paso 2 — Capturar los datos de recogida/envío (pop-up)

Botón **"Datos de recogida/envío"** (icono camión). Abre `RmaShippingDialog` (`src/components/rmas-v2/rma-shipping-dialog.tsx`), que captura/confirma dónde recoge el mensajero y a dónde va el equipo. Se guarda en `rma.shipping` (jsonb `shipping`, tipo `RmaShipping` en `src/lib/db/schema/rmas.ts`) vía `updateRma`.

- **Se prellena** con lo que ya haya en el RMA/incidencia: nombre del local, contacto, teléfono, dirección, CP, ciudad… (con fallback a los campos `pickup*` y de contacto del RMA).
- **Autocompleta la ciudad desde el código postal** (5 dígitos) con `lookupSpanishCity` (`src/lib/utils/postal-code.ts`): best-effort, solo rellena si la ciudad está vacía o si la habíamos autocompletado nosotros, para **no pisar** una ciudad escrita a mano.
- **Sección "Cliente / recogida"**: nombre del local, persona de contacto, teléfono, email, dirección, CP, ciudad, provincia.
- **Sección "Envío"**: referencia (por defecto el nº de RMA), destino del envío (ver Paso 3) e instrucciones para el mensajero.
- **Dirección de destino** aparte: solo se rellena si es distinta de la de recogida.

Sirve para dos cosas: alimentar el **correo al proveedor** (Paso 4) y **preparar el envío** (TIPSA, de momento manual). Al guardar invalida la query `["rma-detail", rma.id]`.

## Paso 3 — Elegir el destino del envío

Dentro del pop-up de recogida/envío, el desplegable **"Destino del envío"** define a dónde va el equipo (`shipping.destination.type`):

- **Nuestra oficina** (`oficina`)
- **SAT del proveedor** (`sat`)
- **Directo al cliente** (`cliente`) — coherente con el flag `allowsDirectToClient` del proveedor del Paso 1.

Si el destino no coincide con la dirección de recogida, se rellena el bloque de **dirección de destino** (nombre/destinatario, contacto, dirección, CP, ciudad, provincia, teléfono). Ese destino se incluye en el correo (Paso 4) como bloque **"Destino del envío"**.

## Paso 4 — Generar el correo al proveedor

Botón **"Generar correo"** (icono sobre). Abre `RmaProviderEmail` (`src/components/rmas-v2/rma-provider-email.tsx`), que arma el correo con:

- **Destinatario (Para)** y **CC**: del procedimiento del proveedor (`emailTo`/`emailCc`); si no hay `emailTo` cae al `email` general del proveedor. Si sigue sin haber email, avisa y deshabilita "Abrir en correo" (hay que configurarlo en la ficha del proveedor).
- **Plantilla** (opcional): si existen plantillas de categoría **proveedor** (`fetchActiveTemplates` filtradas por `category === "proveedor"`, ver [[Operativa]]), se puede elegir una; si no, usa el **mensaje por defecto**. Las plantillas se rellenan con `renderTemplate` usando el contexto del RMA (nº RMA, proveedor, equipo, serie, cliente, datos de contacto/recogida, notas…).
- **Bloque de recogida/envío**: se añade **SIEMPRE** — tanto en el mensaje por defecto como de apéndice tras una plantilla (que no suele traer estos campos). Así el proveedor siempre recibe **dónde recoger** el equipo y, si aplica, el **destino del envío**.

Acciones del pop-up:

- **Copiar**: copia asunto + cuerpo al portapapeles.
- **Abrir en correo**: abre el cliente de correo con un enlace `mailto:` (para, CC, asunto y cuerpo ya rellenos).

## Notas operativas

- Orden recomendado: **1** revisar el procedimiento → **2/3** rellenar recogida y destino → **4** generar el correo (para que el correo salga con los datos de recogida completos).
- El correo **no se envía desde la app**: se abre en tu cliente de correo o se copia. No queda registro automático del envío.
- Los estados que pausan el SLA del RMA (p. ej. "Solicitado", "Enviado al Cliente") se explican en [[SLA y pausas]] y [[Estados de RMA]].
- Para etiquetar físicamente el equipo que se envía o que vuelve a oficina, ver [[Etiquetas QR]].

## Relacionado

- [[Estados de RMA]]
- [[SLA y pausas]]
- [[Etiquetas QR]]
- [[Operativa]]
- [[Dominio]]
- [[Escalaciones Intercom]]
- [[Plantilla - Procedimiento]]
- [[proyecto_log]]
- [[Inicio]]
