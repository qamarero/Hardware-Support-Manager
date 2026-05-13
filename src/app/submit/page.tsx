import { SubmissionForm } from "@/components/submit/submission-form";

export const dynamic = "force-dynamic";

export default function SubmitPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Reportar incidencia de hardware</h2>
        <p className="text-sm text-muted-foreground">
          Formulario interno para el equipo CX. Rellena los datos con la mayor precisión posible —
          facilita el trabajo del equipo de soporte hardware.
        </p>
      </div>
      <SubmissionForm />
    </div>
  );
}
