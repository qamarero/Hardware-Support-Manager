import { uuid, varchar, text, timestamp, bigint, integer } from "drizzle-orm/pg-core";
import { hsmSchema } from "./hsm-schema";
import { users } from "./users";
import { clients } from "./clients";
import { articles } from "./articles";

export const incidentStatusEnum = hsmSchema.enum("incident_status", [
  "nuevo", "en_triaje", "en_gestion", "esperando_cliente",
  "esperando_proveedor", "esperando_pieza", "resuelto", "cerrado", "cancelado",
]);

export const incidentPriorityEnum = hsmSchema.enum("incident_priority", [
  "baja", "media", "alta", "critica",
]);

export const incidentCategoryEnum = hsmSchema.enum("incident_category", [
  "escalado", "incidencia_directa", "mencion", "otro", "consulta_rapida",
]);

export const hardwareOriginEnum = hsmSchema.enum("hardware_origin", [
  "qamarero", "cliente_reciclado",
]);

export const incidents = hsmSchema.table("incidents", {
  id: uuid("id").defaultRandom().primaryKey(),
  incidentNumber: varchar("incident_number", { length: 20 }).notNull().unique(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  clientName: varchar("client_name", { length: 500 }),
  assignedUserId: uuid("assigned_user_id").references(() => users.id, { onDelete: "set null" }),
  category: incidentCategoryEnum("category").notNull(),
  hardwareOrigin: hardwareOriginEnum("hardware_origin"),
  priority: incidentPriorityEnum("priority").notNull().default("media"),
  status: incidentStatusEnum("status").notNull().default("nuevo"),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  deviceType: varchar("device_type", { length: 100 }),
  deviceBrand: varchar("device_brand", { length: 255 }),
  deviceModel: varchar("device_model", { length: 255 }),
  deviceSerialNumber: varchar("device_serial_number", { length: 255 }),
  intercomUrl: varchar("intercom_url", { length: 1000 }),
  intercomEscalationId: varchar("intercom_escalation_id", { length: 255 }),
  contactName: varchar("contact_name", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  pickupAddress: text("pickup_address"),
  pickupPostalCode: varchar("pickup_postal_code", { length: 20 }),
  pickupCity: varchar("pickup_city", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  stateChangedAt: timestamp("state_changed_at", { withTimezone: true }).defaultNow().notNull(),
  slaPausedMs: varchar("sla_paused_ms", { length: 50 }).default("0").notNull(),
  // SLA objetivo por incidencia (horas). Si null, se usa el umbral por prioridad.
  slaHours: integer("sla_hours"),
  // Diagnóstico y solución (prototipo). Texto libre editable en la ficha.
  diagnosis: text("diagnosis"),
  resolution: text("resolution"),
  resolutionType: varchar("resolution_type", { length: 50 }),
  articleId: uuid("article_id").references(() => articles.id, { onDelete: "set null" }),
  deviceValueCents: bigint("device_value_cents", { mode: "number" }),
  // Minutos invertidos en consultas rápidas in-situ (category='consulta_rapida').
  // NULL para incidencias normales. No se usa en cálculos SLA.
  quickDurationMinutes: integer("quick_duration_minutes"),
});
