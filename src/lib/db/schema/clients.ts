import { uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { hsmSchema } from "./hsm-schema";

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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
