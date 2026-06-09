import { AppShell } from "@/components/shell/app-shell";
import { QuickConsultationProvider } from "@/components/incidents/quick-consultation-modal";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QuickConsultationProvider>
      <AppShell>{children}</AppShell>
    </QuickConsultationProvider>
  );
}
