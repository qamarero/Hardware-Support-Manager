"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, Copy, Check, ExternalLink, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { fetchProviderById } from "@/server/actions/providers";
import { fetchIncidentById } from "@/server/actions/incidents";
import { fetchActiveTemplates } from "@/server/actions/message-templates";
import {
  renderTemplate,
  unresolvedVariables,
  tidyRendered,
} from "@/lib/constants/message-templates";
import { RMA_STATUS_LABELS, type RmaStatus } from "@/lib/constants/rmas";
import {
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_PRIORITY_LABELS,
  HARDWARE_ORIGIN_LABELS,
  type IncidentCategory,
  type IncidentPriority,
  type HardwareOrigin,
} from "@/lib/constants/incidents";
import { DEVICE_TYPE_LABELS, type DeviceType } from "@/lib/constants/device-types";
import type { RmaRow } from "@/server/queries/rmas";
import type { RmaShipping } from "@/lib/db/schema/rmas";
import type { ProviderRmaProcess } from "@/lib/db/schema/providers";

/**
 * Genera el correo de RMA al proveedor: usa el email TO/CC del procedimiento
 * del proveedor, una plantilla (categoría proveedor) o un mensaje por defecto,
 * y los datos del RMA + recogida. Abre el cliente de correo (mailto) o copia.
 */
