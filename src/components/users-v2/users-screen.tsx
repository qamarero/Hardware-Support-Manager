"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Plus, Loader2, Users as UsersIcon, Trash2 } from "lucide-react";
import { fetchUsers, deleteUser } from "@/server/actions/users";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { Avatar } from "@/components/proto/badges";
import { USER_ROLE_LABELS, type UserRole } from "@/lib/constants/roles";
import { formatRelativeTime } from "@/lib/utils/date-format";

const ROLE_BADGE: Record<string, string> = {
  admin: "badge--purple",
  technician: "badge--blue",
  viewer: "badge--gray",
};

export function UsersScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [aEliminar, setAEliminar] = useState<{ id: string; name: string } | null>(null);

  const eliminar = useMutation({
    mutationFn: async () => {
      if (!aEliminar) throw new Error("sin usuario");
      return deleteUser(aEliminar.id);
    },
    onSuccess: (r) => {
      // El servidor rechaza borrarse a uno mismo y borrar al último
      // administrador activo. Ese mensaje es el que hay que enseñar: decir
      // solo «no se pudo» dejaría al admin sin saber por qué.
      if (!r.success) { toast.error(r.error); return; }
      toast.success(`${aEliminar?.name} ya no tiene acceso`);
      setAEliminar(null);
      qc.invalidateQueries({ queryKey: ["users-v2"] });
    },
    onError: () => toast.error("No se pudo eliminar el usuario"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["users-v2"],
    queryFn: () => fetchUsers({ page: 1, pageSize: 500, sortBy: "name", sortOrder: "asc" }),
  });

  const users = useMemo(() => {
    let arr = data?.data ?? [];
    if (query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    return arr;
  }, [data, query]);

  return (
    <div className="stack">
      <div className="topbar__title" style={{ marginBottom: 4 }}>
        <h1>Usuarios</h1>
        <p>Equipo de soporte hardware</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div className="search" style={{ flex: 1, maxWidth: 360 }}>
          <Search size={14} />
          <input placeholder="Buscar por nombre o email…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn--primary btn--sm" onClick={() => router.push("/users/new")}>
          <Plus size={14} /> Nuevo usuario
        </button>
      </div>

      {isLoading ? (
        <div className="card empty"><Loader2 className="animate-spin" /> <span className="muted">Cargando…</span></div>
      ) : users.length === 0 ? (
        <div className="card empty">
          <UsersIcon size={28} color="var(--gray-400)" />
          <h4>Sin usuarios</h4>
          <div className="text-sm">Crea un usuario para empezar.</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table table--dense">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Alta</th>
                <th style={{ width: 44 }}><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} onClick={() => router.push(`/users/${u.id}`)}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar name={u.name} src={u.avatarUrl} />
                      <span className="fw-600">{u.name}</span>
                    </div>
                  </td>
                  <td className="text-sm mono">{u.email}</td>
                  <td><span className={`badge ${ROLE_BADGE[u.role] ?? "badge--gray"}`}>{USER_ROLE_LABELS[u.role as UserRole] ?? u.role}</span></td>
                  <td>
                    {u.active
                      ? <span className="badge badge--green badge--dot">Activo</span>
                      : <span className="badge badge--gray badge--dot">Inactivo</span>}
                  </td>
                  <td className="text-sm muted">{formatRelativeTime(u.createdAt)}</td>
                  <td>
                    {/* stopPropagation: la fila entera navega a la ficha, y sin
                        esto borrar abriría además el usuario que se borra. */}
                    <button
                      type="button"
                      className="btn btn--ghost btn--icon btn--sm"
                      title={`Eliminar a ${u.name}`}
                      aria-label={`Eliminar a ${u.name}`}
                      onClick={(e) => { e.stopPropagation(); setAEliminar({ id: u.id, name: u.name }); }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!aEliminar}
        onOpenChange={(o) => { if (!o) setAEliminar(null); }}
        title={`¿Eliminar a ${aEliminar?.name ?? ""}?`}
        description="Deja de tener acceso y desaparece de la lista. No se borra su historial: las incidencias y RMA que haya tocado siguen en su sitio."
        isLoading={eliminar.isPending}
        onConfirm={() => eliminar.mutate()}
      />
    </div>
  );
}
