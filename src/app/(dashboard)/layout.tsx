import { AppShell } from "@/components/shell/app-shell";
import { DrawersProvider } from "@/components/shell/drawers-provider";
import { QuickConsultationProvider } from "@/components/incidents/quick-consultation-modal";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QuickConsultationProvider>
      <DrawersProvider>
        <AppShell>{children}</AppShell>
      </DrawersProvider>
    </QuickConsultationProvider>
  );
}