export function RmaProviderEmail({ rma }: { rma: RmaRow }) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: provider } = useQuery({
    queryKey: ["provider-rma-info", rma.providerId],
    queryFn: () => fetchProviderById(rma.providerId),
    enabled: open && !!rma.providerId,
  });
  // La incidencia de origen: de ella salen la descripción del problema y el
  // resto de datos del caso. Sin cargarla, una plantilla que use
  // `{{description}}` se enviaba con el hueco sin rellenar.
  const { data: incident } = useQuery({
    queryKey: ["rma-origin-incident", rma.incidentId],
    queryFn: () => fetchIncidentById(rma.incidentId as string),
    enabled: open && !!rma.incidentId,
  });
  const { data: templates = [] } = useQuery({
    queryKey: ["message-templates", "active"],
    queryFn: () => fetchActiveTemplates(),
    enabled: open,
  });
  const providerTemplates = templates.filter((t) => t.category === "proveedor");

  const proc: ProviderRmaProcess = provider?.rmaProcess ?? {};
  const ship: RmaShipping = rma.shipping ?? {};
  const emailTo = proc.emailTo || provider?.email || "";
  const emailCc = proc.emailCc || "";

  const clientName = rma.clientCompanyName ?? rma.clientName ?? "";
  const deviceTypeLabel = rma.deviceType
    ? DEVICE_TYPE_LABELS[rma.deviceType as DeviceType] ?? rma.deviceType
    : "";
  const device =
    [rma.deviceBrand, rma.deviceModel].filter(Boolean).join(" ") ||
    deviceTypeLabel ||
    "equipo";

  const contactName = ship.contactName ?? rma.contactName ?? "";
  const contactPhone = ship.contactPhone ?? rma.contactPhone ?? "";
  const contactEmail = ship.contactEmail ?? "";
  const pickupAddress = ship.address ?? rma.pickupAddress ?? "";
  const pickupCity = ship.city ?? rma.pickupCity ?? "";
  const pickupPostalCode = ship.postalCode ?? rma.pickupPostalCode ?? "";

  // Bloque de recogida y bloque de destino, por separado: una plantilla puede
  // traer ya la dirección de recogida y necesitar solo el destino.
  const dest = ship.destination;
  const recogidaBlock = [
    "Datos de recogida:",
    `- ${ship.locationName || clientName || "—"}${contactName ? " · " + contactName : ""}`,
    `- ${[pickupAddress, [pickupPostalCode, pickupCity].filter(Boolean).join(" "), ship.province].filter(Boolean).join(", ") || "—"}`,
    `- Tel: ${contactPhone || "—"}${contactEmail ? " · " + contactEmail : ""}`,
    ...(ship.instructions ? [`- Instrucciones: ${ship.instructions}`] : []),
  ].join("\n");
  const destinoBlock =
    dest && (dest.address || dest.name)
      ? [
          "Destino del envío:",
          ...(dest.name || dest.contact
            ? [`- ${[dest.name, dest.contact].filter(Boolean).join(" · ")}`]
            : []),
          ...(dest.address || dest.city || dest.postalCode
            ? [
                `- ${[dest.address, [dest.postalCode, dest.city].filter(Boolean).join(" "), dest.province].filter(Boolean).join(", ")}`,
              ]
            : []),
          ...(dest.phone ? [`- Tel: ${dest.phone}`] : []),
        ].join("\n")
      : "";

  const context: Record<string, string> = {
    // Del RMA
    rmaNumber: rma.rmaNumber,
    providerName: provider?.name ?? "",
    providerRmaNumber: rma.providerRmaNumber ?? "",
    trackingNumberOutgoing: rma.trackingNumberOutgoing ?? "",
    trackingNumberReturn: rma.trackingNumberReturn ?? "",
    // `{{status}}` es el estado del RMA: es el documento que se está generando.
    status: RMA_STATUS_LABELS[rma.status as RmaStatus] ?? rma.status,
    notes: rma.notes ?? "",
    deviceType: deviceTypeLabel,
    deviceBrand: rma.deviceBrand ?? "",
    deviceModel: rma.deviceModel ?? "",
    deviceSerialNumber: rma.deviceSerialNumber ?? "",
    clientName,
    // De la incidencia de origen
    incidentNumber: rma.incidentNumber ?? "",
    title: incident?.title ?? "",
    description: incident?.description ?? "",
    category: incident?.category
      ? INCIDENT_CATEGORY_LABELS[incident.category as IncidentCategory] ??
        incident.category
      : "",
    priority: incident?.priority
      ? INCIDENT_PRIORITY_LABELS[incident.priority as IncidentPriority] ??
        incident.priority
      : "",
    hardwareOrigin: incident?.hardwareOrigin
      ? HARDWARE_ORIGIN_LABELS[incident.hardwareOrigin as HardwareOrigin] ??
        incident.hardwareOrigin
      : "",
    assignedUserName: incident?.assignedUserName ?? "",
    // Enlaces internos: no se sugieren para proveedor, pero se rellenan si una
    // plantilla antigua los usa, para que no viajen como hueco literal.
    intercomUrl: incident?.intercomUrl ?? "",
    intercomEscalationId: incident?.intercomEscalationId ?? "",
    // Contacto y recogida
    contactName,
    contactPhone,
    contactEmail,
    pickupAddress,
    pickupCity,
    pickupPostalCode,
    recogida: recogidaBlock,
    destino: destinoBlock,
  };

  const tpl = providerTemplates.find((t) => t.id === templateId) ?? null;

  const defaultSubject = `RMA ${rma.rmaNumber} — ${device}`;
  const defaultBody = [
    "Buenos días,",
    "",
    "Solicitamos tramitar un RMA para el siguiente equipo:",
    `- Equipo: ${device}`,
    `- Nº de serie: ${rma.deviceSerialNumber || "—"}`,
    `- Cliente: ${clientName || "—"}`,
    ...(rma.notes ? [`- Motivo: ${rma.notes}`] : []),
    "",
    recogidaBlock,
    ...(destinoBlock ? ["", destinoBlock] : []),
    "",
    "Quedamos a la espera de la autorización y del número de RMA.",
    "",
    "Un saludo,",
    "Soporte Hardware — Qamarero",
  ].join("\n");

  // Con plantilla, los bloques se añaden al final SOLO si no los cubre ya. El
  // apéndice incondicional repetía la dirección de recogida y la colocaba
  // detrás de la firma, así que el correo terminaba con datos sueltos.
  const PICKUP_KEYS = ["recogida", "pickupAddress", "pickupCity", "pickupPostalCode"];
  const tplSource = tpl ? `${tpl.subject ?? ""}\n${tpl.body}` : "";
  const mentions = (keys: string[]) =>
    keys.some((k) => tplSource.includes(`{{${k}}}`));
  const appendix = tpl
    ? [
        ...(mentions(PICKUP_KEYS) ? [] : [recogidaBlock]),
        ...(destinoBlock && !mentions(["destino"]) ? [destinoBlock] : []),
      ]
    : [];

  const subject = tpl?.subject ? renderTemplate(tpl.subject, context) : defaultSubject;
  const body = tidyRendered(
    tpl
      ? [renderTemplate(tpl.body, context), ...appendix].join("\n\n")
      : defaultBody
  );
  const missing = unresolvedVariables(`${subject}\n${body}`);

  /**
   * Abre el redactor de Gmail en otra pestaña con el correo ya montado.
   *
   * `mailto:` abre el cliente de correo del sistema, que no es donde se
   * escribe aquí. La cuenta se fija con la del usuario de HSM para no acabar
   * redactando desde una cuenta personal; si Gmail no la reconoce, saca su
   * propio selector y no se pierde nada.
   *
   * Sigue sin enviarse nada desde la app: el correo queda abierto en el
   * redactor y lo manda una persona.
   */
  function openGmail() {
    const params = new URLSearchParams({ view: "cm", fs: "1", to: emailTo, su: subject, body });
    if (emailCc) params.set("cc", emailCc);
    if (session?.user?.email) params.set("authuser", session.user.email);
    window.open(`https://mail.google.com/mail/?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  function openMail() {
    const mailto = `mailto:${encodeURIComponent(emailTo)}?cc=${encodeURIComponent(emailCc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      setCopied(true);
      toast.success("Copiado al portapapeles");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setTemplateId(""); }}>
      <DialogTrigger asChild>
        <button type="button" className="btn btn--outline btn--sm">
          <Mail size={14} /> Generar correo
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Correo al proveedor</DialogTitle>
          <DialogDescription>
            Ábrelo en Gmail para revisarlo y enviarlo tú, o copia el contenido. Se rellena con los datos del RMA y de recogida.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm">
          {providerTemplates.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Plantilla</Label>
              <select
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <option value="">Mensaje por defecto</option>
                {providerTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <span className="text-muted-foreground">Para: </span>
            {emailTo ? emailTo : <span className="text-amber-600 dark:text-amber-400">sin email — configúralo en la ficha del proveedor</span>}
          </div>
          {emailCc && (
            <div><span className="text-muted-foreground">CC: </span>{emailCc}</div>
          )}

          {/* Un hueco sin rellenar se lee mal en un correo largo: mejor decirlo
              antes de enviarlo que descubrirlo cuando responda el proveedor. */}
          {missing.length > 0 && (
            <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Esta plantilla usa{" "}
                {missing.length === 1 ? "una variable" : "variables"} que no se
                puede rellenar desde un RMA:{" "}
                <span className="font-mono">
                  {missing.map((m) => `{{${m}}}`).join(" ")}
                </span>
                . Se enviaría así — edítala en Configuración › Plantillas.
              </span>
            </div>
          )}

          <div className="rounded-md bg-muted p-2 font-medium">{subject}</div>
          <div className="rounded-md bg-muted p-3 whitespace-pre-wrap max-h-64 overflow-y-auto text-muted-foreground">
            {body}
          </div>
        </div>

        <DialogFooter>
          {/* Se queda como salida para quien use un cliente de escritorio. */}
          <Button variant="ghost" size="sm" onClick={openMail} disabled={!emailTo}>
            Otro cliente de correo
          </Button>
          <Button variant="outline" onClick={copyAll}>
            {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />} Copiar
          </Button>
          <Button onClick={openGmail} disabled={!emailTo}>
            <ExternalLink className="mr-1 h-4 w-4" /> Abrir en Gmail
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
