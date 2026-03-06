import { uuid, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { hsmSchema } from "./hsm-schema";
import { entityTypeEnum } from "./event-logs";
import { users } from "./users";

export const attachments = hsmSchema.table("attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityType: entityTypeEnum("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  fileName: varchar("file_name", { length: 500 }).notNull(),
  fileUrl: varchar("file_url", { length: 1000 }).notNull(),
  fileSize: integer("file_size").notNull(),
  fileType: varchar("file_type", { length: 255 }).notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
