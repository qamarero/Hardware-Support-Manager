import { uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { hsmSchema } from "./hsm-schema";

export const providers = hsmSchema.table("providers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  contactPerson: varchar("contact_person", { length: 255 }),
  website: varchar("website", { length: 500 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
