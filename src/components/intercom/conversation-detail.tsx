"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Loader2, CheckCircle, X } from "lucide-react";
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
import { InboxStatusBadge } from "./inbox-status-badge";
import { convertToIncident, dismissInboxItem } from "@/server/actions/intercom-inbox";
import { INCIDENT_CATEGORY_LABELS, type IncidentCategory } from "@/lib/constants/incidents";
import { formatRelativeTime } from "@/lib/utils/date-format";
import type { IntercomInboxRow } from "@/server/queries/intercom-inbox";
import type { IntercomInboxStatus } from "@/lib/constants/intercom";
import type { IntercomWebhookPayload } from "@/lib/intercom/types";

interface ConversationDetailProps {
  item: IntercomInboxRow;
  onConvert: () => void;
  onDismiss: () => void;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function extractTicketData(payload: unknown) {
  const p = payload as any;
  const item = p?.data?.item;
  const attrs = item?.ticket_attributes ?? {};

  // Extract ticket-specific fields
  const problemSummary = attrs["﻿Resumen del problema del cliente:"] ?? attrs["Resumen del problema del cliente:"] ?? "";
  const troubleshootingSteps = attrs["Pasos realizados de troubleshooting:"] ?? "";
  const urgency = (attrs["Urgencia:"] ?? "").toLowerCase();
  const ticketTypeName = item?.ticket_type?.name ?? "";
  const ticketTypeDesc = item?.ticket_type?.description ?? "";
  const linkedConvId = item?.linked_objects?.data?.[0]?.id ?? null;
  const companyId = item?.company_id ?? null;

  // Build description from all available text
  const descParts = [];
  if (problemSummary) descParts.push(`Problema: ${problemSummary}`);
  if (troubleshootingSteps) descParts.push(`Troubleshooting: ${troubleshootingSteps}`);
  const description = descParts.join("\n\n");

  // Snippet fallback for conversations (non-tickets)
  const snippet = item?.source?.body?.slice?.(0, 500) ?? "";

  // Enriched contact data (phone, company) added by webhook enrichment
  const enriched = p?.enrichedContact ?? {};
  const contactPhone = enriched.phone ?? null;
  const companyName = enriched.companyName ?? null;
  const contactEmail = enriched.email ?? null;

  return { problemSummary, troubleshootingSteps, urgency, ticketTypeName, ticketTypeDesc, linkedConvId, companyId, description: description || snippet, contactPhone, companyName, contactEmail };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function detectCategory(text: string): IncidentCategory {
  const lower = text.toLowerCase();
  if (/tpv|sunmi|opal|flint|terminal/.test(lower)) return "hardware";
  if (/impresora|printer|epson|star/.test(lower)) return "impresora";
  if (/caj[oó]n|portamonedas|cash/.test(lower)) return "hardware";
  if (/red|wifi|internet|router|ethernet/.test(lower)) return "red";
  if (/monitor|pantalla|display/.test(lower)) return "monitor";
  return "otro";
}

function mapPriority(urgency: string): "baja" | "media" | "alta" | "critica" {
  if (/urgente|critica|cr[ií]tico/.test(urgency)) return "critica";
  if (/alta|high/.test(urgency)) return "alta";
  if (/baja|low/.test(urgency)) return "baja";
  return "media";
}

export function ConversationDetail({ item, onConvert, onDismiss }: ConversationDetailProps) {
  const ticketData = extractTicketData(item.rawPayload);
  const intercomUrl = `https://app.intercom.com/a/inbox/conversation/${item.intercomConversationId}`;

  // Pre-fill form from ticket data + enriched contact
  const [title, setTitle] = useState(ticketData.problemSummary || item.subject || "");
  const [description, setDescription] = useState(ticketData.description);
  const [category, setCategory] = useState<IncidentCategory>(
    detectCategory(ticketData.description || ticketData.ticketTypeName || item.subject || "")
  );
  const [priority, setPriority] = useState(
    ticketData.urgency ? mapPriority(ticketData.urgency) : "media"
  );
  const [clientName, setClientName] = useState(ticketData.companyName ?? item.contactName ?? "");
  const [contactName, setContactName] = useState(item.contactName ?? "");
  const [contactPhone, setContactPhone] = useState(ticketData.contactPhone ?? "");

  const convertMutation = useMutation({
    mutationFn: () =>
      convertToIncident({
        inboxItemId: item.id,
        title: title.trim() || item.subject || "Incidencia desde Intercom",
        description,
        category,
        priority,
        clientName,
        contactName,
        contactPhone,
      }),
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

  const dismissMutation = useMutation({
    mutationFn: () => dismissInboxItem({ inboxItemId: item.id }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Conversación descartada");
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
        <Button variant="ghost" size="sm" asChild>
          <a href={intercomUrl} target="_blank" rel="noopener noreferrer">
            Ver en Intercom <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        </Button>
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

      {/* Ticket type */}
      {ticketData.ticketTypeName && (
        <p className="text-sm font-medium">{ticketData.ticketTypeName}</p>
      )}

      {/* Ticket data extracted from Intercom */}
      {(ticketData.problemSummary || ticketData.troubleshootingSteps || ticketData.urgency) && (
        <div className="rounded-lg bg-muted/30 p-4 space-y-3 max-h-64 overflow-y-auto">
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
          {ticketData.urgency && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Urgencia Intercom</p>
              <p className="text-sm font-medium">{ticketData.urgency.toUpperCase()}</p>
            </div>
          )}
        </div>
      )}

      {/* Fallback: conversation snippet if no ticket attributes */}
      {!ticketData.problemSummary && !ticketData.troubleshootingSteps && ticketData.description && (
        <div className="rounded-lg bg-muted/30 p-4 max-h-48 overflow-y-auto">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ticketData.description}</p>
        </div>
      )}

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
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Nombre de la empresa"
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
                disabled={convertMutation.isPending || !title.trim()}
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

      {/* Metadata */}
      <Separator className="bg-border/40" />
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
        {item.contactEmail && (
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium">{item.contactEmail}</dd>
          </div>
        )}
        {item.assigneeName && (
          <div>
            <dt className="text-muted-foreground">Asignado en Intercom</dt>
            <dd className="font-medium">{item.assigneeName}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
