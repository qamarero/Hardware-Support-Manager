import { QamareroLogo } from "@/components/layout/qamarero-logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Panel izquierdo - Branding Qamarero */}
      <div className="hidden flex-col justify-between bg-[#212121] p-10 text-white lg:flex lg:w-1/2">
        <div className="flex items-center gap-3">
          <QamareroLogo className="text-white" size={28} />
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-semibold">Qamarero</span>
            <span className="font-mono text-[11px] uppercase tracking-wider text-white/55">
              Hardware · Soporte
            </span>
          </div>
        </div>
        <div className="space-y-4">
          <h2 className="text-3xl font-bold leading-tight">
            Gestión integral de<br />
            soporte técnico
          </h2>
          <p className="text-base text-white/60">
            Incidencias, RMAs y seguimiento completo del ciclo de vida del hardware de tus clientes.
          </p>
        </div>
        <p className="text-sm text-white/40">
          &copy; {new Date().getFullYear()} Hardware Support Manager
        </p>
      </div>
      {/* Panel derecho - Formulario */}
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        {children}
      </div>
    </div>
  );
}
