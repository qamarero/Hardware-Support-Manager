import type { RmaShipping } from "@/lib/db/schema/rmas";
import { RMA_LOGISTICS } from "@/lib/constants/rmas";

/**
 * Cuerpo de `POST /api/external/hsm/pickups` a partir de un RMA.
 *
 * Funciones puras: las usa el servidor para montar la petición y el drawer para
 * saber si puede ofrecer el botón (y qué falta si no). Así la regla de «qué
 * datos hacen falta» vive en un único sitio.
 *
 * Contrato: docs/connectors/mainops-recogidas-contrato.md §1.
 */

/** Lo que se necesita del RMA. `RmaRow` encaja tal cual. */
export interface PickupRmaInput {
  id: string;
  rmaNumber: string;
  clientName?: string | null;
  clientCompanyName?: string | null;
  deviceType?: string | null;
  deviceBrand?: string | null;
  deviceModel?: string | null;
  deviceSerialNumber?: string | null;
  shipping?: RmaShipping | null;
  /** Quién mueve el equipo: solo con `nosotros_intermediamos` se pide a MainOps. */
  logistics?: string | null;
}

/** Quién pulsa el botón, para el historial de MainOps. */
export interface PickupRequester {
  name?: string | null;
  email?: string | null;
}

export interface PickupRequestBody {
  rma_id: string;
  rma_number: string;
  requested_by?: { name: string; email?: string };
  origin: {
    name: string;
    contact_name?: string;
    phone: string;
    email?: string;
    address: string;
    postal_code: string;
    city: string;
    province?: string;
  };
  destination:
    | { type: "oficina" }
    | {
        type: "sat";
        name: string;
        contact_name?: string;
        phone?: string;
        address: string;
        postal_code: string;
        city: string;
      };
  items?: { description: string; serial?: string }[];
  instructions?: string;
  /** Horario que le viene bien al cliente («HH:MM»); MainOps lo precarga al programar. */
  time_from?: string;
  time_to?: string;
}

export type PickupDataCheck =
  | { ok: true }
  /** El destino es el cliente: eso es un envío, no una recogida. */
  | { ok: false; reason: "destino_cliente" }
  | { ok: false; reason: "faltan_datos"; missing: string[] };

export type BuildPickupResult =
  | { ok: true; body: PickupRequestBody }
  | { ok: false; error: string };

/** Texto recortado, o undefined si queda vacío. */
function clean(v: string | null | undefined): string | undefined {
  const s = (v ?? "").trim();
  return s === "" ? undefined : s;
}

/** Sin espacios: «28 004» → «28004», «600 00 00 00» → «600000000». */
function compact(v: string | null | undefined): string | undefined {
  const s = (v ?? "").replace(/\s+/g, "");
  return s === "" ? undefined : s;
}

