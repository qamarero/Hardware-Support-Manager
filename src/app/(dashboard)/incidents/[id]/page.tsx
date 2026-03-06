import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IncidentDetail } from "@/components/incidents/incident-detail";
import { getIncidentById } from "@/server/queries/incidents";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const incident = await getIncidentById(id);

  if (!incident) {
    return { title: "Incidencia no encontrada" };
  }

  return {
    title: `${incident.incidentNumber} - ${incident.title}`,
  };
}

export default async function IncidentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const incident = await getIncidentById(id);

  if (!incident) {
    notFound();
  }

  return <IncidentDetail incident={incident} />;
}
