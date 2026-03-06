import { uuid, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";
import { hsmSchema } from "./hsm-schema";

export const appSettings = hsmSchema.table("app_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: jsonb("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});
