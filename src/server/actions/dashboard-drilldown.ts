"use server";

import { getRequiredSession } from "@/lib/auth/get-session";
import { db } from "@/lib/db";
import { incidents, rmas, users, providers } from "@/lib/db/schema";
import { eq, not, inArray, and } from "drizzle-orm";
import { desc } from "drizzle-orm";
import { getSlaThresholds } from "@/server/queries/settings";
import type { DateRangeParams } from "@/hooks/use-dashboard-params";
import { CLOSED_INCIDENT_STATUSES, CLOSED_RMA_STATUSES } from "@/lib/constants/statuses";
import { incidentDateConds, rmaDateConds } from "@/lib/utils/date-conditions";
import { slaElapsedHours, buildSlaPriorityCondition } from "@/lib/utils/sla-sql";

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

export async function fetchOpenIncidents(
  range?: DateRangeParams,
): Promise<DrilldownIncident[]> {
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
    .where(
      and(
        not(inArray(incidents.status, [...CLOSED_INCIDENT_STATUSES])),
        ...incidentDateConds(range),
      ),
    )
    .orderBy(desc(incidents.createdAt))
    .limit(20);
}

export async function fetchActiveRmas(
  range?: DateRangeParams,
): Promise<DrilldownRma[]> {
  await getRequiredSession();
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
    .where(
      and(
        not(inArray(rmas.status, [...CLOSED_RMA_STATUSES])),
        ...rmaDateConds(range),
      ),
    )
    .orderBy(desc(rmas.createdAt))
    .limit(20);
}

export async function fetchOverdueIncidents(
  range?: DateRangeParams,
): Promise<DrilldownIncident[]> {
  await getRequiredSession();
  const sla = await getSlaThresholds();

  const elapsedHours = slaElapsedHours(incidents.createdAt, incidents.slaPausedMs, incidents.status, incidents.stateChangedAt);
  const overdueCondition = buildSlaPriorityCondition(
    incidents.priority,
    elapsedHours,
    sla,
    "exceeded",
  );

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
        overdueCondition,
        ...incidentDateConds(range),
      ),
    )
    .orderBy(desc(incidents.createdAt))
    .limit(20);
}
