import { uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { hsmSchema } from "./hsm-schema";
import { users } from "./users";

export const reminderStatusEnum = hsmSchema.enum("reminder_status", [
  "pendiente",
  "hecho",
  "descartado",
]);

// Tipo de entidad a la que (opcionalmente) se liga el recordatorio.
// null = recordatorio suelto (agenda personal).
export const reminderEntityEnum = hsmSchema.enum("reminder_entity_type", [
  "incident",
  "rma",
]);

export const reminders = hsmSchema.table(
  "reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Dueño. null = nota del corcho dirigida a todo el equipo.
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    // Entidad vinculada (opcional). Polimórfico ligero: tipo + id sueltos
    // (sin FK porque entityId apunta a incidents o rmas según entityType).
    entityType: reminderEntityEnum("entity_type"),
    entityId: uuid("entity_id"),

    title: varchar("title", { length: 500 }).notNull(),
    note: text("note"),
    // null = nota del corcho sin fecha (no vence).
    dueAt: timestamp("due_at", { withTimezone: true }),

    // "nota" se pinta en el corcho; "seguimiento" es la agenda de siempre
    // (ronda diaria y fichas) y vive en el lateral de Mi día. Ver sql/028.
    kind: varchar("kind", { length: 20 }).default("seguimiento").notNull(),
    // Color del papel en el corcho. Ver CORK_COLORS.
    color: varchar("color", { length: 20 }).default("amarillo").notNull(),
    // Recurrencia: none | daily | weekly | monthly. Al completar uno recurrente
    // se genera la siguiente ocurrencia.
    recurrence: varchar("recurrence", { length: 20 }).default("none").notNull(),

    status: reminderStatusEnum("status").notNull().default("pendiente"),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Para "Mi día": recordatorios pendientes de un usuario por fecha.
    index("reminders_user_status_due_idx").on(table.userId, table.status, table.dueAt),
    // Para mostrar recordatorios en la ficha de una entidad.
    index("reminders_entity_idx").on(table.entityType, table.entityId),
    // Para el corcho: notas pendientes, las más nuevas primero.
    index("reminders_kind_status_idx").on(table.kind, table.status, table.createdAt),
  ]
);
