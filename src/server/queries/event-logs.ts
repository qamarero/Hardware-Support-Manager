import { db } from "@/lib/db";
import { eventLogs, users, attachments } from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { ENTITY_TYPES, type EntityType } from "@/lib/constants/attachments";

/** Adjunto colgado de una entrada del historial (captura, foto de etiqueta…). */
export type EventLogAttachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
};

export type EventLogRow = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  fromState: string | null;
  toState: string | null;
  userId: string | null;
  userName: string | null;
  details: unknown;
  createdAt: Date;
  /** Ficheros de esa entrada. Vacío en la mayoría de eventos. */
  attachments: EventLogAttachment[];
};

/**
 * Historial de una entidad, con los ficheros de cada entrada.
 *
 * Los adjuntos de una nota se guardan con `entity_type = 'event_log'` y el id
 * de la entrada como `entity_id`, así que no se pueden pedir por la entidad
 * padre: se traen en una segunda consulta acotada a los ids de este historial y
 * se agrupan en memoria. Son dos viajes a la base de datos por historial, no
 * uno por evento.
 */
export async function getEventLogs(
  entityType: EntityType,
  entityId: string
): Promise<EventLogRow[]> {
  const logs = await db
    .select({
      id: eventLogs.id,
      entityType: eventLogs.entityType,
      entityId: eventLogs.entityId,
      action: eventLogs.action,
      fromState: eventLogs.fromState,
      toState: eventLogs.toState,
      userId: eventLogs.userId,
      userName: users.name,
      details: eventLogs.details,
      createdAt: eventLogs.createdAt,
    })
    .from(eventLogs)
    .leftJoin(users, eq(eventLogs.userId, users.id))
    .where(
      and(
        eq(eventLogs.entityType, entityType),
        eq(eventLogs.entityId, entityId)
      )
    )
    .orderBy(desc(eventLogs.createdAt));

  if (logs.length === 0) return [];

  const files = await db
    .select({
      id: attachments.id,
      entityId: attachments.entityId,
      fileName: attachments.fileName,
      fileUrl: attachments.fileUrl,
      fileType: attachments.fileType,
      fileSize: attachments.fileSize,
    })
    .from(attachments)
    .where(
      and(
        eq(attachments.entityType, ENTITY_TYPES.EVENT_LOG),
        inArray(
          attachments.entityId,
          logs.map((l) => l.id)
        )
      )
    )
    .orderBy(attachments.createdAt);

  const byLog = new Map<string, EventLogAttachment[]>();
  for (const f of files) {
    const list = byLog.get(f.entityId) ?? [];
    list.push({
      id: f.id,
      fileName: f.fileName,
      fileUrl: f.fileUrl,
      fileType: f.fileType,
      fileSize: f.fileSize,
    });
    byLog.set(f.entityId, list);
  }

  return logs.map((l) => ({ ...l, attachments: byLog.get(l.id) ?? [] }));
}
