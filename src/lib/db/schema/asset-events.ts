import { uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { hsmSchema } from "./hsm-schema";
import { assets } from "./assets";
import { users } from "./users";

/**
 * Historial (seguimiento individual) de un equipo físico: cada cambio de
 * situación, asignación a cliente, envío a reparar, etc. Ver sql/026.
 */
export const assetEvents = hsmSchema.table(
  "asset_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetId: uuid("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 40 }).notNull(), // created | status_change | assigned | returned | note
    fromStatus: varchar("from_status", { length: 40 }),
    toStatus: varchar("to_status", { length: 40 }),
    clientName: varchar("client_name", { length: 500 }),
    note: text("note"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("asset_events_asset_idx").on(t.assetId, t.createdAt)],
);
