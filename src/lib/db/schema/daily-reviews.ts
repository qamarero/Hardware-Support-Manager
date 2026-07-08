import { uuid, date, timestamp, unique } from "drizzle-orm/pg-core";
import { hsmSchema } from "./hsm-schema";
import { entityTypeEnum } from "./event-logs";
import { users } from "./users";

/**
 * Marca "revisada hoy" de la ronda diaria, COMPARTIDA por el equipo.
 * Una fila por (entidad, día): si existe para hoy, está revisada para todos.
 * Ver sql/022-daily-reviews.sql.
 */
export const dailyReviews = hsmSchema.table(
  "daily_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: entityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    reviewDate: date("review_date").notNull(),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniq: unique("daily_reviews_unique").on(t.entityType, t.entityId, t.reviewDate),
  }),
);
