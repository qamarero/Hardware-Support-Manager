import { uuid, varchar, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { hsmSchema } from "./hsm-schema";

export const sequences = hsmSchema.table("sequences", {
  id: uuid("id").defaultRandom().primaryKey(),
  prefix: varchar("prefix", { length: 10 }).notNull(),
  year: integer("year").notNull(),
  lastValue: integer("last_value").notNull().default(0),
}, (table) => [
  uniqueIndex("sequences_prefix_year_idx").on(table.prefix, table.year),
]);
