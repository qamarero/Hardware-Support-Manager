import { db } from "@/lib/db";
import { incidents, rmas, providers } from "@/lib/db/schema";
import { count, sql, desc, eq, and, isNull, not, inArray } from "drizzle-orm";
import type { DateRangeParams } from "./dashboard";
import { dateConds } from "@/lib/utils/date-conditions";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DeviceTypeBreakdown {
  deviceType: string;
  count: number;
  percentage: number;
}

export interface DeviceBrandBreakdown {
  brand: string;
  count: number;
}

export interface FailingModel {
  brand: string;
  model: string;
  count: number;
  percentage: number;
}

export interface DeviceFailureTrendPoint {
  date: string;
  deviceType: string;
  count: number;
}

export interface ProviderTurnaround {
  providerId: string;
  providerName: string;
  avgDays: number;
  rmaCount: number;
}

export interface ProviderVolume {
  providerId: string;
  providerName: string;
  total: number;
  open: number;
  closed: number;
  cancelled: number;
}

export interface ProviderSuccessRate {
  providerId: string;
  providerName: string;
  total: number;
  successful: number;
  rate: number;
}

export interface CostSummary {
  totalDeviceValue: number | null;
  totalRepairCost: number | null;
  totalShippingCost: number | null;
  totalReplacementCost: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dateConditions(table: typeof incidents | typeof rmas, range?: DateRangeParams) {
  return dateConds(table.createdAt, range);
}

// ─── Device Analytics ────────────────────────────────────────────────────────

export async function getIncidentsByDeviceType(range?: DateRangeParams): Promise<DeviceTypeBreakdown[]> {
  const conditions = dateConditions(incidents, range);

  const rows = await db
    .select({
      deviceType: sql<string>`COALESCE(NULLIF(TRIM(${incidents.deviceType}), ''), 'Sin especificar')`.as("device_type"),
      count: count().as("cnt"),
    })
    .from(incidents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(sql`1`)
    .orderBy(desc(sql`cnt`));

  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return rows.map((r) => ({
    deviceType: r.deviceType,
    count: r.count,
    percentage: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0,
  }));
}

export async function getIncidentsByBrand(range?: DateRangeParams): Promise<DeviceBrandBreakdown[]> {
  const conditions = [
    ...dateConditions(incidents, range),
    sql`TRIM(${incidents.deviceBrand}) != ''`,
    sql`${incidents.deviceBrand} IS NOT NULL`,
  ];

  return db
    .select({
      brand: sql<string>`TRIM(${incidents.deviceBrand})`.as("brand"),
      count: count().as("cnt"),
    })
    .from(incidents)
    .where(and(...conditions))
    .groupBy(sql`1`)
    .orderBy(desc(sql`cnt`))
    .limit(20);
}

export async function getTopFailingModels(range?: DateRangeParams, limit = 15): Promise<FailingModel[]> {
  const conditions = [
    ...dateConditions(incidents, range),
    sql`TRIM(${incidents.deviceBrand}) != ''`,
    sql`${incidents.deviceBrand} IS NOT NULL`,
    sql`TRIM(${incidents.deviceModel}) != ''`,
    sql`${incidents.deviceModel} IS NOT NULL`,
  ];

  const rows = await db
    .select({
      brand: sql<string>`TRIM(${incidents.deviceBrand})`.as("brand"),
      model: sql<string>`TRIM(${incidents.deviceModel})`.as("model"),
      count: count().as("cnt"),
    })
    .from(incidents)
    .where(and(...conditions))
    .groupBy(sql`1`, sql`2`)
    .orderBy(desc(sql`cnt`))
    .limit(limit);

  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return rows.map((r) => ({
    brand: r.brand,
    model: r.model,
    count: r.count,
    percentage: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0,
  }));
}

export async function getDeviceFailureTrend(range?: DateRangeParams): Promise<DeviceFailureTrendPoint[]> {
  const conditions = dateConditions(incidents, range);

  return db
    .select({
      date: sql<string>`to_char(${incidents.createdAt}::date, 'YYYY-MM-DD')`.as("date"),
      deviceType: sql<string>`COALESCE(NULLIF(TRIM(${incidents.deviceType}), ''), 'Sin especificar')`.as("device_type"),
      count: count().as("cnt"),
    })
    .from(incidents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(sql`1`, sql`2`)
    .orderBy(sql`1`);
}

// ─── Provider Analytics ──────────────────────────────────────────────────────

export async function getProviderRmaTurnaround(range?: DateRangeParams): Promise<ProviderTurnaround[]> {
  // Estados terminales del ciclo con el proveedor (excluye `cancelado`, que
  // aborta sin turnaround real). Incluye los cierres nuevos entregado/rechazado.
  const closedStatuses = ["cerrado", "entregado_cliente", "rechazado"] as const;
  const conditions = [
    ...dateConditions(rmas, range),
    // NOTE: usar `inArray` en vez de `sql\`... = ANY(${array})\`` porque el
    // template literal de drizzle splittea el JS array en parámetros separados
    // (`ANY($3, $4)`) que es SQL inválido en Postgres y revienta en runtime
    // cuando hay datos. `inArray` genera correctamente `"col" in ($3, $4)`.
    inArray(rmas.status, closedStatuses),
  ];

  return db
    .select({
      providerId: rmas.providerId,
      providerName: providers.name,
      avgDays: sql<number>`ROUND(AVG(EXTRACT(EPOCH FROM (${rmas.updatedAt} - ${rmas.createdAt})) / 86400)::numeric, 1)`.as("avg_days"),
      rmaCount: count().as("rma_count"),
    })
    .from(rmas)
    .innerJoin(providers, eq(rmas.providerId, providers.id))
    .where(and(...conditions))
    .groupBy(rmas.providerId, providers.name)
    .orderBy(desc(sql`avg_days`));
}

export async function getProviderRmaVolume(range?: DateRangeParams): Promise<ProviderVolume[]> {
  const conditions = dateConditions(rmas, range);

  return db
    .select({
      providerId: rmas.providerId,
      providerName: providers.name,
      total: count().as("total"),
      open: sql<number>`COUNT(*) FILTER (WHERE ${rmas.status} NOT IN ('cerrado', 'cancelado', 'entregado_cliente', 'rechazado'))`.as("open"),
      closed: sql<number>`COUNT(*) FILTER (WHERE ${rmas.status} IN ('cerrado', 'entregado_cliente'))`.as("closed"),
      cancelled: sql<number>`COUNT(*) FILTER (WHERE ${rmas.status} IN ('cancelado', 'rechazado'))`.as("cancelled"),
    })
    .from(rmas)
    .innerJoin(providers, eq(rmas.providerId, providers.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(rmas.providerId, providers.name)
    .orderBy(desc(sql`total`));
}

export async function getProviderSuccessRate(range?: DateRangeParams): Promise<ProviderSuccessRate[]> {
  // Terminados = los 4 estados de cierre canónicos. Éxito = resuelto a favor
  // del cliente (cerrado o entregado al cliente); rechazado/cancelado no.
  const finishedStatuses = ["cerrado", "cancelado", "entregado_cliente", "rechazado"] as const;
  const conditions = [
    ...dateConditions(rmas, range),
    // Mismo fix que en getProviderRmaTurnaround — ver comentario allí.
    inArray(rmas.status, finishedStatuses),
  ];

  const rows = await db
    .select({
      providerId: rmas.providerId,
      providerName: providers.name,
      total: count().as("total"),
      successful: sql<number>`COUNT(*) FILTER (WHERE ${rmas.status} IN ('cerrado', 'entregado_cliente'))`.as("successful"),
    })
    .from(rmas)
    .innerJoin(providers, eq(rmas.providerId, providers.id))
    .where(and(...conditions))
    .groupBy(rmas.providerId, providers.name)
    .orderBy(desc(sql`total`));

  return rows.map((r) => ({
    ...r,
    rate: r.total > 0 ? Math.round((r.successful / r.total) * 1000) / 10 : 0,
  }));
}

// ─── Cost Analytics (returns nulls until cost data is populated) ─────────────

export async function getCostSummary(range?: DateRangeParams): Promise<CostSummary> {
  const conditions = dateConditions(rmas, range);

  const [result] = await db
    .select({
      totalDeviceValue: sql<number | null>`SUM(${rmas.deviceValueCents})`.as("total_device_value"),
      totalRepairCost: sql<number | null>`SUM(${rmas.repairCostCents})`.as("total_repair_cost"),
      totalShippingCost: sql<number | null>`SUM(${rmas.shippingCostCents})`.as("total_shipping_cost"),
      totalReplacementCost: sql<number | null>`SUM(${rmas.replacementCostCents})`.as("total_replacement_cost"),
    })
    .from(rmas)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return result;
}
