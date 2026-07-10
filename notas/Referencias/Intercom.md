---
tags: [referencia, intercom]
aliases: []
updated: 2026-07-10
---

# Intercom

Datos de referencia de la integración con **Intercom**: identificadores fijos, cliente de API, webhook y sincronización. Es la fuente de las escalaciones que llegan a HSM. Para el flujo de trabajo (cómo convertir una escalación en incidencia) ve a [[Escalaciones Intercom]].

> 🔒 **Intercom es INTOCABLE.** No se edita `src/lib/intercom/*`, ni las server actions de notas/bandeja, ni el webhook, sin pasar el gate de verificación descrito en [[Escalaciones Intercom]] y en [[ONBOARDING]].

## Identificadores fijos

| Dato | Valor | Para qué sirve |
|---|---|---|
| Workspace / `app_id` | `hckfnffg` | Construir las **URLs de conversación** de Intercom. App privada "Hw sync HSM". |
| Admin ID | `8601230` (**Domi**) | Admin que **firma las notas automáticas** que HSM publica en Intercom. Sin él las notas fallan en silencio (el default `"0"` las rechaza). |
| Versión de API | **REST v2.11** | Cabecera `Intercom-Version: 2.11` en todas las llamadas. |
| Base de API | `https://api.intercom.io` | Host de todas las peticiones. |

## Cliente de API — `src/lib/intercom/client.ts`

Todas las llamadas pasan por `intercomFetch`, que añade el token `Bearer` (variable `INTERCOM_ACCESS_TOKEN`), el `Content-Type`, `Accept` y la cabecera de versión `2.11`. Si el token no está configurado, lanza error.

Funciones exportadas:

- `getConversation(conversationId)` — trae la conversación con sus mensajes (`?display_as=plaintext`).
- `getContact(contactId)` — contacto por ID.
- `searchContacts(query)` — busca por email (`=`) o nombre (`~`) vía `POST /contacts/search`.
- `addNote(conversationId, body, adminId)` — añade **nota interna** (`message_type: "note"`) a una conversación. Es la que usa la sync para escribir de vuelta.
- `tagConversation(conversationId, tagId, adminId)` — etiqueta una conversación.
- `closeTicket(ticketId)` — cierra un ticket (`PUT /tickets/{id}` → `state: "resolved"`).

> ⚠️ **`closeTicket` NO se usa actualmente desde la sync.** El `intercomEscalationId` que guardamos suele ser un `conversation_id`, no un `ticket_id`, y la API rechaza el `PUT` con el ID equivocado. Mientras tanto, la sync añade una **nota** avisando de que el ticket puede cerrarse. El cierre automático real queda pendiente (habría que resolver el ticket vinculado desde la conversación).

## Webhook entrante — `POST /api/webhooks/intercom`

Punto de entrada de las escalaciones. Recibe conversaciones/tickets desde la app de Intercom (workspace `hckfnffg`) y los vuelca en la cola de la Bandeja. La verificación usa `INTERCOM_WEBHOOK_SECRET` (HMAC); las apps privadas pueden no firmar, con fallback a validación de estructura. Solo se capturan escalaciones de Hardware/RMA (filtrado por palabras clave). Detalle del filtrado y la deduplicación en [[Escalaciones Intercom]].

## Sincronización — `src/lib/intercom/sync.ts`

Sincronización **de vuelta** hacia Intercom cuando una incidencia está vinculada a una escalación:

- En cada **transición de estado** de la incidencia se publica una nota interna con la etiqueta del estado nuevo (vía `addNote`, firmada por el admin `8601230`).
- Al **resolver/cerrar**, se publica una nota indicando que el ticket puede cerrarse (el cierre automático del ticket está pendiente; ver arriba).

## Variables de entorno relacionadas

Ver [[Variables de entorno]] para el detalle. Las tres de Intercom:

- `INTERCOM_ACCESS_TOKEN` — API key para las llamadas v2.11.
- `INTERCOM_WEBHOOK_SECRET` — verificación HMAC del webhook entrante.
- `INTERCOM_ADMIN_ID` — `8601230` (Domi); firma las notas automáticas.

## Relacionado

- [[Escalaciones Intercom]] — procedimiento: de la escalación a la incidencia (gate de verificación incluido)
- [[Ronda diaria]] — el hint de respuesta del cliente en "Mi día" es orientativo, no autoritativo
- [[Variables de entorno]] — las tres claves de Intercom
- [[Arquitectura]] — dónde encaja el webhook y la sync en HSM
- [[Estados de incidencia]] — las transiciones que disparan las notas de sync
- [[Deploy]] — la app "Hw sync HSM" y el redeploy tras cambiar variables
- [[Supabase]] — la tabla de la bandeja (`intercom_inbox`)
- [[Inicio]] · [[Cómo usar esta bóveda]]
- [[ONBOARDING]] · [[CLAUDE]]
