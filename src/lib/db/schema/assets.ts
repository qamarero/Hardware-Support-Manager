import { uuid, varchar, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { hsmSchema } from "./hsm-schema";
import { articles } from "./articles";
import { rmas } from "./rmas";
import { incidents } from "./incidents";

/**
 * Registro de equipos físicos (unidades) — con o sin RMA. Sirve para etiquetar
 * (QR) e identificar equipos que están en la oficina, incluidos los previos a
 * la herramienta o sin RMA registrado. Distinto del "Inventario" agregado.
 */
export const assets = hsmSchema.table(
  "assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetCode: varchar("asset_code", { length: 20 }).notNull().unique(), // EQ-YYYY-NNNNN
    deviceType: varchar("device_type", { length: 100 }),
    deviceBrand: varchar("device_brand", { length: 255 }),
    deviceModel: varchar("device_model", { length: 255 }),
    deviceSerialNumber: varchar("device_serial_number", { length: 255 }),
    clientName: varchar("client_name", { length: 500 }),
    status: varchar("status", { length: 40 }).notNull().default("en_oficina"),
    location: varchar("location", { length: 255 }),
    notes: text("notes"),
    // Reacondicionado: el equipo está revisado y listo para reutilizar con clientes.
    reconditioned: boolean("reconditioned").notNull().default(false),
    // Vínculos opcionales (un equipo puede estar asociado a un RMA/incidencia).
    articleId: uuid("article_id").references(() => articles.id),
    rmaId: uuid("rma_id").references(() => rmas.id),
    incidentId: uuid("incident_id").references(() => incidents.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("assets_status_idx").on(table.status),
    index("assets_serial_idx").on(table.deviceSerialNumber),
  ]
);
