import { NextResponse } from "next/server";
import { syncClientsFromCxAdvisor } from "@/lib/sync/cx-clients";
import { isCxAdvisorConfigured } from "@/lib/db/cx-advisor";

/**
 * Sincroniza los clientes desde CX Advisor.
 *
 * Lo llama el cron de Vercel (ver `vercel.json`). Vercel manda
 * `Authorization: Bearer $CRON_SECRET` en cada ejecución siempre que esa
 * variable esté definida en el proyecto, así que esa es la puerta.
 *
 * Queda fuera del middleware porque su matcher excluye `/api`, de modo que la
 * ruta se protege ella sola. Sin `CRON_SECRET` responde 503 en lugar de quedar
 * abierta: un despiste de configuración no puede dejar un endpoint que escribe
 * en la tabla de clientes al alcance de cualquiera.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300; // ~4.100 filas por lotes; sobra, pero acota

/**
 * Mensaje de error utilizable.
 *
 * Drizzle envuelve los fallos como «Failed query: <sql> params: <todos>». Con
 * lotes de 500 filas eso son decenas de kB de marcadores y UUID que esconden
 * lo único que importa, que es qué dijo Postgres — y el detalle real viene en
 * `cause`. Un fallo en el sync ya costó una ejecución a ciegas.
 */
function resumirError(err: unknown): string {
  if (!(err instanceof Error)) return "Error desconocido";
  const causa = (err as { cause?: unknown }).cause;
  const detalle =
    causa instanceof Error
      ? causa.message
      : typeof causa === "string"
        ? causa
        : undefined;
  // Se corta antes de "params:", donde empieza el volcado.
  const base = err.message.split("\nparams:")[0].slice(0, 400);
  return detalle ? `${detalle} — al ejecutar: ${base}` : base;
}

function autorizado(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET no está configurada en el entorno" },
      { status: 503 }
    );
  }
  if (!autorizado(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!isCxAdvisorConfigured()) {
    return NextResponse.json(
      { error: "OLCX_DATABASE_URL no está configurada" },
      { status: 503 }
    );
  }

  try {
    // ?dry=1 → simulación: cuenta lo que haría y no escribe nada. Pensado para
    // la primera vez, en que el sync no llena una tabla vacía sino que se
    // fusiona con ~3.700 clientes que ya estaban.
    const dryRun = new URL(request.url).searchParams.get("dry") === "1";
    const resultado = await syncClientsFromCxAdvisor({ dryRun });
    console.log("[sync-clients]", JSON.stringify(resultado));
    return NextResponse.json({ ok: true, ...resultado });
  } catch (err) {
    console.error("[sync-clients] error:", err);
    return NextResponse.json({ ok: false, error: resumirError(err) }, { status: 500 });
  }
}

/** El cron de Vercel dispara con GET; se delega en el POST con la misma auth. */
export async function GET(request: Request) {
  return POST(request);
}
