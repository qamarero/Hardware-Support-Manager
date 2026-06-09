"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";
import { Drawer, Field } from "@/components/proto/drawer";
import { Combobox } from "@/components/proto/combobox";
import { createIncident } from "@/server/actions/incidents";
import { fetchClientsForSelect } from "@/server/actions/clients";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
  users: { id: string; name: string }[];
}

const SLA_OPTIONS = [
  { h: 24, label: "24h — Crítica" },
  { h: 48, label: "48h — Alta" },
  { h: 72, label: "72h — Estándar" },
  { h: 120, label: "120h — Baja" },
];

export function IncidentFormDrawer({ open, onClose, onCreated, users }: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deviceBrand, setDeviceBrand] = useState("");
  const [deviceModel, setDeviceModel] = useState("");
  const [deviceSerial, setDeviceSerial] = useState("");
  const [reporter, setReporter] = useState("");
  const [priority, setPriority] = useState("media");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [hardwareOrigin, setHardwareOrigin] = useState("qamarero");
  const [slaHours, setSlaHours] = useState(72);
  const [clientId, setClientId] = useState("");
  const [intercomUrl, setIntercomUrl] = useState("");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", "select"],
    queryFn: () => fetchClientsForSelect(),
    enabled: open,
  });

  function reset() {
    setTitle(""); setDescription(""); setDeviceBrand(""); setDeviceModel("");
    setDeviceSerial(""); setReporter(""); setPriority("media"); setAssignedUserId("");
    setHardwareOrigin("qamarero"); setSlaHours(72);
    setClientId(""); setIntercomUrl("");
  }

  const mutation = useMutation({
    mutationFn: () =>
      createIncident({
        title: title.trim(),
        description,
        category: "incidencia_directa",
        hardwareOrigin,
        priority,
        slaHours,
        assignedUserId,
        clientId,
        intercomUrl,
        deviceBrand,
        deviceModel,
        deviceSerialNumber: deviceSerial,
        contactName: reporter,
      }),
    onSuccess: (r) => {
      if (!r.success) { toast.error(r.error); return; }
      toast.success("Incidencia creada");
      qc.invalidateQueries({ queryKey: ["incidents-v2"] });
      onCreated?.(r.data.id);
      reset();
      onClose();
    },
    onError: () => toast.error("Error al crear la incidencia"),
  });

  return (
    <Drawer
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Nueva incidencia"
      subtitle="Crear un ticket de soporte hardware"
      width={680}
      footer={
        <>
          <button className="btn btn--ghost btn--sm" onClick={() => { reset(); onClose(); }}>Cancelar</button>
          <div style={{ flex: 1 }} />
          <button className="btn btn--primary btn--sm" onClick={() => mutation.mutate()} disabled={!title.trim() || mutation.isPending}>
            {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Crear incidencia
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 16 }}>
        <Field label="Título *">
          <input className="input" placeholder="Ej. MacBook Pro no carga" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Field>
        <Field label="Descripción detallada">
          <textarea className="textarea" placeholder="Pasos para reproducir, comportamiento observado, mensajes de error…" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="row row--2">
          <Field label="Cliente">
            <Combobox options={clients} value={clientId} onChange={setClientId} placeholder="Buscar cliente…" emptyLabel="Ningún cliente coincide" />
          </Field>
          <Field label="URL Intercom" hint="Enlace a la conversación abierta">
            <input className="input" placeholder="https://app.intercom.com/…/conversation/…" value={intercomUrl} onChange={(e) => setIntercomUrl(e.target.value)} />
          </Field>
        </div>
        <div className="row row--2">
          <Field label="Equipo afectado — marca/modelo">
            <input className="input" placeholder="Ej. Dell Latitude 7440" value={deviceModel} onChange={(e) => setDeviceModel(e.target.value)} />
          </Field>
          <Field label="Persona de contacto" hint="Nombre del usuario afectado">
            <input className="input" placeholder="Ej. Carlos Vega" value={reporter} onChange={(e) => setReporter(e.target.value)} />
          </Field>
        </div>
        <div className="row row--2">
          <Field label="Marca">
            <input className="input" value={deviceBrand} onChange={(e) => setDeviceBrand(e.target.value)} />
          </Field>
          <Field label="Nº de serie">
            <input className="input" value={deviceSerial} onChange={(e) => setDeviceSerial(e.target.value)} />
          </Field>
        </div>
        <div className="row row--3">
          <Field label="Prioridad">
            <select className="select" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="critica">Crítica</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </Field>
          <Field label="Técnico asignado">
            <select className="select" value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)}>
              <option value="">Sin asignar</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="SLA (horas)">
            <select className="select" value={slaHours} onChange={(e) => setSlaHours(Number(e.target.value))}>
              {SLA_OPTIONS.map((o) => <option key={o.h} value={o.h}>{o.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="row row--2">
          <Field label="Origen del hardware">
            <select className="select" value={hardwareOrigin} onChange={(e) => setHardwareOrigin(e.target.value)}>
              <option value="qamarero">Qamarero</option>
              <option value="cliente_reciclado">Reciclado cliente</option>
            </select>
          </Field>
        </div>
      </div>
    </Drawer>
  );
}
