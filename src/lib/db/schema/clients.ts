import { uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { hsmSchema } from "./hsm-schema";

/** De dónde salió la ficha: tecleada en HSM o espejada desde CX Advisor. */
export type ClientSource = "manual" | "cx_advisor";

export const clients = hsmSchema.table("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 500 }).notNull(),
  externalId: varchar("external_id", { length: 255 }),
  intercomUrl: varchar("intercom_url", { length: 1000 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  contactName: varchar("contact_name", { length: 255 }),
  address: text("address"),
  city: varchar("city", { length: 255 }),
  postalCode: varchar("postal_code", { length: 20 }),
  notes: text("notes"),

  // ── Espejo de CX Advisor (ver sql/029-clients-cx-advisor-sync.sql) ──
  /** hubspot_deal_id de CX Advisor. Su PK, y lo único que existe siempre. */
  cxDealId: varchar("cx_deal_id", { length: 64 }),
  /** Etapa comercial literal: "4. Restaurantes Activos", "0.b Lost Deal"… */
  businessStage: varchar("business_stage", { length: 100 }),
  province: varchar("province", { length: 120 }),
  /** El sync solo toca las filas "cx_advisor": lo manual no lo pisa nadie. */
  source: varchar("source", { length: 20 }).$type<ClientSource>().notNull().default("manual"),
  syncedAt: timestamp("synced_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
