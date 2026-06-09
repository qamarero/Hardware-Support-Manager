import type { Metadata } from "next";
import { IncidentsScreen } from "@/components/incidents-v2/incidents-screen";

export const metadata: Metadata = {
  title: "Incidencias",
};

export const dynamic = "force-dynamic";

export default function IncidentsPage() {
  return <IncidentsScreen />;
}
