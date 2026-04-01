"use server";

import { getRequiredSession } from "@/lib/auth/get-session";
import { db } from "@/lib/db";
import { incidents, rmas, users, providers } from "@/lib/db/schema";
import { eq, not, inArray, and, gte, lte } from "drizzle-orm";
import { getSlaThresholds } from "@/server/queries/settings";
import { sql, desc } from "drizzle-orm";
import type { DateRangeParams } from "@/hooks/use-dashboard-params";

export interface DrilldownIncident {
  id: string;
  incidentNumber: string;
  title: string;
  status: string;
  priority: string;
  createdAt: Date;
  assignedUserName: string | null;
}

export interface DrilldownRma {
  id: string;
  rmaNumber: string;
  status: string;
  providerName: string | null;
  deviceBrand: string | null;
  deviceModel: string | null;
  createdAt: Date;
}

const CLOSED_INCIDENT_STATUSES = ["resuelto", "cerrado", "cancelado"] as const;
const CLOSED_RMA_STATUSES = ["recibido_oficina", "cerrado", "cancelado"] as const;

function incidentDateConds(range?: DateRangeParams) {
  const conds = [];
  if (range?.dateFrom) conds.push(gte(incidents.createdAt, new Date(range.dateFrom + "T00:00:00")));
  if (range?.dateTo) conds.push(lte(incidents.createdAt, new Date(range.dateTo + "T23:59:59")));
  return conds;
}

export async function fetchOpenIncidents(range?: DateRangeParams): Promise<DrilldownIncident[]> {
  await getRequiredSession();
  return db
    .select({
      id: incidents.id,
      incidentNumber: incidents.incidentNumber,
      title: incidents.title,
      status: incidents.status,
      priority: incidents.priority,
      createdAt: incidents.createdAt,
      assignedUserName: users.name,
    })
    .from(incidents)
    .leftJoin(users, eq(incidents.assignedUserId, users.id))
    .where(and(
      not(inArray(incidents.status, [...CLOSED_INCIDENT_STATUSES])),
      ...incidentDateConds(range)
    ))
    .orderBy(desc(incidents.createdAt))
    .limit(20);
}

export async function fetchActiveRmas(range?: DateRangeParams): Promise<DrilldownRma[]> {
  await getRequiredSession();
  const conds = [];
  if (range?.dateFrom) conds.push(gte(rmas.createdAt, new Date(range.dateFrom + "T00:00:00")));
  if (range?.dateTo) conds.push(lte(rmas.createdAt, new Date(range.dateTo + "T23:59:59")));

  return db
    .select({
      id: rmas.id,
      rmaNumber: rmas.rmaNumber,
      status: rmas.status,
      providerName: providers.name,
      deviceBrand: rmas.deviceBrand,
      deviceModel: rmas.deviceModel,
      createdAt: rmas.createdAt,
    })
    .from(rmas)
    .leftJoin(providers, eq(rmas.providerId, providers.id))
    .where(and(
      not(inArray(rmas.status, [...CLOSED_RMA_STATUSES])),
      ...conds
    ))
    .orderBy(desc(rmas.createdAt))
    .limit(20);
}

export async function fetchOverdueIncidents(range?: DateRangeParams): Promise<DrilldownIncident[]> {
  await getRequiredSession();
  const sla = await getSlaThresholds();

  return db
    .select({
      id: incidents.id,
      incidentNumber: incidents.incidentNumber,
      title: incidents.title,
      status: incidents.status,
      priority: incidents.priority,
      createdAt: incidents.createdAt,
      assignedUserName: users.name,
    })
    .from(incidents)
    .leftJoin(users, eq(incidents.assignedUserId, users.id))
    .where(
      and(
        not(inArray(incidents.status, [...CLOSED_INCIDENT_STATUSES])),
        sql`(
          (${incidents.priority} = 'critica' and (extract(epoch from (now() - ${incidents.createdAt})) * 1000 - CAST(${incidents.slaPausedMs} AS bigint)) / 3600000.0 > ${sla.resolution.critica}) or
          (${incidents.priority} = 'alta' and (extract(epoch from (now() - ${incidents.createdAt})) * 1000 - CAST(${incidents.slaPausedMs} AS bigint)) / 3600000.0 > ${sla.resolution.alta}) or
          (${incidents.priority} = 'media' and (extract(epoch from (now() - ${incidents.createdAt})) * 1000 - CAST(${incidents.slaPausedMs} AS bigint)) / 3600000.0 > ${sla.resolution.media}) or
          (${incidents.priority} = 'baja' and (extract(epoch from (now() - ${incidents.createdAt})) * 1000 - CAST(${incidents.slaPausedMs} AS bigint)) / 3600000.0 > ${sla.resolution.baja})
        )`,
        ...incidentDateConds(range)
      )
    )
    .orderBy(desc(incidents.createdAt))
    .limit(20);
}
