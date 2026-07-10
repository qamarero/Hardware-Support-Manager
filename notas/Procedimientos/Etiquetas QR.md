---
tags: [rma, procedimiento, etiquetas]
aliases: []
updated: 2026-07-10
---

# Etiquetas QR

Etiquetas físicas con **QR + datos** para pegar en equipos que vuelven a la oficina (vía [[Estados de RMA|RMA]]) o que ya están aquí sin RMA (equipos previos a la herramienta). Al escanear el QR **con sesión iniciada** (el login persiste por dispositivo vía JWT), se abre la ficha del registro en la plataforma. Es el PROYECTO ⑩ del [[proyecto_log]].

El código y los textos viven en `src/components/etiquetas/label-print-client.tsx`; la ruta es `src/app/etiqueta/[tipo]/[id]/page.tsx`.

## Cómo generar una etiqueta

- **Desde la ficha de RMA**: botón **"Etiqueta"** (siempre naranja, al inicio de la fila de acciones).
- **Desde la tabla de RMA**: columna **"Etiqueta"** con icono de impresora por fila → abre la etiqueta en pestaña nueva sin entrar en la ficha. Pensado para etiquetar **lotes** de devoluciones.
- **Desde equipos**: botón etiqueta por fila en `/equipos`.

Todo abre la ruta `/etiqueta/{tipo}/{id}` (`tipo` = `rma` | `equipo`), con una barra de control superior (se oculta al imprimir).

## Dos formatos

En la barra superior se alterna entre:

- **Etiqueta 100×150** (`?f=etiqueta`) — `@page size: 100mm 150mm`, para la **etiquetadora local**. Contiene: marca Qamarero, nº grande en monoespaciada, QR central (50 mm), equipo, S/N, cliente/proveedor, estado y fecha.
- **Hoja A4 (envío)** (`?f=envio`) — A4 para **enviar a cliente/fabricante**: cabecera oficial, datos del equipo, **zona recortable**, normas y bloque de recepción.

El QR codifica `window.location.origin + recordPath`, es decir `/rmas/{id}` o `/equipos/{id}`.

## Hoja A4 de envío

Incluye una **zona recortable** (marcada con ✂ "Recortar y pegar en el equipo") con QR de 42 mm + nº + equipo/serie, para despegarla y adherirla al bulto.

### Dirección de recepción (real, Sevilla)

- Qamarero — Hardware Support
- P.º Alcalde Marqués del Contadero, s/n, Casco Antiguo
- 41001 Sevilla
- Horario: 9:00 – 18:00 · Tel.: 602 687 553 · hardware@qamarero.com

### Condiciones para aceptar la recepción

1. No envíes ningún equipo sin un nº de RMA autorizado por Qamarero. Los envíos sin RMA no se aceptarán y se devolverán a su origen.
2. El nº de RMA (`RMA-AAAA-NNNNN`) debe figurar visible en el exterior del bulto.
3. Recorta y pega en el equipo la etiqueta de esta hoja (zona superior).
4. Envía el equipo en su embalaje original o uno equivalente que lo proteja de golpes.
5. Incluye todos los accesorios relacionados con la avería (cargador, cables, soportes, etc.).
6. Conserva e indícanos el nº de seguimiento del envío para poder localizarlo.

> **Aviso en negrita de la hoja**: "Todo envío que no cumpla estas condiciones será rechazado y devuelto a su origen."

## Guardar como PDF

El nombre sugerido al **"Guardar como PDF"** (Chrome) es el `document.title`, que se fija a **`{cliente} - {nº}`** (p. ej. `Bar Manolo - RMA-2026-00042`). Así el archivo sale ya identificado por local y número de RMA. Al pulsar **Imprimir** se lanza `window.print()`.

## Notas de implementación

- Dependencia **`react-qr-code`** (QR como SVG, nítido al imprimir).
- Se usa un `BrandMark` **local** (viewBox `0 0 48 48`) en lugar del `QamareroLogo` compartido, porque este último recortaba el círculo naranja al imprimir.
- Las rutas `/etiqueta` y `/equipos` están añadidas a `isOnDashboard` en `src/lib/auth/config.ts` (requieren sesión).
- **Pendiente**: hoy la A4 solo se genera para RMA; para equipos aún es solo 100×150.

Para el resto del ciclo de vida de un RMA (estados, pausas de SLA, envío al proveedor), ver [[Estados de RMA]], [[SLA y pausas]] y [[RMA por proveedor]].

## Relacionado

- [[Estados de RMA]]
- [[RMA por proveedor]]
- [[SLA y pausas]]
- [[Operativa]]
- [[Ronda diaria]]
- [[Dominio]]
- [[proyecto_log]]
- [[Inicio]]
