import type { Metadata } from "next";
import { KanbanScreen } from "@/components/tablero-v2/kanban-screen";

export const metadata: Metadata = { title: "Tablero Kanban" };

export default function TableroPage() {
  return <KanbanScreen />;
}