/** «a», «a y b», «a, b y c». */
export function joinEs(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/** Nombre del sitio de recogida: el del pop-up y, si no, el del cliente. */
function originName(rma: PickupRmaInput): string | undefined {
  return clean(rma.shipping?.locationName) ?? clean(rma.clientCompanyName) ?? clean(rma.clientName);
}

/**
 * ¿Tiene el RMA lo que MainOps exige para grabar la recogida?
 *
 * Origen: nombre, dirección, CP de 5 dígitos, ciudad y teléfono. Destino:
 * oficina (MainOps pone la dirección de nuestro almacén) o SAT con su
 * dirección. `missing` va en minúsculas para encajar en una frase.
 */
export function checkPickupData(rma: PickupRmaInput): PickupDataCheck {
  const s = rma.shipping ?? {};
  const destType = s.destination?.type || "";
  if (destType === "cliente") return { ok: false, reason: "destino_cliente" };

  const missing: string[] = [];
  if (!originName(rma)) missing.push("nombre del local");
  if (!clean(s.address)) missing.push("dirección");
  const cp = compact(s.postalCode);
  if (!cp) missing.push("código postal");
  else if (!/^\d{5}$/.test(cp)) missing.push("código postal de 5 dígitos");
  if (!clean(s.city)) missing.push("ciudad");
  if (!compact(s.contactPhone)) missing.push("teléfono");

  if (destType === "") {
    missing.push("destino (oficina o SAT)");
  } else if (destType === "sat") {
    const d = s.destination ?? {};
    if (!clean(d.name)) missing.push("nombre del SAT");
    if (!clean(d.address)) missing.push("dirección del SAT");
    if (!compact(d.postalCode)) missing.push("código postal del SAT");
    if (!clean(d.city)) missing.push("ciudad del SAT");
  }

  return missing.length > 0 ? { ok: false, reason: "faltan_datos", missing } : { ok: true };
}

/** Mensaje para el técnico cuando el RMA no está listo para pedir recogida. */
export function pickupDataError(check: Exclude<PickupDataCheck, { ok: true }>): string {
  if (check.reason === "destino_cliente") {
    return "Una recogida solo puede ir a nuestra oficina o al SAT del proveedor, no directamente al cliente. Cambia el destino en «Datos de recogida/envío».";
  }
  return `Faltan datos de recogida: ${joinEs(check.missing)}. Complétalos en «Datos de recogida/envío».`;
}

/**
 * Por qué el bloque «Recogida» no ofrece «Pedir recogida a MainOps», en frases
 * para el técnico. Vacío = se puede pedir.
 *
 * Devuelve todas las causas a la vez: si faltan la logística y el destino, el
 * técnico lo ve de una sola vez en lugar de ir descubriéndolo arreglando una.
 * Antes, sin la logística marcada, el bloque no decía nada y el botón
 * simplemente no aparecía.
 */
export function pickupBlockers(rma: PickupRmaInput): string[] {
  const out: string[] = [];
  if (rma.logistics === RMA_LOGISTICS.PROVEEDOR_GESTIONA) {
    out.push(
      "La logística de este RMA es «Proveedor recoge y envía». Si la recogida la hacemos nosotros, cámbiala a «Nosotros recogemos y enviamos» en «Editar datos»."
    );
  } else if (rma.logistics !== RMA_LOGISTICS.NOSOTROS_INTERMEDIAMOS) {
    out.push("Para pedir la recogida, marca la logística como «Nosotros recogemos y enviamos» en «Editar datos».");
  }

  const check = checkPickupData(rma);
  if (!check.ok) {
    out.push(
      check.reason === "destino_cliente"
        ? "Una recogida solo va a nuestra oficina o al SAT del proveedor: cambia el destino en «Datos de recogida/envío»."
        : `Falta ${joinEs(check.missing)}: ${check.missing.length > 1 ? "complétalos" : "complétalo"} en «Datos de recogida/envío».`
    );
  }
  return out;
}

/** Monta el cuerpo de la petición o explica qué falta. */
export function buildPickupRequest(
  rma: PickupRmaInput,
  requestedBy?: PickupRequester | null
): BuildPickupResult {
  const check = checkPickupData(rma);
  if (!check.ok) return { ok: false, error: pickupDataError(check) };

  const s = rma.shipping ?? {};
  const d = s.destination ?? {};

  const origin: PickupRequestBody["origin"] = {
    name: originName(rma)!,
    phone: compact(s.contactPhone)!,
    address: clean(s.address)!,
    postal_code: compact(s.postalCode)!,
    city: clean(s.city)!,
  };
  const contactName = clean(s.contactName);
  const email = clean(s.contactEmail);
  const province = clean(s.province);
  if (contactName) origin.contact_name = contactName;
  if (email) origin.email = email;
  if (province) origin.province = province;

  let destination: PickupRequestBody["destination"];
  if (d.type === "sat") {
    destination = {
      type: "sat",
      name: clean(d.name)!,
      address: clean(d.address)!,
      postal_code: compact(d.postalCode)!,
      city: clean(d.city)!,
    };
    const destContact = clean(d.contact);
    const destPhone = compact(d.phone);
    if (destContact) destination.contact_name = destContact;
    if (destPhone) destination.phone = destPhone;
  } else {
    // Con oficina MainOps usa la dirección de TIPSA_SENDER: no se manda nada más.
    destination = { type: "oficina" };
  }

  const body: PickupRequestBody = {
    rma_id: rma.id,
    rma_number: rma.rmaNumber,
    origin,
    destination,
  };

  // Lo que se recoge va al campo «contenido» de TIPSA.
  const description =
    [clean(rma.deviceBrand), clean(rma.deviceModel)].filter(Boolean).join(" ") || clean(rma.deviceType);
  const serial = clean(rma.deviceSerialNumber);
  if (description || serial) {
    body.items = [{ description: description ?? "Equipo", ...(serial ? { serial } : {}) }];
  }

  const instructions = clean(s.instructions);
  if (instructions) body.instructions = instructions;

  // Solo si el horario está completo y tiene sentido: MainOps rechaza (400)
  // una franja a medias, y no merece bloquear la petición por eso.
  const from = clean(s.pickupFrom);
  const to = clean(s.pickupTo);
  if (from && to && /^\d{2}:\d{2}$/.test(from) && /^\d{2}:\d{2}$/.test(to) && from < to) {
    body.time_from = from;
    body.time_to = to;
  }

  const reqName = clean(requestedBy?.name) ?? clean(requestedBy?.email);
  if (reqName) {
    const reqEmail = clean(requestedBy?.email);
    body.requested_by = { name: reqName, ...(reqEmail ? { email: reqEmail } : {}) };
  }

  return { ok: true, body };
}
