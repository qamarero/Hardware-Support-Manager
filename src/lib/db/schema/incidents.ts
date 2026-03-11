import { uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { hsmSchema } from "./hsm-schema";
import { users } from "./users";
import { clients } from "./clients";

export const incidentStatusEnum = hsmSchema.enum("incident_status", [
  "nuevo", "en_triaje", "en_diagnostico", "esperando_repuesto",
  "en_reparacion", "esperando_cliente", "resuelto", "cerrado", "cancelado",
]);

export const incidentPriorityEnum = hsmSchema.enum("incident_priority", [
  "baja", "media", "alta", "critica",
]);

export const incidentCategoryEnum = hsmSchema.enum("incident_category", [
  "hardware", "periferico", "red", "almacenamiento", "impresora", "monitor", "otro",
]);

export const incidents = hsmSchema.table("incidents", {
  id: uuid("id").defaultRandom().primaryKey(),
  incidentNumber: varchar("incident_number", { length: 20 }).notNull().unique(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "restrict" }),
  assignedUserId: uuid("assigned_user_id").references(() => users.id, { onDelete: "set null" }),
  category: incidentCategoryEnum("category").notNull(),
  priority: incidentPriorityEnum("priority").notNull().default("media"),
  status: incidentStatusEnum("status").notNull().default("nuevo"),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  deviceType: varchar("device_type", { length: 100 }),
  deviceBrand: varchar("device_brand", { length: 255 }),
  deviceModel: varchar("device_model", { length: 255 }),
  deviceSerialNumber: varchar("device_serial_number", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  stateChangedAt: timestamp("state_changed_at", { withTimezone: true }).defaultNow().notNull(),
});
