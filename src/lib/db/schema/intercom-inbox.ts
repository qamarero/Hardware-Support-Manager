import { uuid, varchar, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { hsmSchema } from "./hsm-schema";
import { incidents } from "./incidents";
import { users } from "./users";

export const intercomInboxStatusEnum = hsmSchema.enum(
  "intercom_inbox_status",
  ["pendiente", "convertida", "descartada"]
);

export const intercomInbox = hsmSchema.table(
  "intercom_inbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    intercomConversationId: varchar("intercom_conversation_id", { length: 255 })
      .notNull()
      .unique(),
    status: intercomInboxStatusEnum("status").notNull().default("pendiente"),
    contactName: varchar("contact_name", { length: 255 }),
    contactEmail: varchar("contact_email", { length: 500 }),
    subject: varchar("subject", { length: 1000 }),
    assigneeName: varchar("assignee_name", { length: 255 }),
    rawPayload: jsonb("raw_payload"),
    convertedIncidentId: uuid("converted_incident_id")
      .references(() => incidents.id, { onDelete: "set null" }),
    convertedByUserId: uuid("converted_by_user_id")
      .references(() => users.id, { onDelete: "set null" }),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    dismissedByUserId: uuid("dismissed_by_user_id")
      .references(() => users.id, { onDelete: "set null" }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    // Motivo del descarte automático del webhook (null si fue descarte manual del técnico).
    // Valores p.ej.: "webhook_no_keyword_match", "webhook_no_conversation_id".
    discardReason: varchar("discard_reason", { length: 100 }),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("intercom_inbox_status_received_idx").on(table.status, table.receivedAt),
  ]
);
