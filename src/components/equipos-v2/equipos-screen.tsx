"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2, Tag, Printer, Save } from "lucide-react";
import { Drawer, Field } from "@/components/proto/drawer";
import { ArticleCombobox } from "@/components/proto/article-combobox";
import { CopyId } from "@/components/proto/copy-id";
import { fetchAssets, createAsset } from "@/server/actions/assets";
import { formatDateTime } from "@/lib/utils/date-format";

const EMPTY = {
  articleId: "", deviceType: "", deviceBrand: "", deviceModel: "",
  deviceSerialNumber: "", clientName: "", location: "", notes: "",
};

export function EquiposScreen() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [f, setF] = useState({ ...EMPTY });
  const [query, setQuery] = useState("");

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["assets"],
    queryFn: () => fetchAssets(),
  });

  const reset = () => setF({ ...EMPTY });

  const createM = useMutation({
    mutationFn: () => createAsset(f),
    onSuccess: (r) => {
      if (!r.success) { toast.error(r.error); return; }
      toast.success(`Equipo ${r.data.assetCode} registrado`, {
        action: {
          label: "Imprimir etiqueta",
          onClick: () => window.open(`/etiqueta/equipo/${r.data.id}`, "_blank"),
        },
      });
      qc.invalidateQueries({ queryKey: ["assets"] });
      reset();
      setFormOpen(false);
    },
    onError: () => toast.error("Error al registrar el equipo"),
  });

  const visible = assets.filter((a) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return [a.assetCode, a.deviceBrand, a.deviceModel, a.deviceSerialNumber, a.clientName]
      .filter(Boolean)
      .some((v) => (v as string).toLowerCase().includes(q));
  });

  const canSave = !!(f.deviceBrand || f.deviceModel || f.deviceType || f.deviceSerialNumber);

  return (
    <div className="stack">
      <div className="topbar__title" style={{ marginBottom: 4 }}>
        <h1>Equipos</h1>
        <p>Equipos físicos en oficina (con o sin RMA) — etiqueta con QR</p>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ maxWidth: 300 }}
          placeholder="Buscar por código, equipo, serie, cliente…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div style={{ flex: 1 }} />
        <button className="btn btn--primary btn--sm" onClick={() => setFormOpen(true)}>
          <Plus size={14} /> Nuevo equipo
        </button>
      </div>

      {isLoading ? (
        <div className="card empty"><Loader2 className="animate-spin" /> <span className="muted">Cargando…</span></div>
      ) : visible.length === 0 ? (
        <div className="card empty">
          <Tag size={28} color="var(--gray-400)" />
          <h4>Sin equipos</h4>
          <div className="text-sm">Registra un equipo físico para etiquetarlo con un QR.</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Código</th><th>Equipo</th><th>Serie</th><th>Cliente</th><th>Estado</th><th>Registrado</th><th />
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => (
                <tr key={a.id}>
                  <td className="id-cell"><CopyId value={a.assetCode} /></td>
                  <td className="text-sm">
                    {[a.deviceBrand, a.deviceModel].filter(Boolean).join(" ") || "—"}
                    {a.deviceType ? ` · ${a.deviceType}` : ""}
                  </td>
                  <td className="text-sm mono">{a.deviceSerialNumber ?? "—"}</td>
                  <td className="text-sm">{a.clientName ?? "—"}</td>
                  <td className="text-sm">{a.status}</td>
                  <td className="text-sm muted">{formatDateTime(a.createdAt)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <a
                      href={`/etiqueta/equipo/${a.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn--outline btn--sm"
                      title="Imprimir etiqueta"
                    >
                      <Printer size={14} /> Etiqueta
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer
        open={formOpen}
        onClose={() => { reset(); setFormOpen(false); }}
        title="Nuevo equipo"
        subtitle="Registrar un equipo físico para etiquetarlo"
        width={620}
        footer={
          <>
            <button className="btn btn--ghost btn--sm" onClick={() => { reset(); setFormOpen(false); }}>Cancelar</button>
            <div style={{ flex: 1 }} />
            <button className="btn btn--primary btn--sm" onClick={() => createM.mutate()} disabled={createM.isPending || !canSave}>
              {createM.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Registrar
            </button>
          </>
        }
      >
        <div className="stack" style={{ gap: 16 }}>
          <Field label="Equipo del catálogo" hint="Rellena marca/modelo/tipo; o edítalo abajo">
            <ArticleCombobox
              value={f.articleId}
              onSelect={(a) => setF({
                ...f,
                articleId: a?.id ?? "",
                deviceType: a?.deviceType ?? f.deviceType,
                deviceBrand: a?.brand ?? f.deviceBrand,
                deviceModel: a?.model ?? f.deviceModel,
              })}
            />
          </Field>
          <div className="row row--2">
            <Field label="Marca"><input className="input" value={f.deviceBrand} onChange={(e) => setF({ ...f, deviceBrand: e.target.value })} /></Field>
            <Field label="Modelo"><input className="input" value={f.deviceModel} onChange={(e) => setF({ ...f, deviceModel: e.target.value })} /></Field>
          </div>
          <div className="row row--2">
            <Field label="Tipo"><input className="input" value={f.deviceType} onChange={(e) => setF({ ...f, deviceType: e.target.value })} /></Field>
            <Field label="Nº de serie"><input className="input mono" value={f.deviceSerialNumber} onChange={(e) => setF({ ...f, deviceSerialNumber: e.target.value })} /></Field>
          </div>
          <div className="row row--2">
            <Field label="Cliente"><input className="input" value={f.clientName} onChange={(e) => setF({ ...f, clientName: e.target.value })} /></Field>
            <Field label="Ubicación" hint="Dónde está físicamente"><input className="input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
          </div>
          <Field label="Notas"><textarea className="textarea" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
      </Drawer>
    </div>
  );
}
