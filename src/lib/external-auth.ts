import { timingSafeEqual } from "crypto";

/**
 * Genérico: valida el header `X-API-Key` contra una env var arbitraria.
 *
 * Devuelve:
 *   - `null` si la auth es válida (el handler puede continuar).
 *   - `Response` con error JSON si falla:
 *     - 503 si la env var no está configurada en el server.
 *     - 401 si el header `X-API-Key` está ausente.
 *     - 403 si el header está presente pero no coincide.
 *
 * Usa `crypto.timingSafeEqual` para mitigar timing attacks. La comparación
 * requiere buffers del mismo length, así que comparamos length primero.
 */
function checkApiKey(req: Request, envVarName: string): Response | null {
  const expected = process.env[envVarName];
  if (!expected) {
    return Response.json(
      {
        error: `${envVarName} no configurada`,
        detail: `Set ${envVarName} env var in Vercel (Production + Preview) and redeploy.`,
      },
      { status: 503 },
    );
  }

  const provided = req.headers.get("x-api-key") ?? "";
  if (!provided) {
    return Response.json(
      { error: "Missing X-API-Key header" },
      { status: 401 },
    );
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "Invalid API key" }, { status: 403 });
  }

  return null;
}

/**
 * Valida el header `X-API-Key` contra `process.env.MAIN_PORTAL_API_KEY`.
 *
 * Pensado para endpoints `/api/external/metrics` consumidos por el HW Main Portal.
 * Mismo patrón que el endpoint equivalente de MainOps (`hw-SellGear-platform`).
 */
export function requireMainPortalAuth(req: Request): Response | null {
  return checkApiKey(req, "MAIN_PORTAL_API_KEY");
}

/**
 * Valida el header `X-API-Key` contra `process.env.HSM_PUBLIC_API_KEY`.
 *
 * Pensado para endpoints `/api/external/incidents` consumidos por
 * herramientas externas que necesitan acceso detallado a los datos
 * (incluyendo PII de cliente/contacto). El secret es DIFERENTE al de
 * Main Portal para que cada consumidor pueda rotarse de forma aislada.
 */
export function requirePublicApiAuth(req: Request): Response | null {
  return checkApiKey(req, "HSM_PUBLIC_API_KEY");
}
