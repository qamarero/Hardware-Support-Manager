"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2, Tag, Printer, Save, CheckCircle2, History, Trash2 } from "lucide-react";
import { Drawer, Field } from "@/components/proto/drawer";
import { ArticleCombobox } from "@/components/proto/article-combobox";
import { CopyId } from "@/components/proto/copy-id";
import { fetchAssets, createAsset, updateAsset, deleteAsset, fetchAssetEvents } from "@/server/actions/assets";
import type { AssetRow, AssetEventRow } from "@/server/queries/assets";
import {
  ASSET_STATUSES,
  ASSET_STATUS_LABELS,
  assetStatusLabel,
  assetStatusBadgeClass,
  assetWhereabouts,
} from "@/lib/constants/assets";
import { formatDateTime } from "@/lib/utils/date-format";

const EMPTY = {
  articleId: "", deviceType: "", deviceBrand: "", deviceModel: "",
  deviceSerialNumber: "", clientName: "", location: "", notes: "",
  status: "disponible" as string, reconditioned: false,
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
    status: a.status ?? "disponible",
    reconditioned: a.reconditioned ?? false,
  };
}

function describeEvent(e: AssetEventRow): string {
  const to = assetStatusLabel(e.toStatus);
  const from = e.fromStatus ? assetStatusLabel(e.fromStatus) : null;
  switch (e.action) {
    case "created": return `Registrado · ${to}`;
    case "assigned": return `Asignado a ${e.clientName || "cliente"}`;
    case "returned": return `Devuelto · ahora ${to}`;
    case "note": return e.note || "Nota";
    default: return from ? `${from} → ${to}` : to;
  }
}

export function EquiposScreen() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [f, setF] = useState<FormState>({ ...EMPTY });
  const [query, setQuery] = useState("");
  const [onlyRecond, setOnlyRecond] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [confirmDel, setConfirmDel] = useState(false);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["assets"],
    queryFn: () => fetchAssets(),
  });

  const { data: events = [] } = useQuery({
    queryKey: ["asset-events", editingId],
    queryFn: () => fetchAssetEvents(editingId as string),
    enabled: !!editingId,
  });

  const close = () => { setF({ ...EMPTY }); setEditingId(null); setConfirmDel(false); setFormOpen(false); };
  const openNew = () => { setF({ ...EMPTY }); setEditingId(null); setConfirmDel(false); setFormOpen(true); };
  const openEdit = (a: AssetRow) => { setF(fromAsset(a)); setEditingId(a.id); setConfirmDel(false); setFormOpen(true); };

  const saveM = useMutation({
    mutationFn: () => (editingId ? updateAsset(editingId, f) : createAsset(f)),
    onSuccess: (r) => {
      if (!r.success) { toast.error(r.error); return; }
      if (editingId) {
        toast.success("Equipo actualizado");
        qc.invalidateQueries({ queryKey: ["asset-events", editingId] });
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

  const deleteM = useMutation({
    mutationFn: () => deleteAsset(editingId as string),
    onSuccess: (r) => {
      if (!r.success) { toast.error(r.error); return; }
      toast.success("Equipo eliminado");
      qc.invalidateQueries({ queryKey: ["assets"] });
      close();
    },
    onError: () => toast.error("Error al eliminar el equipo"),
  });

  const visible = assets.filter((a) => {
    if (onlyRecond && !a.reconditioned) return false;
    if (statusFilter && a.status !== statusFilter) return false;
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
        <p>Seguimiento individual: reparaciones y recambios reacondicionados para clientes</p>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="Buscar por código, equipo, serie, cliente, nota…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="select" style={{ maxWidth: 190 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todas las situaciones</option>
          {ASSET_STATUSES.map((s) => <option key={s} value={s}>{ASSET_STATUS_LABELS[s]}</option>)}
        </select>
        <button
          type="button"
          className={`chip ${onlyRecond ? "is-active" : ""}`}
          onClick={() => setOnlyRecond((v) => !v)}
          title="Solo equipos reacondicionados (listos para clientes)"
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
          <div className="text-sm">{query || statusFilter || onlyRecond ? "Ningún equipo con esos filtros." : "Registra un equipo físico para etiquetarlo con un QR."}</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Código</th><th>Equipo</th><th>Serie</th><th>Situación</th><th>Dónde está</th><th>Reacond.</th><th>Registrado</th><th />
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
                  <td>
                    <span className={`badge ${assetStatusBadgeClass(a.status)} badge--dot`}>
                      {assetStatusLabel(a.status)}
                    </span>
                  </td>
                  <td className="text-sm">{assetWhereabouts(a.status, a.clientName, a.location)}</td>
                  <td>
                    {a.reconditioned
                      ? <span className="badge badge--green badge--dot">Reacond.</span>
                      : <span className="muted">—</span>}
                  </td>
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
        subtitle={editingId ? "Situación, cliente, notas e historial del equipo" : "Registrar un equipo físico para etiquetarlo"}
        width={640}
        footer={
          <>
            {editingId ? (
              confirmDel ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span className="text-sm" style={{ color: "var(--red)" }}>¿Eliminar?</span>
                  <button className="btn btn--danger btn--sm" onClick={() => deleteM.mutate()} disabled={deleteM.isPending}>
                    {deleteM.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Sí, eliminar
                  </button>
                  <button className="btn btn--ghost btn--sm" onClick={() => setConfirmDel(false)}>No</button>
                </span>
              ) : (
                <button className="btn btn--ghost btn--sm" style={{ color: "var(--red)" }} onClick={() => setConfirmDel(true)}>
                  <Trash2 size={14} /> Eliminar
                </button>
              )
            ) : null}
            <div style={{ flex: 1 }} />
            <button className="btn btn--ghost btn--sm" onClick={close}>Cancelar</button>
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
            <Field label="Situación" hint="Dónde está / en qué punto está el equipo">
              <select className="select" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                {ASSET_STATUSES.map((s) => <option key={s} value={s}>{ASSET_STATUS_LABELS[s]}</option>)}
              </select>
            </Field>
            <Field label="Cliente" hint={f.status === "en_cliente" ? "Quién lo tiene ahora" : "Cliente asociado (opcional)"}>
              <input className="input" value={f.clientName} onChange={(e) => setF({ ...f, clientName: e.target.value })} />
            </Field>
          </div>
          <Field label="Ubicación" hint="Dónde está físicamente (si está en almacén)"><input className="input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>

          <Field label="Reacondicionado" hint="Revisado y listo para reutilizar con clientes">
            <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={f.reconditioned} onChange={(e) => setF({ ...f, reconditioned: e.target.checked })} />
              <span className="text-sm">Marcar como reacondicionado (disponible para clientes)</span>
            </label>
          </Field>

          <Field label="Notas" hint="Descripción del equipo, avería, accesorios…">
            <textarea className="textarea" rows={4} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </Field>

          {editingId && (
            <Field label="Historial">
              {events.length === 0 ? (
                <p className="muted text-sm" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <History size={13} /> Sin movimientos registrados todavía.
                </p>
              ) : (
                <div className="stack" style={{ gap: 8 }}>
                  {events.map((e) => (
                    <div key={e.id} style={{ display: "flex", gap: 10, fontSize: 12, alignItems: "baseline" }}>
                      <span className="muted mono" style={{ minWidth: 118, flex: "0 0 auto" }}>{formatDateTime(e.createdAt)}</span>
                      <span>
                        {describeEvent(e)}
                        {e.userName ? <span className="muted"> · {e.userName}</span> : null}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Field>
          )}
        </div>
      </Drawer>
    </div>
  );
}
