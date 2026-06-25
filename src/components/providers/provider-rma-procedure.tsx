"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Mail, Check, Info } from "lucide-react";
import { fetchProviderById } from "@/server/actions/providers";
import type { ProviderRmaProcess } from "@/lib/db/schema/providers";

const METHOD_LABELS: Record<string, string> = {
  email: "Solo email",
  portal: "Solo portal web",
  portal_y_email: "Portal + email de aviso",
};

function withProtocol(url: string) {
  return url.startsWith("http") ? url : `https://${url}`;
}

/**
 * Panel "Cómo tramitar con {proveedor}". Muestra el procedimiento de RMA
 * configurado en la ficha del proveedor (método, portal/formulario, emails,
 * logística y pasos). Se usa en el wizard de RMA y en el drawer del RMA.
 */
export function ProviderRmaProcedure({ providerId }: { providerId: string }) {
  const [copied, setCopied] = useState(false);

  const { data: provider, isLoading } = useQuery({
    queryKey: ["provider-rma-info", providerId],
    queryFn: () => fetchProviderById(providerId),
    enabled: !!providerId,
  });

  if (!providerId) return null;
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        Cargando procedimiento…
      </div>
    );
  }
  if (!provider) return null;

  const p: ProviderRmaProcess = provider.rmaProcess ?? {};
  const portalUrl = provider.rmaUrl || p.formUrl || "";
  const hasProcess = !!(p.method || p.emailTo || portalUrl || p.requiresForm || p.steps || p.allowsDirectToClient);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(p.emailTo ?? "");
      setCopied(true);
      toast.success("Email copiado");
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <Info className="h-4 w-4 text-primary" />
        Cómo tramitar con {provider.name}
      </div>

      {!hasProcess ? (
        <p className="text-xs text-muted-foreground">
          Sin procedimiento configurado. Edítalo en la ficha del proveedor (Proveedores → {provider.name}).
        </p>
      ) : (
        <>
          {p.method && (
            <div className="text-xs">
              <span className="text-muted-foreground">Método: </span>
              {METHOD_LABELS[p.method] ?? p.method}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {portalUrl && (
              <a
                href={withProtocol(portalUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs font-medium hover:bg-muted"
              >
                <ExternalLink className="h-3 w-3" /> Abrir portal / formulario
              </a>
            )}
            {p.emailTo && (
              <button
                type="button"
                onClick={copyEmail}
                className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs font-medium hover:bg-muted"
              >
                {copied ? <Check className="h-3 w-3" /> : <Mail className="h-3 w-3" />} {p.emailTo}
              </button>
            )}
          </div>

          {p.emailCc && <div className="text-xs text-muted-foreground">CC: {p.emailCc}</div>}

          <div className="flex flex-wrap gap-1.5">
            {p.requiresForm && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                Requiere {p.formType === "pdf" ? "PDF" : "formulario"}
              </span>
            )}
            {p.allowsDirectToClient ? (
              <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:text-green-400">
                Permite envío directo al cliente
              </span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Recogemos y enviamos nosotros
              </span>
            )}
          </div>

          {p.steps && (
            <p className="whitespace-pre-wrap border-t pt-2 text-xs text-muted-foreground">{p.steps}</p>
          )}
        </>
      )}
    </div>
  );
}
