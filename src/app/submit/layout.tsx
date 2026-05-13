import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reportar incidencia hardware | HSM",
  description: "Formulario para el equipo CX de Qamarero — reporta una incidencia de hardware",
};

export default function SubmitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            HSM
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">Hardware Support Manager</h1>
            <p className="text-xs text-muted-foreground">Reportar incidencia de hardware</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">
        {children}
      </main>
      <footer className="mx-auto max-w-3xl px-6 py-6 text-xs text-muted-foreground text-center">
        Solo equipo interno Qamarero. Las sumisiones son revisadas antes de crear incidencias.
      </footer>
    </div>
  );
}
