import { relations } from "drizzle-orm";
import { users } from "./users";
import { clients } from "./clients";
import { providers } from "./providers";
import { incidents } from "./incidents";
import { rmas } from "./rmas";
import { eventLogs } from "./event-logs";
import { attachments } from "./attachments";

export const usersRelations = relations(users, ({ many }) => ({
  assignedIncidents: many(incidents),
  eventLogs: many(eventLogs),
  attachments: many(attachments),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  incidents: many(incidents),
}));

export const providersRelations = relations(providers, ({ many }) => ({
  rmas: many(rmas),
}));

export const incidentsRelations = relations(incidents, ({ one, many }) => ({
  client: one(clients, {
    fields: [incidents.clientId],
    references: [clients.id],
  }),
  assignedUser: one(users, {
    fields: [incidents.assignedUserId],
    references: [users.id],
  }),
  rmas: many(rmas),
}));

export const rmasRelations = relations(rmas, ({ one }) => ({
  incident: one(incidents, {
    fields: [rmas.incidentId],
    references: [incidents.id],
  }),
  provider: one(providers, {
    fields: [rmas.providerId],
    references: [providers.id],
  }),
  client: one(clients, {
    fields: [rmas.clientId],
    references: [clients.id],
  }),
}));

export const eventLogsRelations = relations(eventLogs, ({ one }) => ({
  user: one(users, {
    fields: [eventLogs.userId],
    references: [users.id],
  }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  uploadedByUser: one(users, {
    fields: [attachments.uploadedBy],
    references: [users.id],
  }),
}));
