/**
 * Campos "clave" de una incidencia para el registro progresivo.
 * Devuelve la lista de los que faltan (etiquetas legibles) para mostrar
 * un aviso "pendiente de completar" y empujar a rellenarlos más tarde.
 */
export interface CompletenessInput {
  clientId?: string | null;
  clientName?: string | null;
  articleId?: string | null;
  deviceModel?: string | null;
  deviceBrand?: string | null;
  contactName?: string | null;
}

export function incidentMissingFields(i: CompletenessInput): string[] {
  const missing: string[] = [];
  if (!i.clientId && !i.clientName) missing.push("cliente");
  if (!i.articleId && !i.deviceModel && !i.deviceBrand) missing.push("equipo");
  if (!i.contactName) missing.push("contacto");
  return missing;
}
