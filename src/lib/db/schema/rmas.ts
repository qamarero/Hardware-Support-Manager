import { uuid, varchar, text, timestamp, bigint, jsonb } from "drizzle-orm/pg-core";
import { hsmSchema } from "./hsm-schema";

/** Datos de recogida/envío del RMA: cliente (origen) + destino. Para el correo
 *  al proveedor y para preparar el envío (TIPSA, de momento manual). */
export interface RmaShipping {
  locationName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  province?: string;
  reference?: string;
  instructions?: string;
  destination?: {
    type?: "oficina" | "sat" | "cliente" | "";
    name?: string;
    address?: string;
    postalCode?: string;
    city?: string;
    province?: string;
    contact?: string;
    phone?: string;
  };
}

/** Estados de una recogida TIPSA pedida a MainOps (contrato v1.0). Terminales:
 *  `recibida` y `anulada`. */
export type RmaPickupStatus =
  | "solicitada" | "programada" | "incidencia" | "en_curso" | "recibida" | "anulada";

/** Última foto de la recogida tal como la manda MainOps (PickupDTO del contrato
 *  `docs/connectors/mainops-recogidas-contrato.md`). Se guarda entera, en
 *  snake_case como llega: es un documento ajeno, no un modelo nuestro. */
export interface RmaPickup {
  pickup_id: string;
  rma_id: string;
  rma_number: string | null;
  status: RmaPickupStatus;
  status_label: string | null;
  /** Fecha local de Madrid (YYYY-MM-DD). null hasta que se programa. */
  pickup_date: string | null;
  time_from: string | null;
  time_to: string | null;
  tipsa_code: string | null;
  /** Envío que genera TIPSA al recoger: el seguimiento del equipo. */
  albaran: string | null;
  incidence: { code: string | null; label: string | null; observations: string | null } | null;
  last_event: { code: string | null; label: string | null; date: string | null } | null;
  cancel_reason: string | null;
  created_at: string | null;
  updated_at: string;
}
import { incidents } from "./incidents";
import { providers } from "./providers";
import { clients } from "./clients";
import { articles } from "./articles";

export const rmaStatusEnum = hsmSchema.enum("rma_status", [
  "borrador", "solicitado", "aprobado", "enviado_proveedor",
  "en_proveedor", "devuelto", "recibido_oficina", "enviado_cliente",
  "esperando_cliente", "entregado_cliente", "rechazado", "cerrado", "cancelado",
]);

export const rmas = hsmSchema.table("rmas", {
  id: uuid("id").defaultRandom().primaryKey(),
  rmaNumber: varchar("rma_number", { length: 20 }).notNull().unique(),
  incidentId: uuid("incident_id").references(() => incidents.id, { onDelete: "restrict" }),
  providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "restrict" }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  clientName: varchar("client_name", { length: 500 }),
  clientExternalId: varchar("client_external_id", { length: 255 }),
  clientIntercomUrl: varchar("client_intercom_url", { length: 1000 }),
  status: rmaStatusEnum("status").notNull().default("borrador"),
  deviceType: varchar("device_type", { length: 100 }),
  deviceBrand: varchar("device_brand", { length: 255 }),
  deviceModel: varchar("device_model", { length: 255 }),
  deviceSerialNumber: varchar("device_serial_number", { length: 255 }),
  trackingNumberOutgoing: varchar("tracking_number_outgoing", { length: 255 }),
  trackingNumberReturn: varchar("tracking_number_return", { length: 255 }),
  providerRmaNumber: varchar("provider_rma_number", { length: 255 }),
  contactName: varchar("contact_name", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  pickupAddress: text("pickup_address"),
  pickupPostalCode: varchar("pickup_postal_code", { length: 20 }),
  pickupCity: varchar("pickup_city", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  stateChangedAt: timestamp("state_changed_at", { withTimezone: true }).defaultNow().notNull(),
  // Tiempo acumulado en pausa (ms, como string — mismo patrón que incidencias).
  // El contador de antigüedad se congela mientras el equipo está en el proveedor.
  slaPausedMs: varchar("sla_paused_ms", { length: 50 }).default("0").notNull(),
  articleId: uuid("article_id").references(() => articles.id, { onDelete: "set null" }),
  // Granularidad para métricas (A8): cómo acabó, logística y vía de reparación.
  outcome: varchar("outcome", { length: 30 }), // reparado|sustituido|abono|rechazado|sin_solucion|sustitucion_directa
  logistics: varchar("logistics", { length: 30 }), // proveedor_gestiona|nosotros_intermediamos
  repairPath: varchar("repair_path", { length: 30 }), // interna_hwtool|proveedor
  // Datos de recogida/envío (cliente + destino) capturados en el pop-up.
  shipping: jsonb("shipping").$type<RmaShipping>().default({}),
  // Recogida TIPSA pedida a MainOps (sql/031). NULL = nunca se ha pedido.
  // La escriben las acciones del drawer y el webhook de MainOps, nunca el
  // formulario de edición.
  pickup: jsonb("pickup").$type<RmaPickup>(),
  deviceValueCents: bigint("device_value_cents", { mode: "number" }),
  repairCostCents: bigint("repair_cost_cents", { mode: "number" }),
  shippingCostCents: bigint("shipping_cost_cents", { mode: "number" }),
  replacementCostCents: bigint("replacement_cost_cents", { mode: "number" }),
});
