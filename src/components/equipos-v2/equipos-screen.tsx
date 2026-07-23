"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2, Tag, Printer, Save, CheckCircle2 } from "lucide-react";
import { Drawer, Field } from "@/components/proto/drawer";
import { ArticleCombobox } from "@/components/proto/article-combobox";
import { CopyId } from "@/components/proto/copy-id";
import { fetchAssets, createAsset, updateAsset } from "@/server/actions/assets";
import type { AssetRow } from "@/server/queries/assets";
import { formatDateTime } from "@/lib/utils/date-format";

const EMPTY = {
  articleId: "", deviceType: "", deviceBrand: "", deviceModel: "",
  deviceSerialNumber: "", clientName: "", location: "", notes: "",
  reconditioned: false,
};

type FormState = typeof EMPTY;

function fromAsset(a: AssetRow): FormState {
  return {
    articleId: a.articleId ?? "",
    deviceType: a.deviceType ?? "",
    deviceBrand: a.deviceBrand ?? "",
    deviceModel: a.deviceModel ?? "",
    deviceSerialNumber: a.deviceSerialNumber ?? "",
    clientName: a.clientName ?? "",
    location: a.location ?? "",
    notes: a.notes ?? "",
    reconditioned: a.reconditioned ?? false,
  };
}

export function EquiposScreen() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [f, setF] = useState<FormState>({ ...EMPTY });
  const [query, setQuery] = useState("");
  const [onlyRecond, setOnlyRecond] = useState(false);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["assets"],
    queryFn: () => fetchAssets(),
  });

  const close = () => { setF({ ...EMPTY }); setEditingId(null); setFormOpen(false); };
  const openNew = () => { setF({ ...EMPTY }); setEditingId(null); setFormOpen(true); };
  const openEdit = (a: AssetRow) => { setF(fromAsset(a)); setEditingId(a.id); setFormOpen(true); };

  const saveM = useMutation({
    mutationFn: () => (editingId ? updateAsset(editingId, f) : createAsset(f)),
    onSuccess: (r) => {
      if (!r.success) { toast.error(r.error); return; }
      if (editingId) {
        toast.success("Equipo actualizado");
      } else {
        const d = r.data as { id: string; assetCode: string };
        toast.success(`Equipo ${d.assetCode} registrado`, {
          action: {
            label: "Imprimir etiqueta",
            onClick: () => window.open(`/etiqueta/equipo/${d.id}`, "_blank"),
          },
        });
      }
      qc.invalidateQueries({ queryKey: ["assets"] });
      close();
    },
    onError: () => toast.error("Error al guardar el equipo"),
  });

  const visible = assets.filter((a) => {
    if (onlyRecond && !a.reconditioned) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return [a.assetCode, a.deviceBrand, a.deviceModel, a.deviceSerialNumber, a.clientName, a.notes]
      .filter(Boolean)
      .some((v) => (v as string).toLowerCase().includes(q));
  });

  const recondCount = assets.filter((a) => a.reconditioned).length;
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
          placeholder="Buscar por código, equipo, serie, cliente, nota…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          className={`chip ${onlyRecond ? "is-active" : ""}`}
          onClick={() => setOnlyRecond((v) => !v)}
          title="Mostrar solo equipos reacondicionados (listos para clientes)"
        >
          <CheckCircle2 size={13} /> Reacondicionados
          {recondCount > 0 && <span className="chip__count">{recondCount}</span>}
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn btn--primary btn--sm" onClick={openNew}>
          <Plus size={14} /> Nuevo equipo
        </button>
      </div>

      {isLoading ? (
        <div className="card empty"><Loader2 className="animate-spin" /> <span className="muted">Cargando…</span></div>
      ) : visible.length === 0 ? (
        <div className="card empty">
          <Tag size={28} color="var(--gray-400)" />
          <h4>Sin equipos</h4>
          <div className="text-sm">{onlyRecond ? "Ningún equipo marcado como reacondicionado." : "Registra un equipo físico para etiquetarlo con un QR."}</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Código</th><th>Equipo</th><th>Serie</th><th>Cliente</th><th>Reacond.</th><th>Estado</th><th>Registrado</th><th />
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => (
                <tr key={a.id} onClick={() => openEdit(a)} style={{ cursor: "pointer" }}>
                  <td className="id-cell" onClick={(e) => e.stopPropagation()}><CopyId value={a.assetCode} /></td>
                  <td className="text-sm">
                    <div>
                      {[a.deviceBrand, a.deviceModel].filter(Boolean).join(" ") || "—"}
                      {a.deviceType ? ` · ${a.deviceType}` : ""}
                    </div>
                    {a.notes ? (
                      <div className="muted" style={{ fontSize: 11, marginTop: 2, maxWidth: 340, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.notes}>
                        {a.notes}
                      </div>
                    ) : null}
                  </td>
                  <td className="text-sm mono">{a.deviceSerialNumber ?? "—"}</td>
                  <td className="text-sm">{a.clientName ?? "—"}</td>
                  <td>
                    {a.reconditioned
                      ? <span className="badge badge--green badge--dot">Reacond.</span>
                      : <span className="muted">—</span>}
                  </td>
                  <td className="text-sm">{a.status}</td>
                  <td className="text-sm muted">{formatDateTime(a.createdAt)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
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
        onClose={close}
        title={editingId ? "Editar equipo" : "Nuevo equipo"}
        subtitle={editingId ? "Edita datos, notas y estado del equipo" : "Registrar un equipo físico para etiquetarlo"}
        width={620}
        footer={
          <>
            <button className="btn btn--ghost btn--sm" onClick={close}>Cancelar</button>
            <div style={{ flex: 1 }} />
            <button className="btn btn--primary btn--sm" onClick={() => saveM.mutate()} disabled={saveM.isPending || !canSave}>
              {saveM.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {editingId ? "Guardar cambios" : "Registrar"}
            </button>
          </>
        }
      >
        <div className="stack" style={{ gap: 16 }}>
          {!editingId && (
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
          )}
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

          <Field label="Reacondicionado" hint="Revisado y listo para reutilizar con clientes">
            <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={f.reconditioned} onChange={(e) => setF({ ...f, reconditioned: e.target.checked })} />
              <span className="text-sm">Marcar como reacondicionado (disponible para clientes)</span>
            </label>
          </Field>

          <Field label="Notas" hint="Descripción del equipo, estado, accesorios…">
            <textarea className="textarea" rows={4} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </Field>
        </div>
      </Drawer>
    </div>
  );
}
