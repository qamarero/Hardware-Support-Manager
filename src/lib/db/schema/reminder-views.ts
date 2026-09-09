import { uuid, timestamp, unique, index } from "drizzle-orm/pg-core";
import { hsmSchema } from "./hsm-schema";
import { reminders } from "./reminders";
import { users } from "./users";

/**
 * Marca "visto" de una nota del corcho, POR PERSONA.
 * Separa "me he enterado" de "está hecho": cuando la marco vista desaparece de
 * mi alerta de Mi día, pero la nota sigue en el tablero para los demás.
 * Ver sql/028-corcho-notas.sql.
 */
export const reminderViews = hsmSchema.table(
  "reminder_views",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reminderId: uuid("reminder_id")
      .notNull()
      .references(() => reminders.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seenAt: timestamp("seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("reminder_views_unique").on(t.reminderId, t.userId),
    index("reminder_views_user_idx").on(t.userId),
  ]
);
