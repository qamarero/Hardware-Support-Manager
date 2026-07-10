---
tags: [intercom, procedimiento, bandeja]
aliases: []
updated: 2026-07-10
---

# Escalaciones Intercom

Cómo una conversación de [[Intercom]] llega a HSM, cómo se revisa en la **Bandeja Intercom** (`/intercom`) y cómo se convierte en incidencia. Esto lo lee el equipo de soporte: es operativo, no teoría. Para el panorama general de la integración ver [[Intercom]] y [[Arquitectura]].

## El flujo de un vistazo

1. En Intercom se escala una conversación/ticket a hardware.
2. Intercom dispara un webhook a `POST /api/webhooks/intercom`.
3. El webhook filtra por reglas de captura y guarda una ficha en la tabla `intercom_inbox`.
4. La ficha aparece en la **Bandeja Intercom** (`/intercom`), pestaña **Pendientes**.
5. El equipo revisa y pulsa **"Crear Incidencia"** (conversión inline) o **"Descartar"**.
6. Al convertir, nace una incidencia en estado `nuevo` (ver [[Estados de incidencia]]) enlazada a la conversación.

Código: webhook en `src/app/api/webhooks/intercom/route.ts`; acciones de bandeja en `src/server/actions/intercom-inbox.ts`.

## Qué se captura (y qué se descarta)

El webhook decide con `isRelevantEscalation()` usando **reglas de captura configurables** desde Ajustes (`getIntercomCaptureRules`, con fallback a `DEFAULT_INTERCOM_CAPTURE_RULES`). Se captura si coincide alguna de:

- **Keyword** en el texto o en los atributos (subject, título, cuerpo, tags, `custom_attributes`, `ticket_attributes`).
- **Tipo de ticket** concreto (p. ej. "Folio de atención backoffice escalado a hardware").
- **Tag** concreto.

Comportamiento según el resultado:

- **Sin `conversationId` extraíble** → se ignora (no se guarda nada).
- **No relevante** → se guarda igualmente con `status = "descartada"` y `discardReason = "webhook_no_keyword_match"`. Así la pestaña **Descartadas** sirve para auditar el filtro (no se pierde nada silenciosamente).
- **Relevante** → se guarda como pendiente y se enriquece con datos del contacto y la empresa (nombre, email, teléfono, restaurante, nº de serie) vía API de Intercom.

## Deduplicación

La unicidad se sostiene sobre `intercom_conversation_id`:

- En el webhook, el guardado usa `onConflictDoNothing` / `onConflictDoUpdate` sobre esa columna, así que reintentos del webhook son **idempotentes** (no duplican fichas).
- Al **convertir a incidencia** se comprueba además `incidents.intercomEscalationId`: si ya existe una incidencia para esa conversación, la conversión se rechaza indicando el número existente (p. ej. "Ya existe la incidencia INC-…").

## Importar bajo demanda (URL o ID)

Cuando una conversación **no llegó por webhook** (los filtros la silenciaron, es anterior al webhook, etc.) se puede traer a mano con `importIntercomConversation(urlOrId)`:

- Acepta una **URL de Intercom** o un **ID numérico**; el ID se extrae con `extractConversationId` (tolera varios formatos de URL). Salta el filtro de keywords porque es una importación **explícita**.
- Si la conversación **ya existe** en la bandeja:
  - Estado `convertida` → **no** se re-triage; solo se devuelve para que la UI navegue a su ficha.
  - Estado `pendiente` o `descartada` → se **reabre en Pendientes** y se sube arriba del todo (`status = "pendiente"`, se limpian los campos de descarte y se refresca `receivedAt`). No se duplica fila.
- Si **no existe** → trae la conversación (`getConversation`), enriquece el contacto (`getContact`) e inserta una ficha nueva en `pendiente`.

Regla práctica: importar una conversación ya conocida **siempre** la deja lista arriba de Pendientes para aprobar o descartar sin buscarla entre la paginación.

## Acciones de la bandeja

- **Crear Incidencia** (`convertToIncident`): valida los datos, crea la incidencia en una transacción con nº secuencial (`INC-YYYY-NNNNN`), estado `nuevo`, **auto-asigna al técnico** que convierte (reasignable después), guarda `intercomUrl` + `intercomEscalationId`, marca la ficha como `convertida` y registra un evento en el log de auditoría.
- **Descartar** (`dismissInboxItem`): pasa la ficha a `descartada` y guarda quién y cuándo.
- **Restaurar** (`restoreInboxItem`): devuelve una descartada a `pendiente`.
- **Recuperar descartada** (`recoverDiscardedInboxItem`): pendiente + limpia `discardReason`.
- **Ver conversación** (`fetchIntercomConversation`): reconstruye el hilo completo (mensaje inicial + respuestas + notas) para mostrarlo en la bandeja y en la ficha.

## Sincronización hacia Intercom (HSM → Intercom)

Definida en `src/lib/intercom/sync.ts`. Todo es **fire-and-forget**: registra errores pero nunca bloquea la operación de HSM. Requiere `INTERCOM_ADMIN_ID` configurado (ver [[Variables de entorno]]); sin él, las notas no se publican.

- **Al transicionar una incidencia** (`syncIncidentTransition`): publica una **nota interna** en la conversación con el cambio de estado (`Estado: X → Y`) y el comentario opcional.
- **Estados terminales** (`resuelto` / `cerrado`): la nota añade un aviso de que el folio **puede cerrarse**. Ojo: el cierre del ticket **no** es automático todavía (queda pendiente); el equipo de CX lo cierra a mano.
- **Nota manual** (`syncManualNote`): un técnico puede empujar una nota; se prefija con su nombre porque la API postea siempre con el mismo `admin_id`.
- **Al transicionar un RMA** (`syncRmaTransition`): misma idea; como el RMA no lleva referencia de Intercom directa, el llamador pasa los campos de la incidencia enlazada. Ver [[Estados de RMA]] y [[RMA por proveedor]].

## Relacionado

- [[Intercom]]
- [[Arquitectura]]
- [[Operativa]]
- [[Ronda diaria]]
- [[Estados de incidencia]]
- [[Estados de RMA]]
- [[RMA por proveedor]]
- [[Variables de entorno]]
- [[Inicio]]
- [[Cómo usar esta bóveda]]
- [[Plantilla - Procedimiento]]
