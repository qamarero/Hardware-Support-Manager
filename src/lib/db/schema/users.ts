import { uuid, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { hsmSchema } from "./hsm-schema";

export const userRoleEnum = hsmSchema.enum("user_role", ["admin", "technician", "viewer"]);

export const users = hsmSchema.table("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default("technician"),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
