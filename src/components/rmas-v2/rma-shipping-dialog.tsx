"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Truck } from "lucide-react";
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
import { updateRma } from "@/server/actions/rmas";
import type { RmaRow } from "@/server/queries/rmas";
import type { RmaShipping } from "@/lib/db/schema/rmas";

function buildInitial(rma: RmaRow) {
  const s: RmaShipping = rma.shipping ?? {};
  return {
    locationName: s.locationName ?? rma.clientName ?? "",
    contactName: s.contactName ?? rma.contactName ?? "",
    contactEmail: s.contactEmail ?? "",
    contactPhone: s.contactPhone ?? rma.contactPhone ?? "",
    address: s.address ?? rma.pickupAddress ?? "",
    postalCode: s.postalCode ?? rma.pickupPostalCode ?? "",
    city: s.city ?? rma.pickupCity ?? "",
    province: s.province ?? "",
    reference: s.reference ?? rma.rmaNumber ?? "",
    instructions: s.instructions ?? "",
    destType: s.destination?.type ?? "",
    destName: s.destination?.name ?? "",
    destAddress: s.destination?.address ?? "",
    destPostalCode: s.destination?.postalCode ?? "",
    destCity: s.destination?.city ?? "",
    destProvince: s.destination?.province ?? "",
    destContact: s.destination?.contact ?? "",
    destPhone: s.destination?.phone ?? "",
  };
}

type FormState = ReturnType<typeof buildInitial>;

/**
 * Pop-up para capturar/confirmar los datos del cliente/recogida y el destino
 * del envío del RMA. Se prellena desde la incidencia/RMA y se guarda en
 * `rma.shipping`. Sirve para el correo al proveedor y para preparar el envío.
 */
export function RmaShippingDialog({ rma }: { rma: RmaRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<FormState>(() => buildInitial(rma));

  const set = (k: keyof FormState, v: string) => setF((prev) => ({ ...prev, [k]: v }));

  const saveM = useMutation({
    mutationFn: () =>
      updateRma(rma.id, {
        shipping: {
          locationName: f.locationName,
          contactName: f.contactName,
          contactEmail: f.contactEmail,
          contactPhone: f.contactPhone,
          address: f.address,
          postalCode: f.postalCode,
          city: f.city,
          province: f.province,
          reference: f.reference,
          instructions: f.instructions,
          destination: {
            type: (f.destType || "") as "oficina" | "sat" | "cliente" | "",
            name: f.destName,
            address: f.destAddress,
            postalCode: f.destPostalCode,
            city: f.destCity,
            province: f.destProvince,
            contact: f.destContact,
            phone: f.destPhone,
          },
        },
      }),
    onSuccess: (r) => {
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success("Datos de recogida/envío guardados");
      qc.invalidateQueries({ queryKey: ["rma-detail", rma.id] });
      setOpen(false);
    },
    onError: () => toast.error("Error al guardar"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) setF(buildInitial(rma));
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        <button type="button" className="btn btn--outline btn--sm">
          <Truck size={14} /> Datos de recogida/envío
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Datos de recogida y envío</DialogTitle>
          <DialogDescription>
            Para el correo al proveedor y para preparar el envío (TIPSA). Se prellena con lo que ya hay en el RMA.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Cliente / recogida */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente / recogida</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre del local</Label>
                <Input value={f.locationName} onChange={(e) => set("locationName", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Persona de contacto</Label>
                <Input value={f.contactName} onChange={(e) => set("contactName", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Teléfono</Label>
                <Input value={f.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={f.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Dirección</Label>
                <Input value={f.address} onChange={(e) => set("address", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Código postal</Label>
                <Input value={f.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ciudad</Label>
                <Input value={f.city} onChange={(e) => set("city", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Provincia</Label>
                <Input value={f.province} onChange={(e) => set("province", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Envío */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Envío</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Referencia</Label>
                <Input value={f.reference} onChange={(e) => set("reference", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Destino del envío</Label>
                <Select value={f.destType || ""} onValueChange={(v) => set("destType", v)}>
                  <SelectTrigger><SelectValue placeholder="¿A dónde va?" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oficina">Nuestra oficina</SelectItem>
                    <SelectItem value="sat">SAT del proveedor</SelectItem>
                    <SelectItem value="cliente">Directo al cliente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Instrucciones para el mensajero</Label>
                <Textarea rows={2} value={f.instructions} onChange={(e) => set("instructions", e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-dashed p-3">
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                Dirección de destino (rellena solo si es distinta de la recogida)
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre / destinatario</Label>
                <Input value={f.destName} onChange={(e) => set("destName", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Contacto</Label>
                <Input value={f.destContact} onChange={(e) => set("destContact", e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Dirección</Label>
                <Input value={f.destAddress} onChange={(e) => set("destAddress", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Código postal</Label>
                <Input value={f.destPostalCode} onChange={(e) => set("destPostalCode", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ciudad</Label>
                <Input value={f.destCity} onChange={(e) => set("destCity", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Provincia</Label>
                <Input value={f.destProvince} onChange={(e) => set("destProvince", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Teléfono</Label>
                <Input value={f.destPhone} onChange={(e) => set("destPhone", e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saveM.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
            {saveM.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
