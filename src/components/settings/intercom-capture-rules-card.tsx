"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Inbox, Loader2 } from "lucide-react";
import { updateSetting, fetchIntercomCaptureRules } from "@/server/actions/settings";
import { INTERCOM_CAPTURE_RULES_KEY, type IntercomCaptureRules } from "@/lib/constants/intercom-capture";

const toList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const toText = (a: string[]) => (a ?? []).join(", ");

export function IntercomCaptureRulesCard() {
  const router = useRouter();
  const [rules, setRules] = useState<IntercomCaptureRules | null>(null);

  const { isLoading } = useQuery({
    queryKey: ["intercom-capture-rules"],
    queryFn: async () => {
      const r = await fetchIntercomCaptureRules();
      setRules(r);
      return r;
    },
  });

  const mutation = useMutation({
    mutationFn: () => updateSetting(INTERCOM_CAPTURE_RULES_KEY, rules),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Reglas de captura guardadas");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    },
  });

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Inbox className="h-5 w-5" />
          Captura de la Bandeja Intercom
        </CardTitle>
        <CardDescription>
          Define qué conversaciones de Intercom entran como pendientes. Una conversación se captura si coincide con
          cualquiera de estas reglas; el resto cae en &ldquo;Descartadas&rdquo; (revisable y recuperable). Separa varios valores con comas.
          Deja todo vacío salvo keywords para mantener el comportamiento por defecto.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading || !rules ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="kw">Palabras clave (en asunto, cuerpo, atributos, tags)</Label>
              <Input id="kw" value={toText(rules.keywords)} placeholder="hardware, rma"
                onChange={(e) => setRules({ ...rules, keywords: toList(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tt">Tipos de ticket (ticket type) que cuentan como hardware/RMA</Label>
              <Input id="tt" value={toText(rules.ticketTypes)} placeholder="Folio de atención backoffice escalado a hardware"
                onChange={(e) => setRules({ ...rules, ticketTypes: toList(e.target.value) })} />
              <p className="text-xs text-muted-foreground">Coincide si el nombre del ticket type contiene alguno de estos textos.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tg">Tags de Intercom</Label>
              <Input id="tg" value={toText(rules.tags)} placeholder="Hardware, RMA"
                onChange={(e) => setRules({ ...rules, tags: toList(e.target.value) })} />
            </div>

            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full">
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar reglas de captura
            </Button>
            <p className="text-xs text-muted-foreground">
              Consejo: tras ajustar, vigila la pestaña &ldquo;Descartadas&rdquo; de la bandeja unos días para no perder nada real.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
