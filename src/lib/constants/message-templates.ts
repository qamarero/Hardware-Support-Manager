export const TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
  cliente: "Cliente",
  proveedor: "Proveedor",
};

export type TemplateCategory = "cliente" | "proveedor";

/**
 * Catálogo maestro de variables de plantilla.
 *
 * `in` dice desde qué generador se puede rellenar cada una. Importa porque
 * `renderTemplate` deja `{{loQueNoConoce}}` tal cual, y una plantilla que use
 * una variable ajena a su contexto sale con el hueco literal — que es lo que
 * acabó pasando en el correo al proveedor con `{{incidentNumber}}` y
 * `{{description}}`. Con esto el insertador solo ofrece lo que se va a poder
 * sustituir de verdad.
 *
 * Deliberadamente fuera del correo al proveedor: `intercomUrl` e
 * `intercomEscalationId`, que son enlaces internos sin valor para él. Se siguen
 * rellenando si una plantilla antigua los usa, pero no se sugieren.
 */
const TEMPLATE_VARIABLES = [
  // Identificación
  { key: "incidentNumber", label: "Nº incidencia", in: ["cliente", "proveedor"] },
  { key: "rmaNumber", label: "Nº RMA", in: ["proveedor"] },
  { key: "providerRmaNumber", label: "Nº RMA proveedor", in: ["proveedor"] },
  { key: "providerName", label: "Proveedor", in: ["proveedor"] },
  // La incidencia
  { key: "title", label: "Título", in: ["cliente", "proveedor"] },
  { key: "description", label: "Descripción", in: ["cliente", "proveedor"] },
  { key: "status", label: "Estado", in: ["cliente", "proveedor"] },
  { key: "category", label: "Categoría", in: ["cliente", "proveedor"] },
  { key: "hardwareOrigin", label: "Origen hardware", in: ["cliente", "proveedor"] },
  { key: "priority", label: "Prioridad", in: ["cliente", "proveedor"] },
  { key: "notes", label: "Notas del RMA", in: ["proveedor"] },
  // Cliente y equipo
  { key: "clientName", label: "Cliente", in: ["cliente", "proveedor"] },
  { key: "assignedUserName", label: "Asignado a", in: ["cliente", "proveedor"] },
  { key: "deviceType", label: "Tipo dispositivo", in: ["cliente", "proveedor"] },
  { key: "deviceBrand", label: "Marca", in: ["cliente", "proveedor"] },
  { key: "deviceModel", label: "Modelo", in: ["cliente", "proveedor"] },
  { key: "deviceSerialNumber", label: "Nº serie", in: ["cliente", "proveedor"] },
  // Contacto y recogida
  { key: "contactName", label: "Contacto", in: ["cliente", "proveedor"] },
  { key: "contactPhone", label: "Teléfono contacto", in: ["cliente", "proveedor"] },
  { key: "contactEmail", label: "Email contacto", in: ["proveedor"] },
  { key: "pickupAddress", label: "Dirección recogida", in: ["cliente", "proveedor"] },
  { key: "pickupCity", label: "Ciudad recogida", in: ["cliente", "proveedor"] },
  { key: "pickupPostalCode", label: "CP recogida", in: ["cliente", "proveedor"] },
  { key: "recogida", label: "Bloque recogida completo", in: ["proveedor"] },
  { key: "destino", label: "Bloque destino completo", in: ["proveedor"] },
  // Envíos
  { key: "trackingNumberOutgoing", label: "Tracking envío", in: ["proveedor"] },
  { key: "trackingNumberReturn", label: "Tracking devolución", in: ["proveedor"] },
  // Interno
  { key: "intercomUrl", label: "URL Intercom", in: ["cliente"] },
  { key: "intercomEscalationId", label: "ID Escalación", in: ["cliente"] },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  in: ReadonlyArray<TemplateCategory>;
}>;

export type TemplateVariable = { key: string; label: string };

/** Variables rellenables desde una incidencia (plantillas de cliente). */
export const INCIDENT_TEMPLATE_VARIABLES: readonly TemplateVariable[] =
  TEMPLATE_VARIABLES.filter((v) => (v.in as readonly string[]).includes("cliente")).map(
    ({ key, label }) => ({ key, label })
  );

/** Variables rellenables desde un RMA (plantillas de proveedor). */
export const RMA_TEMPLATE_VARIABLES: readonly TemplateVariable[] =
  TEMPLATE_VARIABLES.filter((v) => (v.in as readonly string[]).includes("proveedor")).map(
    ({ key, label }) => ({ key, label })
  );

/** Las que ofrece el editor según la categoría que tenga puesta la plantilla. */
export function variablesForCategory(
  category: TemplateCategory
): readonly TemplateVariable[] {
  return category === "proveedor"
    ? RMA_TEMPLATE_VARIABLES
    : INCIDENT_TEMPLATE_VARIABLES;
}

/**
 * Render a template body/subject by replacing `{{variable}}` placeholders
 * with values from the provided context.
 *
 * Behaviour:
 * - If `key` exists in context (even with empty string): substitute → user
 *   sees real value or empty (legitimate case: data not yet captured, e.g.
 *   tracking number before shipping).
 * - If `key` is NOT in context: preserve `{{key}}` literal so the user can
 *   see at preview time that a variable is missing and react. Avoids the
 *   silent data loss that happens when typo'd or out-of-context variables
 *   render as empty.
 */
export function renderTemplate(
  template: string,
  context: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (key in context) return context[key] ?? "";
    return `{{${key}}}`;
  });
}

/**
 * Huecos que han quedado sin rellenar tras renderizar.
 *
 * Confiar en que se vean en la previsualización no bastaba: el cuerpo se pinta
 * en gris y con scroll, y un `{{description}}` a mitad de un correo largo pasa
 * desapercibido hasta que lo lee el proveedor. Con esto se puede avisar.
 */
export function unresolvedVariables(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/\{\{(\w+)\}\}/g)) found.add(match[1]);
  return [...found];
}
