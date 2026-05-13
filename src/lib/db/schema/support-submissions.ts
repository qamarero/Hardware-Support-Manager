import { uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { hsmSchema } from "./hsm-schema";
import { incidents } from "./incidents";
import { clients } from "./clients";
import { users } from "./users";

export const supportSubmissionStatusEnum = hsmSchema.enum(
  "support_submission_status",
  ["pendiente", "convertida", "descartada"]
);

export const supportSubmissionPriorityEnum = hsmSchema.enum(
  "support_submission_priority",
  ["baja", "media", "alta", "critica"]
);

export const supportSubmissions = hsmSchema.table(
  "support_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    status: supportSubmissionStatusEnum("status").notNull().default("pendiente"),

    // Submitter info
    submitterName: varchar("submitter_name", { length: 255 }).notNull(),
    submitterEmail: varchar("submitter_email", { length: 500 }).notNull(),

    // Client info
    clientName: varchar("client_name", { length: 500 }).notNull(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),

    // Incident data
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description").notNull(),
    priority: supportSubmissionPriorityEnum("priority").notNull().default("media"),

    // Device info (optional)
    deviceType: varchar("device_type", { length: 100 }),
    deviceBrand: varchar("device_brand", { length: 255 }),
    deviceModel: varchar("device_model", { length: 255 }),
    deviceSerialNumber: varchar("device_serial_number", { length: 255 }),

    // Contact info
    contactPhone: varchar("contact_phone", { length: 50 }),
    intercomUrl: varchar("intercom_url", { length: 1000 }),

    // Review metadata
    convertedIncidentId: uuid("converted_incident_id")
      .references(() => incidents.id, { onDelete: "set null" }),
    convertedByUserId: uuid("converted_by_user_id")
      .references(() => users.id, { onDelete: "set null" }),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    dismissedByUserId: uuid("dismissed_by_user_id")
      .references(() => users.id, { onDelete: "set null" }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    dismissReason: text("dismiss_reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("support_submissions_status_created_idx").on(table.status, table.createdAt),
  ]
);
