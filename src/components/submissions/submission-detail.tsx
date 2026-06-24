"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Loader2, CheckCircle, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SubmissionStatusBadge } from "./submission-status-badge";
import {
  convertSubmissionToIncident,
  dismissSubmission,
} from "@/server/actions/support-submissions";
import { formatRelativeTime } from "@/lib/utils/date-format";
import { INCIDENT_CATEGORY_LABELS } from "@/lib/constants/incidents";
import type { SupportSubmissionRow } from "@/server/queries/support-submissions";

interface SubmissionDetailProps {
  item: SupportSubmissionRow;
  onConvert: () => void;
  onDismiss: () => void;
}

export function SubmissionDetail({ item, onConvert, onDismiss }: SubmissionDetailProps) {
  // Editable fields (pre-filled from submission)
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [priority, setPriority] = useState<"baja" | "media" | "alta" | "critica">(item.priority);
  const [category, setCategory] = useState<"escalado" | "incidencia_directa" | "mencion" | "otro">("escalado");
  const [hardwareOrigin, setHardwareOrigin] = useState<"qamarero" | "cliente_reciclado" | "">("");
  const [deviceType, setDeviceType] = useState(item.deviceType ?? "");
  const [deviceBrand, setDeviceBrand] = useState(item.deviceBrand ?? "");
  const [deviceModel, setDeviceModel] = useState(item.deviceModel ?? "");
  const [deviceSerialNumber, setDeviceSerialNumber] = useState(item.deviceSerialNumber ?? "");
  const [contactPhone, setContactPhone] = useState(item.contactPhone ?? "");
  const [intercomUrl, setIntercomUrl] = useState(item.intercomUrl ?? "");
  const [dataOpen, setDataOpen] = useState(false);

  const isPending = item.status === "pendiente";
  const isConverted = item.status === "convertida";
  const isDismissed = item.status === "descartada";

  const convertMutation = useMutation({
    mutationFn: () => {
      if (!hardwareOrigin) {
        throw new Error("Selecciona el origen del hardware (Qamarero / Reciclado)");
      }
      return convertSubmissionToIncident({
        submissionId: item.id,
        title: title.trim(),
        description: description.trim(),
        priority,
        category,
        hardwareOrigin,
        clientId: item.clientId ?? undefined,
        deviceType: deviceType || undefined,
        deviceBrand: deviceBrand || undefined,
        deviceModel: deviceModel || undefined,
        deviceSerialNumber: deviceSerialNumber || undefined,
        contactPhone: contactPhone || undefined,
        intercomUrl: intercomUrl || undefined,
      });
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Incidencia ${result.data.incidentNumber} creada`, {
          action: {
            label: "Ver",
            onClick: () => window.open(`/incidents/${result.data.incidentId}`, "_self"),
          },
        });
        onConvert();
      } else {
        toast.error(result.error);
      }
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al crear incidencia"),
  });

  const dismissMutation = useMutation({
    mutationFn: () => dismissSubmission({ submissionId: item.id }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Sumisión descartada");
        onDismiss();
      } else {
        toast.error(result.error);
      }
    },
  });

  return (
    <div
      className="p-6 space-y-5"
      style={{ animation: "fadeInUp 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{item.clientName}</h3>
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <SubmissionStatusBadge status={item.status} />
            <span>·</span>
            <span>Enviado por {item.submitterName} ({item.submitterEmail})</span>
            <span>·</span>
            <span>{formatRelativeTime(item.createdAt)}</span>
          </div>
        </div>
        {item.intercomUrl && (
          <Button asChild size="sm" variant="ghost">
            <a href={item.intercomUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1 h-3 w-3" />
              Intercom
            </a>
          </Button>
        )}
      </div>

      {/* Extracted data preview */}
      <div className="rounded-lg border bg-muted/30">
        <button
          type="button"
          onClick={() => setDataOpen(!dataOpen)}
          className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium hover:bg-muted/50 rounded-lg"
        >
          <span>Datos recibidos del formulario</span>
          {dataOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {dataOpen && (
          <div className="px-4 pb-3 space-y-1 text-xs">
            <p><span className="text-muted-foreground">Cliente matcheado:</span>{" "}
              {item.matchedClientName ? (
                <span className="text-green-600 dark:text-green-400">{item.matchedClientName} ✓</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">no encontrado en HSM</span>
              )}
            </p>
            <p><span className="text-muted-foreground">Tipo dispositivo:</span> {item.deviceType || "—"}</p>
            <p><span className="text-muted-foreground">Marca / Modelo:</span> {item.deviceBrand || "—"} {item.deviceModel || ""}</p>
            <p><span className="text-muted-foreground">Nº serie:</span> {item.deviceSerialNumber || "—"}</p>
            <p><span className="text-muted-foreground">Teléfono contacto:</span> {item.contactPhone || "—"}</p>
            <p><span className="text-muted-foreground">URL Intercom:</span> {item.intercomUrl || "—"}</p>
          </div>
        )}
      </div>

      {/* Fotos adjuntas del formulario */}
      {item.attachments && item.attachments.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Fotos adjuntas ({item.attachments.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {item.attachments.map((a) => (
              <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.name} className="h-20 w-20 rounded-lg border object-cover transition hover:opacity-80" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Conversion form (only for pending) */}
      {isPending && (
        <>
          <Separator className="bg-border/40" />
          <div className="space-y-4">
            <h4 className="flex items-center gap-3 text-sm font-semibold uppercase tracking-wide">
              <span className="h-4 w-1 rounded-full bg-primary" />
              Crear Incidencia
            </h4>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs">Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs">Descripción</Label>
                <Textarea
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Categoría</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="escalado">{INCIDENT_CATEGORY_LABELS.escalado}</SelectItem>
                    <SelectItem value="incidencia_directa">{INCIDENT_CATEGORY_LABELS.incidencia_directa}</SelectItem>
                    <SelectItem value="mencion">{INCIDENT_CATEGORY_LABELS.mencion}</SelectItem>
                    <SelectItem value="otro">{INCIDENT_CATEGORY_LABELS.otro}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Prioridad</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="critica">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs">Origen del hardware *</Label>
                <ToggleGroup
                  type="single"
                  value={hardwareOrigin}
                  onValueChange={(v) => v && setHardwareOrigin(v as typeof hardwareOrigin)}
                  className="justify-start"
                >
                  <ToggleGroupItem value="qamarero">Qamarero</ToggleGroupItem>
                  <ToggleGroupItem value="cliente_reciclado">Reciclado cliente</ToggleGroupItem>
                </ToggleGroup>
                {!hardwareOrigin && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Requerido para crear la incidencia
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Tipo dispositivo</Label>
                <Input value={deviceType} onChange={(e) => setDeviceType(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Marca</Label>
                <Input value={deviceBrand} onChange={(e) => setDeviceBrand(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Modelo</Label>
                <Input value={deviceModel} onChange={(e) => setDeviceModel(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nº serie</Label>
                <Input value={deviceSerialNumber} onChange={(e) => setDeviceSerialNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Teléfono contacto</Label>
                <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">URL Intercom</Label>
                <Input value={intercomUrl} onChange={(e) => setIntercomUrl(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => dismissMutation.mutate()}
                disabled={dismissMutation.isPending}
              >
                <X className="mr-2 h-4 w-4" />
                Descartar
              </Button>
              <Button
                onClick={() => convertMutation.mutate()}
                disabled={convertMutation.isPending || !title.trim() || !hardwareOrigin}
              >
                {convertMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Crear Incidencia
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Status messages for non-pending */}
      {isConverted && item.convertedIncidentNumber && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm">
          ✓ Convertida en incidencia{" "}
          <a
            href={`/incidents/${item.convertedIncidentId}`}
            className="font-medium text-primary hover:underline"
          >
            {item.convertedIncidentNumber}
          </a>
        </div>
      )}
      {isDismissed && (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          Esta sumisión fue descartada.
          {item.dismissReason && (
            <p className="mt-1">Razón: {item.dismissReason}</p>
          )}
        </div>
      )}
    </div>
  );
}
