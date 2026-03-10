import { uuid, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { hsmSchema } from "./hsm-schema";

export const clients = hsmSchema.table("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientCode: varchar("client_code", { length: 50 }).unique(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  company: varchar("company", { length: 255 }),
  address: text("address"),
  clientPnp: boolean("client_pnp").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
