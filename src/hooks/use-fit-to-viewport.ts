"use client";

import { useLayoutEffect, useState } from "react";

/** Por debajo de esto la tabla sería un ventanuco: mejor que se desplace la página. */
const MIN_HEIGHT = 320;

/**
 * Alto máximo para que un elemento quepa en la ventana, desde donde empieza
 * hasta el borde inferior, sin desplazar la página. Pensado para tablas
 * anchas: con el alto acotado, su barra de scroll lateral queda siempre a la
 * vista en vez de al final de cientos de filas.
 *
 * Se mide en vez de fijarlo en CSS porque lo que hay encima cambia: la barra
 * superior pierde el buscador por debajo de 1180 px, los chips de estado
 * saltan de línea y la barra de acciones masivas aparece al seleccionar.
 *
 * Devuelve un callback ref —el elemento puede montarse más tarde, cuando
 * terminan de cargar los datos— y el alto, `undefined` hasta la primera medida.
 */
export function useFitToViewport<T extends HTMLElement>(bottomGap = 24) {
  const [el, setEl] = useState<T | null>(null);
  const [maxHeight, setMaxHeight] = useState<number>();

  useLayoutEffect(() => {
    if (!el) return;
    const update = () => {
      // Respecto al documento y no a la ventana: con la página ya desplazada,
      // el alto no debe cambiar.
      const top = el.getBoundingClientRect().top + window.scrollY;
      setMaxHeight(Math.max(MIN_HEIGHT, window.innerHeight - top - bottomGap));
    };
    update();
    // El padre cambia de tamaño cuando aparece o desaparece algo encima.
    const ro = new ResizeObserver(update);
    if (el.parentElement) ro.observe(el.parentElement);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [el, bottomGap]);

  return [setEl, maxHeight] as const;
}
