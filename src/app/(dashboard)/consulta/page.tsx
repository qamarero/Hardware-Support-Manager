import type { Metadata } from "next";
import { ConsultaScreen } from "@/components/consulta/consulta-screen";

export const metadata: Metadata = { title: "Consulta · HSM" };

export default function ConsultaPage() {
  return <ConsultaScreen />;
}
