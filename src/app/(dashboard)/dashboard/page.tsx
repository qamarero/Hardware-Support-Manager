import type { Metadata } from "next";
import { DashboardScreen } from "@/components/dashboard-v2/dashboard-screen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Panel de Control",
};

export default function DashboardPage() {
  return <DashboardScreen />;
}
