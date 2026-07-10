import { uuid, varchar, date, text, timestamp, unique } from "drizzle-orm/pg-core";
import { hsmSchema } from "./hsm-schema";
import { users } from "./users";

/**
 * Reporte semanal de métricas de RMA: anotaciones EDITABLES (semáforo,
 * responsable, comentario) por métrica y semana, COMPARTIDAS con el equipo.
 * Los valores numéricos NO se guardan aquí (se calculan en vivo, ver
 * `src/server/queries/rma-metrics.ts`). Una fila por (metric_key, week_start).
 * Ver sql/024-rma-metric-reviews.sql.
 */
export const rmaMetricReviews = hsmSchema.table(
  "rma_metric_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    metricKey: varchar("metric_key", { length: 64 }).notNull(),
    weekStart: date("week_start").notNull(),
    // semáforo: 'verde' | 'ambar' | 'rojo' | null
    status: varchar("status", { length: 12 }),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    uniq: unique("rma_metric_reviews_unique").on(t.metricKey, t.weekStart),
  }),
);
