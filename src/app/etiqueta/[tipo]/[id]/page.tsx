import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRmaById } from "@/server/queries/rmas";
import { RMA_STATUS_LABELS, type RmaStatus } from "@/lib/constants/rmas";
import { LabelPrintClient, type LabelData, type LabelFormat } from "@/components/etiquetas/label-print-client";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function EtiquetaPage({
  params,
  searchParams,
}: {
  params: Promise<{ tipo: string; id: string }>;
  searchParams: Promise<{ f?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { tipo, id } = await params;
  const { f } = await searchParams;
  const formato: LabelFormat = f === "envio" ? "envio" : "etiqueta";

  if (tipo === "rma") {
    const rma = await getRmaById(id);
    if (!rma) notFound();

    const device = [rma.deviceBrand, rma.deviceModel].filter(Boolean).join(" ") || "Equipo sin especificar";
    const data: LabelData = {
      kind: "RMA",
      code: rma.rmaNumber,
      device: rma.deviceType ? `${device} · ${rma.deviceType}` : device,
      serial: rma.deviceSerialNumber ?? null,
      client: rma.clientCompanyName ?? rma.clientName ?? null,
      provider: rma.providerName ?? null,
      statusLabel: RMA_STATUS_LABELS[rma.status as RmaStatus] ?? rma.status,
      date: fmtDate(rma.createdAt),
      recordPath: `/rmas/${rma.id}`,
    };
    return <LabelPrintClient data={data} formato={formato} />;
  }

  // tipo === "equipo" → Fase 2 (registro de equipos sin RMA)
  notFound();
}
