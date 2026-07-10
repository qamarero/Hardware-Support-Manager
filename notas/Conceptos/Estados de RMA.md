---
tags: [rma, estados, concepto]
aliases: []
updated: 2026-07-10
---

# Estados de RMA

Estados por los que pasa un **RMA** (devolución de equipo al proveedor) a lo largo de su vida, con sus etiquetas reales y las transiciones permitidas. Es el equivalente para RMA de los [[Estados de incidencia]]; forma parte del [[Dominio]] de la app.

Definiciones reales en `src/lib/constants/rmas.ts` (estados + etiquetas), `src/lib/state-machines/rma.ts` (transiciones) y `src/lib/constants/statuses.ts` (grupos: abiertos, cerrados, pausados, almacén).

## No son secuenciales

Aunque la lista tenga un orden natural (borrador → solicitado → … → cerrado), **la app no impone una secuencia**. Desde el detalle del RMA se puede **forzar** el salto a cualquier estado (`force` en `src/components/rmas-v2/rma-detail-drawer.tsx`). La UI muestra los estados **sin dar impresión de secuencia obligatoria**: no reintroducir bloqueos lineales. Cada proveedor y cada caso tramitan distinto (ver [[RMA por proveedor]]).

## Lista de estados (valor → etiqueta)

| Valor interno | Etiqueta | Grupo | SLA |
|---|---|---|---|
| `borrador` | Borrador | Abierto · Almacén | corre |
| `solicitado` | Solicitado | Abierto | **⏸ pausa** |
| `aprobado` | Aprobado por Proveedor | Abierto · Almacén | corre |
| `enviado_proveedor` | Enviado a Proveedor | Abierto | **⏸ pausa** |
| `en_proveedor` | En Proveedor | Abierto | **⏸ pausa** |
| `devuelto` | Devuelto | Abierto | corre |
| `recibido_oficina` | Recibido en Oficina | Abierto · Almacén | corre |
| `enviado_cliente` | Enviado al Cliente | Abierto | **⏸ pausa** |
| `esperando_cliente` | Esperando al Cliente | Abierto | **⏸ pausa** |
| `entregado_cliente` | Entregado al Cliente | Cerrado | — |
| `rechazado` | Rechazado por Proveedor | Cerrado | — |
| `cerrado` | Cerrado | Cerrado | — |
| `cancelado` | Cancelado | Cerrado | — |

- **Abiertos** (`OPEN_RMA_STATUSES`): los 9 primeros. Son los que salen en la tabla de activos.
- **Cerrados** (`CLOSED_RMA_STATUSES`): `entregado_cliente`, `rechazado`, `cerrado`, `cancelado`. Ojo: `recibido_oficina` **ya no** es terminal, ahora es paso intermedio (equipo en oficina pendiente de entregar al cliente).
- **Almacén** (`WAREHOUSE_RMA_STATUSES`): `borrador`, `aprobado`, `recibido_oficina` — el equipo está en nuestra oficina, no con el proveedor.

## Estados que pausan el SLA

`PAUSED_RMA_STATES` = **`solicitado`, `enviado_proveedor`, `en_proveedor`, `enviado_cliente`, `esperando_cliente`**.

En estos estados la acción está **fuera de nuestro alcance** (esperamos aprobación del proveedor, el equipo va o está en su poder, o esperamos que el cliente confirme/recoja), así que el reloj de aging/plazo **no cuenta**. En el detalle aparece el aviso "⏸ SLA en pausa". Detalle completo del mecanismo en [[SLA y pausas]].

## Transiciones (flujo normal)

Definidas en `RMA_TRANSITIONS`. Todas requieren rol `admin` o `technician`; las cancelaciones tardías y las correcciones (retroceder un paso) son **solo `admin`**.

- **Borrador**: → Solicitado ("Enviar Solicitud") · → Cancelado
- **Solicitado**: → Aprobado ("Proveedor Aprueba") · → Rechazado · → Cancelado (admin)
- **Aprobado**: → Enviado a Proveedor ("Marcar Enviado") · → Cancelado (admin)
- **Enviado a Proveedor**: → En Proveedor ("Proveedor Recibe")
- **En Proveedor**: → Devuelto ("Proveedor Devuelve") · → Rechazado
- **Devuelto** (dos salidas según logística):
  - → Recibido en Oficina (nosotros intermediamos)
  - → Entregado al Cliente ("envío directo", el proveedor lo manda al cliente)
- **Recibido en Oficina**: → Entregar al Cliente · → Esperando al Cliente · → Enviar al Cliente
- **Enviado al Cliente**: → Cliente Recibe (entregado) · → volver a Recibido (corrección, admin)
- **Esperando al Cliente**: → Entregar al Cliente · → volver a Recibido (admin) · → Cancelar (admin)
- **Entregado al Cliente**: → Cerrar RMA
- **Rechazado**: → Cerrar RMA · → Cancelar (admin)

**Correcciones (admin)** para deshacer un paso mal marcado: En Proveedor → Enviado a Proveedor · Recibido en Oficina → Devuelto · Entregado al Cliente → Recibido en Oficina.

Helpers: `getRmaAvailableTransitions(status, role)` devuelve los botones que ve el usuario; `isValidRmaTransition(from, to, role)` valida en el servidor.

## Notas operativas

- Al cerrar (`entregado_cliente` o `cerrado`) la app pide registrar el **resultado** (reparado, sustituido, abono, rechazado, sin solución, sustitución directa). Al rechazar, el resultado se fija solo.
- `enviado_cliente` y `esperando_cliente` son las salidas que **pausan** mientras el equipo vuelve al cliente; úsalas para no penalizar el SLA por esperas ajenas.
- Un RMA suele nacer derivado de una incidencia (ver [[Operativa]]); imprime la [[Etiquetas QR]] para seguir el equipo físicamente.

## Relacionado

- [[Estados de incidencia]]
- [[SLA y pausas]]
- [[RMA por proveedor]]
- [[Prioridad binaria]]
- [[Dominio]]
- [[Operativa]]
- [[Etiquetas QR]]
- [[Plantilla - Concepto]]
- [[Inicio]]
