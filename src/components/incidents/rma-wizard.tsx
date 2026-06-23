"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Check, ChevronRight, ChevronLeft, Package, FileText, ClipboardCheck } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArticleCombobox } from "@/components/proto/article-combobox";
import { fetchProvidersForSelect, createRma } from "@/server/actions/rmas";
import { transitionIncident } from "@/server/actions/incidents";
import type { RmaFormInput } from "@/lib/validators/rma";
import type { IncidentRow } from "@/server/queries/incidents";
import { invalidateRmaQueries } from "@/lib/query-keys";

interface RmaWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incident: IncidentRow;
}

// Plantillas de motivo (prototipo Qamarero — contexto soporte hardware).
const REASON_TEMPLATES: { id: string; title: string; text: string }[] = [
  { id: "hw_fail", title: "Fallo de hardware confirmado", text: "Tras diagnóstico se confirma fallo de hardware. Pruebas realizadas descartan software y configuración. Se solicita sustitución bajo garantía." },
  { id: "screen", title: "Pantalla / display dañado", text: "Panel con líneas, parpadeo o píxeles muertos. Confirmado mediante prueba con monitor externo (descarta GPU)." },
  { id: "battery", title: "Batería degradada", text: "Autonomía muy por debajo de lo esperado. Diagnóstico del sistema confirma capacidad degradada / ciclos excesivos." },
  { id: "noboot", title: "Equipo no enciende", text: "El equipo no responde al botón de encendido. Pruebas con cargador propio y de préstamo, descartados ambos. Posible fallo de placa o circuito de alimentación." },
  { id: "overheat", title: "Sobrecalentamiento / apagones", text: "Equipo se apaga por temperatura tras unos minutos de uso. Limpieza y pasta térmica aplicadas sin éxito." },
  { id: "periph", title: "Periférico no funcional", text: "Periférico no se conecta o pierde conexión repetidamente. Probado en varios equipos y puertos." },
  { id: "physical", title: "Daño físico (no cubierto)", text: "Daño físico visible. Consultar con proveedor sobre coberturas accidentales." },
  { id: "other", title: "Otro motivo", text: "" },
];

const URGENCIES = [
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];

const STEPS = [
  { n: 1, label: "Equipo y proveedor", icon: Package },
  { n: 2, label: "Motivo", icon: FileText },
  { n: 3, label: "Confirmar", icon: ClipboardCheck },
];

