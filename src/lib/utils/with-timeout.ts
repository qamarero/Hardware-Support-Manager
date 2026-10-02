/**
 * Acota una promesa en el tiempo.
 *
 * Next encola las Server Actions y ejecuta una cada vez. Si una queda
 * descartada —por ejemplo al navegar mientras está en vuelo— su promesa no se
 * resuelve NI se rechaza nunca: React Query se queda en «pendiente» y la
 * pantalla muestra un spinner para siempre, sin error y sin reintento. Es lo
 * que tuvo bloqueada /consulta.
 *
 * Con esto, un cuelgue se convierte en un error normal, que la pantalla sí
 * sabe enseñar y reintentar. No cancela nada por debajo: solo deja de esperar.
 */
export function withTimeout<T>(
  promesa: Promise<T>,
  ms = 20000,
  mensaje = "La consulta tardó demasiado"
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(mensaje)), ms);
    promesa.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}
