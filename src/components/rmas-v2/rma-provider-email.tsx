"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, Copy, Check, ExternalLink } from "lucide-react";
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
import { fetchActiveTemplates } from "@/server/actions/message-templates";
import { renderTemplate } from "@/lib/constants/message-templates";
import type { RmaRow } from "@/server/queries/rmas";
import type { RmaShipping } from "@/lib/db/schema/rmas";
import type { ProviderRmaProcess } from "@/lib/db/schema/providers";

/**
 * Genera el correo de RMA al proveedor: usa el email TO/CC del procedimiento
 * del proveedor, una plantilla (categoría proveedor) o un mensaje por defecto,
 * y los datos del RMA + recogida. Abre el cliente de correo (mailto) o copia.
 */
export function RmaProviderEmail({ rma }: { rma: RmaRow }) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: provider } = useQuery({
    queryKey: ["provider-rma-info", rma.providerId],
    queryFn: () => fetchProviderById(rma.providerId),
    enabled: open && !!rma.providerId,
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
  const device = [rma.deviceBrand, rma.deviceModel].filter(Boolean).join(" ") || rma.deviceType || "equipo";

  const context: Record<string, string> = {
    rmaNumber: rma.rmaNumber,
    providerName: provider?.name ?? "",
    providerRmaNumber: rma.providerRmaNumber ?? "",
    deviceType: rma.deviceType ?? "",
    deviceBrand: rma.deviceBrand ?? "",
    deviceModel: rma.deviceModel ?? "",
    deviceSerialNumber: rma.deviceSerialNumber ?? "",
    clientName,
    contactName: ship.contactName ?? rma.contactName ?? "",
    contactPhone: ship.contactPhone ?? rma.contactPhone ?? "",
    contactEmail: ship.contactEmail ?? "",
    pickupAddress: ship.address ?? rma.pickupAddress ?? "",
    pickupCity: ship.city ?? rma.pickupCity ?? "",
    pickupPostalCode: ship.postalCode ?? rma.pickupPostalCode ?? "",
    notes: rma.notes ?? "",
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
    rma.notes ? `- Motivo: ${rma.notes}` : "",
    "",
    "Datos de recogida:",
    `- ${ship.locationName || clientName || ""}${context.contactName ? " · " + context.contactName : ""}`,
    `- ${context.pickupAddress || ""}, ${context.pickupPostalCode || ""} ${context.pickupCity || ""}${ship.province ? " (" + ship.province + ")" : ""}`,
    `- Tel: ${context.contactPhone || "—"}`,
    "",
    "Quedamos a la espera de la autorización y del número de RMA.",
    "",
    "Un saludo,",
    "Soporte Hardware — Qamarero",
  ]
    .filter((l) => l !== "")
    .join("\n");

  const subject = tpl?.subject ? renderTemplate(tpl.subject, context) : defaultSubject;
  const body = tpl ? renderTemplate(tpl.body, context) : defaultBody;

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
            Ábrelo en tu cliente de correo o copia el contenido. Se rellena con los datos del RMA y de recogida.
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

          <div className="rounded-md bg-muted p-2 font-medium">{subject}</div>
          <div className="rounded-md bg-muted p-3 whitespace-pre-wrap max-h-64 overflow-y-auto text-muted-foreground">
            {body}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={copyAll}>
            {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />} Copiar
          </Button>
          <Button onClick={openMail} disabled={!emailTo}>
            <ExternalLink className="mr-1 h-4 w-4" /> Abrir en correo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
