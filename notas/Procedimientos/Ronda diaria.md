---
tags: [operativa, procedimiento, mi-dia]
aliases: []
updated: 2026-07-10
---

# Ronda diaria

La **Ronda** es el recorrido de seguimiento diario dentro de **Mi día** (PROYECTO ⑪). Da "memoria" al repaso de cada jornada: recorre tus incidencias y RMA **de las más antiguas a las más nuevas** y, en cada una, te deja hacer tres gestos: marcarla **revisada hoy**, registrar que **contactaste al cliente** y programar el **siguiente paso**. Reutiliza recordatorios, `event_logs` y la señal de [[Intercom]].

El objetivo es que ninguna incidencia vieja se quede sin tocar y que el equipo sepa qué está ya revisado sin pisarse.

## Cómo abrirla

- Está en **Mi día** (`/mi-dia`), a dos columnas: **Ronda** (principal) + **Recordatorios** (lateral).
- La cola = tus **incidencias abiertas** + **RMA activos**, ordenadas **+ antiguas primero**, quitando lo ya **revisado hoy**.
- Hay **dos vistas** de la misma cola:
  - **Tarjetas** (`src/components/mi-dia/ronda-tarjetas.tsx`): baraja gamificada, una ficha a la vez, con barra de progreso.
  - **Tabla** (`src/components/mi-dia/ronda-tabla.tsx`): repaso rápido en lista.

## Los cuatro gestos

### 1. Revisada hoy (COMPARTIDA con el equipo)

- Marca que **hoy** ya miraste esa incidencia/RMA. Se guarda en **base de datos** (tabla `hsm.daily_reviews`), **no** en tu navegador.
- Es **compartida**: si un compañero la marca revisada, **desaparece de la ronda de todos**. Evita que dos personas repasen lo mismo.
- Se **resetea solo cada día** (según la fecha **local** de tu equipo).
- La lista se **refresca cada minuto** para ver lo que marcan los demás (con actualización optimista al pulsar).
- En **Tarjetas**: botón **"Revisada · Siguiente"** (marca y avanza) o **"Saltar"** (avanza sin marcar).
- Hook: `src/hooks/use-daily-review.ts` (`isReviewed` / `markReviewed` / `unmark`).

### 2. Contacté al cliente (auditable)

- Botón **"Contacté"**. Deja un registro en `event_logs` con `action: "contacted"`, visible en el timeline de la ficha (icono de teléfono).
- **No** sincroniza con Intercom: es una marca **interna** del operador, no un mensaje al cliente.
- Es **la fuente de verdad** de si has respondido (por encima del hint de Intercom, ver más abajo).
- Acción de servidor: `src/server/actions/follow-up.ts` (`logContact`).

### 3. Siguiente paso (recordatorio + pausa de SLA)

- Botón **"Siguiente paso"** con presets: **Mañana**, **En 2 días**, **En 1 semana**, u **otra fecha**. Los presets caen a las **9:00**.
- Hace **dos cosas** a la vez:
  1. Crea un **recordatorio** ligado a la entidad (título "Seguimiento {número}"), que aparece en el lateral de Mi día.
  2. Pasa la entidad a **"Esperando al cliente"**, lo que **pausa el SLA** (ver [[SLA y pausas]]). Aplica a incidencias y RMA, con transición forzada.
- Componente: `NextStepButton` en `src/components/mi-dia/ronda-actions.tsx`.

### 4. Hint de Intercom (orientativo, NO autoritativo)

- Chip automático que dice **quién escribió el último mensaje público**:
  - Cliente último → *"El cliente escribió último — te toca"* (ámbar).
  - Nosotros últimos → *"Respondimos nosotros — revisa si el cliente pregunta algo"* (azul).
- Muestra el **último mensaje del cliente** y el **nuestro** (fragmento + hace cuánto) para que **juzgues tú**.
- **OJO**: es solo una **pista**. Que el último mensaje sea nuestro puede ser CX diciendo "mañana lo ve Hardware" mientras el cliente **sí** tiene algo pendiente. La verdad la fija tu marca manual **"Contacté"**.
- Lee vía `fetchIntercomConversation` (no toca la capa `src/lib/intercom/*`). En Tarjetas solo se consulta la **tarjeta visible** (1 llamada, no por fila).
- Hook: `src/hooks/use-client-reply-status.ts`.
- Complemento: **"Ver conversación"** abre el hilo de Intercom en un popup, y **"Intercom"** abre la conversación externa.

## Atajos (vista Tarjetas)

- **→** o **Enter** → marcar **revisada** y pasar a la siguiente.
- **S** → **saltar** (sin marcar).
- Se ignoran si estás escribiendo en un campo.

## Flujo recomendado

1. Abre **Mi día** → vista **Tarjetas**.
2. En cada ficha: mira el **hint de Intercom** para orientarte, decide.
3. Si escribiste al cliente → **Contacté**. Si toca esperar → **Siguiente paso** (recordatorio + pausa SLA).
4. **Revisada · Siguiente** para avanzar. Repite hasta "¡Ronda del día completada!".

## Notas y avisos

- El hint **nunca** decide por ti: confía en la marca **Contacté** y en la conversación real.
- "Revisada hoy" es un estado **efímero del día**, distinto de los [[Estados de incidencia]] o [[Estados de RMA]]; no cambia el estado real de la entidad.
- "Siguiente paso" **sí** cambia el estado (a Esperando al cliente) para pausar el SLA; ten en cuenta [[Prioridad binaria]] al priorizar tu recorrido.
- Ver el registro del proyecto en [[proyecto_log]] (sección PROYECTO ⑪).

## Relacionado

- [[Operativa]]
- [[Escalaciones Intercom]]
- [[SLA y pausas]]
- [[Estados de incidencia]]
- [[Estados de RMA]]
- [[Prioridad binaria]]
- [[Intercom]]
- [[proyecto_log]]
- [[Inicio]]