export function RmaWizard({ open, onOpenChange, incident }: RmaWizardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);

  const [providerId, setProviderId] = useState("");
  const [articleId, setArticleId] = useState(incident.articleId ?? "");
  const [deviceType, setDeviceType] = useState(incident.deviceType ?? "");
  const [deviceBrand, setDeviceBrand] = useState(incident.deviceBrand ?? "");
  const [deviceModel, setDeviceModel] = useState(incident.deviceModel ?? "");
  const [deviceSerial, setDeviceSerial] = useState(incident.deviceSerialNumber ?? "");
  const [reasonTpl, setReasonTpl] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [urgency, setUrgency] = useState("normal");
  const [providerRmaNumber, setProviderRmaNumber] = useState("");
  const [extraNotes, setExtraNotes] = useState("");

  const { data: providers = [], isLoading: loadingProviders } = useQuery({
    queryKey: ["providers", "select"],
    queryFn: () => fetchProvidersForSelect(),
    enabled: open,
  });

  function reset() {
    setStep(1);
    setProviderId("");
    setReasonTpl(null);
    setReason("");
    setUrgency("normal");
    setProviderRmaNumber("");
    setExtraNotes("");
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const notesParts = [
        urgency !== "normal" ? `Urgencia: ${urgency.toUpperCase()}` : null,
        reason.trim(),
        extraNotes.trim(),
        `Origen: ${incident.incidentNumber}`,
      ].filter(Boolean);

      const payload: RmaFormInput = {
        providerId,
        incidentId: incident.id,
        clientId: incident.clientId ?? "",
        clientName: incident.clientCompanyName ?? incident.clientName ?? "",
        clientIntercomUrl: incident.intercomUrl ?? "",
        articleId,
        deviceType,
        deviceBrand,
        deviceModel,
        deviceSerialNumber: deviceSerial,
        contactName: incident.contactName ?? "",
        contactPhone: incident.contactPhone ?? "",
        pickupAddress: incident.pickupAddress ?? "",
        pickupPostalCode: incident.pickupPostalCode ?? "",
        pickupCity: incident.pickupCity ?? "",
        providerRmaNumber,
        notes: notesParts.join("\n\n"),
      };

      const result = await createRma(payload);
      if (!result.success) throw new Error(result.error);

      // Derivar: pausar la incidencia pasándola a "esperando_pieza" (si la
      // transición es válida desde su estado actual). Reutiliza transitionIncident
      // → acumula la pausa de SLA y postea la nota a Intercom. Si no es válida,
      // el RMA igualmente queda creado.
      const DERIVABLE = ["en_gestion", "esperando_cliente", "esperando_proveedor"];
      if (DERIVABLE.includes(incident.status)) {
        await transitionIncident({
          incidentId: incident.id,
          toStatus: "esperando_pieza",
          comment: `Derivado a RMA — esperando pieza/sustituto del proveedor.`,
        }).catch(() => { /* el RMA ya está creado; la pausa es best-effort */ });
      }

      return result.data.id;
    },
    onSuccess: (rmaId) => {
      toast.success("RMA creado · incidencia en espera de pieza");
      queryClient.invalidateQueries({ queryKey: ["linked-rmas", incident.id] });
      invalidateRmaQueries(queryClient);
      onOpenChange(false);
      reset();
      router.push(`/rmas/${rmaId}`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Error al crear RMA"),
  });

  const canNext =
    step === 1 ? !!providerId :
    step === 2 ? !!reason.trim() :
    true;

  function pickTemplate(id: string) {
    setReasonTpl(id);
    const tpl = REASON_TEMPLATES.find((t) => t.id === id);
    if (tpl && tpl.id !== "other") setReason(tpl.text);
    else if (tpl?.id === "other") setReason("");
  }

  const providerName = providers.find((p) => p.id === providerId)?.name ?? "—";

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Derivar a RMA desde {incident.incidentNumber}</SheetTitle>
          <SheetDescription>
            Al crear el RMA, la incidencia pasa a «Esperando pieza» y su SLA se pausa.
          </SheetDescription>
        </SheetHeader>

        {/* Stepper */}
        <div className="mt-6 flex items-center gap-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = s.n === step;
            const done = s.n < step;
            return (
              <div key={s.n} className="flex flex-1 items-center gap-2">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    done ? "bg-primary text-primary-foreground"
                      : active ? "bg-primary/15 text-primary ring-2 ring-primary/30"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className={`hidden text-xs font-medium sm:block ${active ? "text-foreground" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
              </div>
            );
          })}
        </div>

        <div className="mt-6 space-y-4">
          {/* Paso 1 */}
          {step === 1 && (
            <div className="space-y-4" style={{ animation: "fadeInUp 200ms ease-out both" }}>
              <div className="space-y-2">
                <Label>Proveedor *</Label>
                {loadingProviders ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
                ) : (
                  <Select value={providerId} onValueChange={setProviderId}>
                    <SelectTrigger><SelectValue placeholder="Selecciona proveedor" /></SelectTrigger>
                    <SelectContent>
                      {providers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>Equipo (catálogo)</Label>
                <ArticleCombobox
                  value={articleId}
                  onSelect={(a) => {
                    setArticleId(a?.id ?? "");
                    setDeviceType(a?.deviceType ?? "");
                    setDeviceBrand(a?.brand ?? "");
                    setDeviceModel(a?.model ?? "");
                  }}
                />
                {(deviceBrand || deviceModel) && (
                  <p className="text-xs text-muted-foreground">{[deviceBrand, deviceModel].filter(Boolean).join(" ")}</p>
                )}
              </div>
              <div className="space-y-2"><Label>Nº de serie</Label><Input value={deviceSerial} onChange={(e) => setDeviceSerial(e.target.value)} /></div>
            </div>
          )}

          {/* Paso 2 */}
          {step === 2 && (
            <div className="space-y-4" style={{ animation: "fadeInUp 200ms ease-out both" }}>
              <div className="space-y-2">
                <Label>Plantilla de motivo</Label>
                <div className="grid grid-cols-2 gap-2">
                  {REASON_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => pickTemplate(t.id)}
                      className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${
                        reasonTpl === t.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                      }`}
                    >
                      {t.title}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Motivo (editable)</Label>
                <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Describe el motivo del RMA" />
              </div>
              <div className="space-y-2">
                <Label>Urgencia</Label>
                <Select value={urgency} onValueChange={setUrgency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {URGENCIES.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Paso 3 */}
          {step === 3 && (
            <div className="space-y-4" style={{ animation: "fadeInUp 200ms ease-out both" }}>
              <dl className="grid grid-cols-[120px_1fr] gap-2 rounded-lg border p-3 text-sm">
                <dt className="text-muted-foreground">Proveedor</dt><dd className="font-medium">{providerName}</dd>
                <dt className="text-muted-foreground">Equipo</dt><dd>{[deviceBrand, deviceModel].filter(Boolean).join(" ") || "—"}</dd>
                <dt className="text-muted-foreground">Nº serie</dt><dd className="font-mono text-xs">{deviceSerial || "—"}</dd>
                <dt className="text-muted-foreground">Urgencia</dt><dd>{URGENCIES.find((u) => u.value === urgency)?.label}</dd>
                <dt className="text-muted-foreground">Motivo</dt><dd className="whitespace-pre-line">{reason || "—"}</dd>
              </dl>
              <div className="space-y-2">
                <Label>Nº RMA del proveedor (opcional)</Label>
                <Input value={providerRmaNumber} onChange={(e) => setProviderRmaNumber(e.target.value)} placeholder="Ej: DL-RMA-87423-ES" />
              </div>
              <div className="space-y-2">
                <Label>Notas adicionales (opcional)</Label>
                <Textarea rows={2} value={extraNotes} onChange={(e) => setExtraNotes(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="mt-6 flex items-center justify-between gap-2 border-t pt-4">
          <Button
            variant="ghost"
            onClick={() => (step > 1 ? setStep(step - 1) : onOpenChange(false))}
            disabled={mutation.isPending}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {step > 1 ? "Atrás" : "Cancelar"}
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
              Siguiente <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !providerId}>
              {mutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
              Crear RMA
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
