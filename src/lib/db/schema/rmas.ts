import { uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { hsmSchema } from "./hsm-schema";
import { incidents } from "./incidents";
import { providers } from "./providers";

export const rmaStatusEnum = hsmSchema.enum("rma_status", [
  "borrador", "solicitado", "aprobado_proveedor", "enviado_proveedor",
  "recibido_proveedor", "en_reparacion_proveedor", "devuelto",
  "recibido_almacen", "cerrado", "cancelado",
]);

export const rmas = hsmSchema.table("rmas", {
  id: uuid("id").defaultRandom().primaryKey(),
  rmaNumber: varchar("rma_number", { length: 20 }).notNull().unique(),
  incidentId: uuid("incident_id").references(() => incidents.id),
  providerId: uuid("provider_id").notNull().references(() => providers.id),
  status: rmaStatusEnum("status").notNull().default("borrador"),
  deviceBrand: varchar("device_brand", { length: 255 }),
  deviceModel: varchar("device_model", { length: 255 }),
  deviceSerialNumber: varchar("device_serial_number", { length: 255 }),
  trackingNumberOutgoing: varchar("tracking_number_outgoing", { length: 255 }),
  trackingNumberReturn: varchar("tracking_number_return", { length: 255 }),
  providerRmaNumber: varchar("provider_rma_number", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  stateChangedAt: timestamp("state_changed_at", { withTimezone: true }).defaultNow().notNull(),
});
