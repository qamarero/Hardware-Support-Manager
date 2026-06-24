"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Loader2, CheckCircle, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { InboxStatusBadge } from "./inbox-status-badge";
import { ConversationThread } from "./conversation-thread";
import { convertToIncident, dismissInboxItem, recoverDiscardedInboxItem } from "@/server/actions/intercom-inbox";
import { fetchClientsForSelect, fetchClientByExternalId } from "@/server/actions/clients";
import {
  INCIDENT_CATEGORY_LABELS,
  HARDWARE_ORIGIN_LABELS,
  type IncidentCategory,
  type HardwareOrigin,
} from "@/lib/constants/incidents";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatRelativeTime } from "@/lib/utils/date-format";
import { detectDevice, extractSerialNumber } from "@/lib/intercom/device-detector";
import { buildAttrsMap, getAttr } from "@/lib/intercom/ticket-attrs";
import type { IntercomInboxRow } from "@/server/queries/intercom-inbox";
import type { IntercomInboxStatus } from "@/lib/constants/intercom";

interface ConversationDetailProps {
  item: IntercomInboxRow;
  onConvert: () => void;
  onDismiss: () => void;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function extractTicketData(payload: unknown) {
  const p = payload as any;
  const item = p?.data?.item;

  // Build normalized maps once — tolerates BOM, trailing colons, case
  // variations and other quirks of Intercom-defined attribute keys.
  const ticketAttrs = buildAttrsMap(item?.ticket_attributes);
  const convAttrs = buildAttrsMap(item?.custom_attributes);

  // Extract ticket-specific fields (from ticket_attributes)
  const problemSummary = getAttr(
    ticketAttrs,
    "Resumen del problema del cliente",
    "Resumen del problema",
    "Problema del cliente",
    "Descripcion del problema",
  ) ?? "";
  const troubleshootingSteps = getAttr(
    ticketAttrs,
    "Pasos realizados de troubleshooting",
    "Pasos de troubleshooting",
    "Troubleshooting realizado",
    "Troubleshooting",
  ) ?? "";
  const ticketTypeName = item?.ticket_type?.name ?? "";
  const ticketTypeDesc = item?.ticket_type?.description ?? "";
  const linkedConvId = item?.linked_objects?.data?.[0]?.id ?? null;

  // Extract conversation custom_attributes (set by CX team)
  const categoria = getAttr(convAttrs, "Categoría", "Categoria");
  const categoria2 = getAttr(convAttrs, "Categoría - 2", "Categoria - 2", "Categoría-2");
  const categoria3 = getAttr(convAttrs, "Categoría - 3", "Categoria - 3", "Categoría-3");
  const tipo = getAttr(convAttrs, "Tipo");
  const urgencia = (
    getAttr(convAttrs, "Urgencia") ?? getAttr(ticketAttrs, "Urgencia") ?? ""
  ).toLowerCase();
  const resumenIncidencia = getAttr(convAttrs, "Resumen de la incidencia", "Resumen incidencia");
  const atendidoEnLlamada = getAttr(convAttrs, "Atendido en llamada");
  const aiIssueSummary = getAttr(convAttrs, "AI Issue summary", "AI Issue Summary");

  // Also check pre-extracted attributes from webhook enrichment
  const extracted = p?.extractedAttributes ?? {};
  const enrichedCompany = p?.enrichedCompany ?? {};

  // Company data
  const companyId = enrichedCompany.companyId ?? item?.company?.company_id ?? null;
  const restaurantName = enrichedCompany.restaurantName ?? item?.company?.custom_attributes?.restaurant_name ?? null;
  const serialNumber = enrichedCompany.serialNumber ?? item?.company?.custom_attributes?.serial_number ?? null;
  const accountManager = enrichedCompany.accountManager ?? item?.company?.custom_attributes?.account_manager ?? null;
  const companyIntercomName = enrichedCompany.companyIntercomName ?? item?.company?.name ?? null;

  // Snippet from the conversation source — the customer's first message.
  // Used as fallback when no ticket_attributes summary was provided by CX.
  const snippet = item?.source?.body?.slice?.(0, 500) ?? "";

  // "Problema reportado" must ALWAYS appear if there's any information
  // about what the customer reported. Order of preference:
  //   1. Resumen del problema del cliente (ticket_attribute filled by CX)
  //   2. Resumen de la incidencia (conversation custom_attribute)
  //   3. Snippet of the original source.body (customer's first message)
  const reportedProblem = problemSummary || resumenIncidencia || snippet || "";

  // Build description with clear sections
  const descParts: string[] = [];
  if (reportedProblem) descParts.push(`PROBLEMA REPORTADO:\n${reportedProblem}`);
  if (troubleshootingSteps) descParts.push(`TROUBLESHOOTING REALIZADO:\n${troubleshootingSteps}`);
  const extraParts: string[] = [];
  if (categoria2) extraParts.push(`Categoría IC: ${categoria2}`);
  if (urgencia) extraParts.push(`Urgencia IC: ${urgencia}`);
  if (atendidoEnLlamada) extraParts.push(`Atendido en llamada: ${atendidoEnLlamada}`);
  if (aiIssueSummary) extraParts.push(`Resumen AI: ${aiIssueSummary}`);
  if (extraParts.length > 0) descParts.push(`DATOS ADICIONALES:\n${extraParts.map(p => `- ${p}`).join("\n")}`);
  const description = descParts.join("\n\n");

  // Enriched contact data (phone, company) added by webhook enrichment
  const enriched = p?.enrichedContact ?? {};
  const contactPhone = enriched.phone ?? null;
  const companyName = enriched.companyName ?? companyIntercomName ?? null;
  const contactEmail = enriched.email ?? null;

  return {
    // Ticket fields
    problemSummary, troubleshootingSteps, ticketTypeName, ticketTypeDesc, linkedConvId,
    // Conversation custom_attributes
    categoria: extracted.categoria ?? categoria,
    categoria2: extracted.categoria2 ?? categoria2,
    categoria3: extracted.categoria3 ?? categoria3,
    tipo: extracted.tipo ?? tipo,
    urgencia: extracted.urgencia?.toLowerCase() ?? urgencia,
    resumenIncidencia: extracted.resumenIncidencia ?? resumenIncidencia,
    atendidoEnLlamada: extracted.atendidoEnLlamada ?? atendidoEnLlamada,
    aiIssueSummary: extracted.aiIssueSummary ?? aiIssueSummary,
    // Company
    companyId, restaurantName, serialNumber, accountManager, companyIntercomName, companyName,
    // Contact
    contactPhone, contactEmail,
    // Description
    description: description || snippet,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function detectCategory(_text: string, _categoria2?: string | null): IncidentCategory {
  // Incidencias creadas desde la Bandeja Intercom siempre proceden de un escalado.
  return "escalado";
}

function mapPriority(urgency: string): "baja" | "media" | "alta" | "critica" {
  if (/urgente|critica|cr[ií]tico/.test(urgency)) return "critica";
  if (/alta|high/.test(urgency)) return "alta";
  if (/baja|low|sin prisa/.test(urgency)) return "baja";
  return "media";
}

export function ConversationDetail({ item, onConvert, onDismiss }: ConversationDetailProps) {
  const ticketData = extractTicketData(item.rawPayload);
  const intercomUrl = `https://app.intercom.com/a/inbox/conversation/${item.intercomConversationId}`;

  // Fetch clients for SearchableSelect
  const { data: clientsData = [] } = useQuery({
    queryKey: ["clients", "select"],
    queryFn: () => fetchClientsForSelect(),
  });
  const clientOptions = clientsData.map((c: { id: string; name: string }) => ({
    value: c.id,
    label: c.name,
  }));

  // Auto-match client by external_id (companyId = restaurant_id)
  const { data: matchedClient } = useQuery({
    queryKey: ["client-by-external", ticketData.companyId],
    queryFn: () => fetchClientByExternalId(ticketData.companyId!),
    enabled: !!ticketData.companyId,
  });

  // Pre-fill form from ticket data + enriched contact
  const [title, setTitle] = useState(ticketData.resumenIncidencia || ticketData.problemSummary || item.subject || "");
  const [description, setDescription] = useState(ticketData.description);
  const [category, setCategory] = useState<IncidentCategory>(
    detectCategory(ticketData.description || ticketData.ticketTypeName || item.subject || "", ticketData.categoria2)
  );
  const [priority, setPriority] = useState(
    ticketData.urgencia ? mapPriority(ticketData.urgencia) : "media"
  );
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState(ticketData.restaurantName ?? ticketData.companyName ?? item.contactName ?? "");
  const [contactName, setContactName] = useState(item.contactName ?? "");
  const [contactPhone, setContactPhone] = useState(ticketData.contactPhone ?? "");
  const [previewOpen, setPreviewOpen] = useState(true);

  // Device detection from ticket text and Intercom company data
  const allText = [ticketData.description, ticketData.problemSummary, item.subject].filter(Boolean).join(" ");
  const detected = detectDevice(allText);
  const [deviceType, setDeviceType] = useState(detected.deviceType ?? "");
  const [deviceBrand, setDeviceBrand] = useState(detected.deviceBrand ?? "");
  const [deviceModel, setDeviceModel] = useState(detected.deviceModel ?? "");
  const [deviceSerialNumber, setDeviceSerialNumber] = useState(
    ticketData.serialNumber ?? extractSerialNumber(allText) ?? ""
  );

  // Location and address state
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupCity, setPickupCity] = useState("");
  const [pickupPostalCode, setPickupPostalCode] = useState("");
  const [hardwareOrigin, setHardwareOrigin] = useState<HardwareOrigin | "">("");

  // Set clientId when auto-match resolves
  useEffect(() => {
    if (matchedClient?.id && !clientId) {
      setClientId(matchedClient.id);
      setClientName(matchedClient.name);
    }
  }, [matchedClient, clientId]);

  const convertMutation = useMutation({
    mutationFn: () => {
      if (!hardwareOrigin) {
        return Promise.resolve({ success: false as const, error: "Indica el origen del hardware (Qamarero / Reciclado cliente)" });
      }
      return convertToIncident({
        inboxItemId: item.id,
        title: title.trim() || item.subject || "Incidencia desde Intercom",
        description,
        category,
        hardwareOrigin,
        priority,
        clientId: clientId || undefined,
        clientName,
        contactName,
        contactPhone,
        deviceType: deviceType || undefined,
        deviceBrand: deviceBrand || undefined,
        deviceModel: deviceModel || undefined,
        deviceSerialNumber: deviceSerialNumber || undefined,
        pickupAddress: pickupAddress || undefined,
        pickupCity: pickupCity || undefined,
        pickupPostalCode: pickupPostalCode || undefined,
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
    onError: () => toast.error("Error al crear incidencia"),
  });

  const qc = useQueryClient();

  const dismissMutation = useMutation({
    mutationFn: () => dismissInboxItem({ inboxItemId: item.id }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Conversación descartada", {
          action: {
            label: "Deshacer",
            onClick: async () => {
              await recoverDiscardedInboxItem(item.id);
              qc.invalidateQueries({ queryKey: ["intercom-inbox"] });
              toast.success("Descarte deshecho");
            },
          },
        });
        onDismiss();
      } else {
        toast.error(result.error);
      }
    },
  });

  const isConverted = item.status === "convertida";
  const isDismissed = item.status === "descartada";
  const isPending = item.status === "pendiente";

  return (
    <div
      className="p-6 space-y-5"
      style={{ animation: "fadeInUp 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">
            {item.contactName ?? item.contactEmail ?? "Contacto desconocido"}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <InboxStatusBadge status={item.status as IntercomInboxStatus} />
            <span className="text-xs text-muted-foreground font-mono">
              #{item.intercomConversationId}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(item.receivedAt)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isPending && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => dismissMutation.mutate()}
              disabled={dismissMutation.isPending}
            >
              {dismissMutation.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <X className="mr-1 h-3 w-3" />
              )}
              Descartar
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild>
            <a href={intercomUrl} target="_blank" rel="noopener noreferrer">
              Ver en Intercom <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        </div>
      </div>

      {/* Converted link */}
      {isConverted && item.convertedIncidentNumber && (
        <div
          className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3"
          style={{ animation: "scaleIn 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
        >
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-sm">
            Convertida a{" "}
            <Link
              href={`/incidents/${item.convertedIncidentId}`}
              className="font-mono font-semibold text-primary hover:underline"
            >
              {item.convertedIncidentNumber}
            </Link>
          </span>
        </div>
      )}

      {/* Datos extraídos del escalado - panel de verificación */}
      <div className="rounded-lg border border-border/60 overflow-hidden">
        <button
          type="button"
          onClick={() => setPreviewOpen(!previewOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors"
        >
          <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Datos extraídos del escalado
          </span>
          {previewOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {previewOpen && (
          <div className="p-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
              {ticketData.restaurantName && (
                <div>
                  <dt className="text-muted-foreground">Restaurante</dt>
                  <dd className="font-medium">{ticketData.restaurantName}</dd>
                </div>
              )}
              {ticketData.companyId && (
                <div>
                  <dt className="text-muted-foreground">ID Restaurante</dt>
                  <dd className="font-mono text-[11px]">{ticketData.companyId}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground">Cliente HSM</dt>
                <dd className="font-medium">
                  {matchedClient ? (
                    <span className="text-green-600 dark:text-green-400">{matchedClient.name}</span>
                  ) : ticketData.companyId ? (
                    <span className="text-amber-600 dark:text-amber-400">No encontrado</span>
                  ) : (
                    <span className="text-muted-foreground">Sin ID empresa</span>
                  )}
                </dd>
              </div>
              {ticketData.companyIntercomName && (
                <div>
                  <dt className="text-muted-foreground">Empresa Intercom</dt>
                  <dd className="font-medium">{ticketData.companyIntercomName}</dd>
                </div>
              )}
              {item.contactName && (
                <div>
                  <dt className="text-muted-foreground">Contacto</dt>
                  <dd className="font-medium">{item.contactName}</dd>
                </div>
              )}
              {(ticketData.contactEmail || item.contactEmail) && (
                <div>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="font-medium">{ticketData.contactEmail ?? item.contactEmail}</dd>
                </div>
              )}
              {ticketData.contactPhone && (
                <div>
                  <dt className="text-muted-foreground">Teléfono</dt>
                  <dd className="font-medium">{ticketData.contactPhone}</dd>
                </div>
              )}
              {ticketData.categoria && (
                <div>
                  <dt className="text-muted-foreground">Categoría IC</dt>
                  <dd className="font-medium">
                    {[ticketData.categoria, ticketData.categoria2, ticketData.categoria3].filter(Boolean).join(" / ")}
                  </dd>
                </div>
              )}
              {ticketData.urgencia && (
                <div>
                  <dt className="text-muted-foreground">Urgencia IC</dt>
                  <dd className="font-medium capitalize">{ticketData.urgencia}</dd>
                </div>
              )}
              {ticketData.tipo && (
                <div>
                  <dt className="text-muted-foreground">Tipo</dt>
                  <dd className="font-medium">{ticketData.tipo}</dd>
                </div>
              )}
              {ticketData.resumenIncidencia && (
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Resumen de la incidencia</dt>
                  <dd className="font-medium">{ticketData.resumenIncidencia}</dd>
                </div>
              )}
              {ticketData.serialNumber && (
                <div>
                  <dt className="text-muted-foreground">Serial Number</dt>
                  <dd className="font-mono text-[11px]">{ticketData.serialNumber}</dd>
                </div>
              )}
              {ticketData.accountManager && (
                <div>
                  <dt className="text-muted-foreground">Account Manager</dt>
                  <dd className="font-medium">{ticketData.accountManager}</dd>
                </div>
              )}
              {ticketData.atendidoEnLlamada && (
                <div>
                  <dt className="text-muted-foreground">Atendido en llamada</dt>
                  <dd className="font-medium">{ticketData.atendidoEnLlamada}</dd>
                </div>
              )}
              {item.assigneeName && (
                <div>
                  <dt className="text-muted-foreground">Asignado en Intercom</dt>
                  <dd className="font-medium">{item.assigneeName}</dd>
                </div>
              )}
            </dl>
            {/* Ticket-specific data */}
            {(ticketData.problemSummary || ticketData.troubleshootingSteps) && (
              <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                {ticketData.problemSummary && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Resumen del problema</p>
                    <p className="text-sm whitespace-pre-wrap">{ticketData.problemSummary}</p>
                  </div>
                )}
                {ticketData.troubleshootingSteps && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Pasos de troubleshooting</p>
                    <p className="text-sm whitespace-pre-wrap">{ticketData.troubleshootingSteps}</p>
                  </div>
                )}
              </div>
            )}
            {/* Fallback: conversation snippet */}
            {!ticketData.problemSummary && !ticketData.troubleshootingSteps && ticketData.description && (
              <div className="mt-3 pt-3 border-t border-border/40">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Mensaje original</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">{ticketData.description}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Conversación completa (lazy loaded) */}
      <ConversationThread conversationId={item.intercomConversationId} />

      {/* Create incident form (only for pending items) */}
      {isPending && (
        <>
          <Separator className="bg-border/40" />
          <div className="space-y-4">
            <h4 className="flex items-center gap-3 text-sm font-semibold text-foreground uppercase tracking-wide">
              <span className="h-4 w-1 rounded-full bg-primary" />
              Crear Incidencia
            </h4>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs">Título</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Título de la incidencia"
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs">Descripción</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Categoría</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as IncidentCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(INCIDENT_CATEGORY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Origen del hardware *</Label>
                <ToggleGroup
                  type="single"
                  value={hardwareOrigin}
                  onValueChange={(v) => { if (v) setHardwareOrigin(v as HardwareOrigin); }}
                  className="justify-start gap-2"
                >
                  <ToggleGroupItem
                    value="qamarero"
                    className="rounded-md border px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    {HARDWARE_ORIGIN_LABELS.qamarero}
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="cliente_reciclado"
                    className="rounded-md border px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    {HARDWARE_ORIGIN_LABELS.cliente_reciclado}
                  </ToggleGroupItem>
                </ToggleGroup>
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
              <div className="space-y-1.5">
                <Label className="text-xs">Cliente (empresa)</Label>
                <SearchableSelect
                  options={clientOptions}
                  value={clientId}
                  onValueChange={(v) => {
                    setClientId(v);
                    const selected = clientsData.find((c: { id: string; name: string }) => c.id === v);
                    if (selected) setClientName(selected.name);
                  }}
                  placeholder="Buscar cliente..."
                  searchPlaceholder="Buscar cliente..."
                  emptyMessage="No se encontraron clientes."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre cliente (texto libre)</Label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Si no hay cliente registrado"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Persona de contacto</Label>
                <Input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Nombre del contacto"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Teléfono</Label>
                <Input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Teléfono de contacto"
                />
              </div>
              {(ticketData.contactEmail || item.contactEmail) && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <p className="text-sm text-muted-foreground">{ticketData.contactEmail ?? item.contactEmail}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={() => convertMutation.mutate()}
                disabled={convertMutation.isPending || !title.trim() || !hardwareOrigin}
                className="flex-1 sm:flex-none"
              >
                {convertMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Crear Incidencia
              </Button>
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => dismissMutation.mutate()}
                disabled={dismissMutation.isPending}
              >
                <X className="mr-1 h-4 w-4" />
                Descartar
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Dismissed state */}
      {isDismissed && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <X className="h-4 w-4" />
          Conversación descartada
        </div>
      )}
    </div>
  );
}
