"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Plus,
  Pencil,
  Paperclip,
  Trash2,
  Loader2,
  StickyNote,
  Phone,
  MessageSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchEventLogs } from "@/server/actions/event-logs";
import { formatRelativeTime, formatDateTime } from "@/lib/utils/date-format";
import { INCIDENT_STATUS_LABELS } from "@/lib/constants/incidents";
import { RMA_STATUS_LABELS } from "@/lib/constants/rmas";
import type { EntityType } from "@/lib/constants/attachments";

interface EventLogTimelineProps {
  entityType: EntityType;
  entityId: string;
}

const ACTION_LABELS: Record<string, string> = {
  created: "Creado",
  updated: "Actualizado",
  transition: "Transición de estado",
  attachment_added: "Adjunto añadido",
  attachment_removed: "Adjunto eliminado",
  note: "Nota",
  comment: "Comentario",
  contacted: "Contactó al cliente",
  assigned: "Asignación",
  converted_from_quick: "Convertida desde consulta rápida",
};

/**
 * Nombres legibles de los campos que viajan en `details.fields`.
 *
 * `updateIncident` ya guardaba qué campos se tocaron en cada edición, pero el
 * historial no los leía: salían varios «Actualizado» idénticos y mudos, que es
 * ruido puro cuando intentas reconstruir qué pasó con un caso.
 */
const FIELD_LABELS: Record<string, string> = {
  title: "título",
  description: "descripción",
  clientId: "cliente",
  clientName: "cliente",
  contactName: "contacto",
  intercomUrl: "enlace de Intercom",
  articleId: "equipo",
  deviceType: "tipo de equipo",
  deviceBrand: "marca",
  deviceModel: "modelo",
  deviceSerialNumber: "nº de serie",
  slaHours: "SLA",
  priority: "prioridad",
  assignedUserId: "técnico asignado",
  status: "estado",
  diagnosis: "diagnóstico",
  resolution: "solución",
  hardwareOrigin: "origen del hardware",
  pickupAddress: "dirección de recogida",
  pickupCity: "ciudad de recogida",
  pickupPostalCode: "código postal de recogida",
  providerId: "proveedor",
  providerRmaNumber: "nº de RMA del proveedor",
  outcome: "resultado",
  logistics: "logística",
  notes: "notas",
};

/** «prioridad y técnico asignado» a partir de las claves del patch. */
function describeFields(fields: unknown): string | null {
  if (!Array.isArray(fields) || fields.length === 0) return null;
  const names = fields
    .filter((f): f is string => typeof f === "string")
    .map((f) => FIELD_LABELS[f] ?? f);
  const unique = [...new Set(names)];
  if (unique.length === 0) return null;
  if (unique.length === 1) return unique[0];
  return `${unique.slice(0, -1).join(", ")} y ${unique[unique.length - 1]}`;
}

const ACTION_ICONS: Record<string, typeof Plus> = {
  created: Plus,
  updated: Pencil,
  transition: ArrowRight,
  attachment_added: Paperclip,
  attachment_removed: Trash2,
  note: StickyNote,
  comment: MessageSquare,
  contacted: Phone,
};

function getStatusLabel(status: string | null, entityType: EntityType): string {
  if (!status) return "";
  const labels =
    entityType === "incident" ? INCIDENT_STATUS_LABELS : RMA_STATUS_LABELS;
  return (labels as Record<string, string>)[status] ?? status;
}

export function EventLogTimeline({
  entityType,
  entityId,
}: EventLogTimelineProps) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["event-logs", entityType, entityId],
    queryFn: () => fetchEventLogs(entityType, entityId),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Historial de actividad</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Sin actividad registrada
          </p>
        ) : (
          <div className="relative space-y-0">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-primary/20 via-border to-transparent" />
            {logs.map((log, index) => {
              const Icon = ACTION_ICONS[log.action] ?? Plus;
              const details = log.details as Record<string, unknown> | null;
              const changed = log.action === "updated" ? describeFields(details?.fields) : null;
              const quickAssign = log.action === "updated" && details?.quickAssign === true;
              const text = (k: string) => (typeof details?.[k] === "string" ? (details[k] as string) : null);
              const isFirst = index === 0;
              return (
                <div
                  key={log.id}
                  className="relative flex gap-4 pb-6 last:pb-0"
                  /* Cascada acotada: con 30 eventos, 60 ms por fila dejaba
                     el final del historial casi dos segundos en blanco. */
                  style={{ animation: `slideInLeft 250ms cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(index, 8) * 40}ms both` }}
                >
                  <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isFirst ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <Icon className={`h-4 w-4 ${isFirst ? "text-primary-foreground" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {quickAssign ? "Técnico reasignado" : (ACTION_LABELS[log.action] ?? log.action)}
                      </span>
                      {changed && !quickAssign && (
                        <span className="text-sm text-muted-foreground">{changed}</span>
                      )}
                      {log.action === "transition" && log.fromState && log.toState && (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-xs">
                            {getStatusLabel(log.fromState, entityType)}
                          </Badge>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <Badge variant="outline" className="text-xs">
                            {getStatusLabel(log.toState, entityType)}
                          </Badge>
                        </div>
                      )}
                      {log.action === "created" && log.toState && (
                        <Badge variant="outline" className="text-xs">
                          {getStatusLabel(log.toState, entityType)}
                        </Badge>
                      )}
                    </div>
                    {text("comment") && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {text("comment")}
                      </p>
                    )}
                    {(log.action === "note" || log.action === "comment") && text("body") && (
                      <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                        {text("body")}
                      </p>
                    )}
                    {log.action === "contacted" && (text("channel") || text("note")) && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {[text("channel") ? `Vía ${text("channel")}` : null, text("note")].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {text("fileName") && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {text("fileName")}
                      </p>
                    )}
                    {/* La hora exacta importa: en un mismo día ocho eventos
                        decían todos «hace 2 días» y no se veía el orden. */}
                    <p className="mt-1 text-xs text-muted-foreground" title={formatDateTime(log.createdAt)}>
                      {log.userName ?? "Sistema"} &middot; {formatRelativeTime(log.createdAt)} &middot;{" "}
                      {new Date(log.createdAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
