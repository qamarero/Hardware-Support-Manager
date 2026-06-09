"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Ticket,
  LayoutGrid,
  StickyNote,
  RefreshCw,
  RotateCcw,
  Inbox,
  ClipboardList,
  Boxes,
  Building2,
  Store,
  UserCog,
  Settings,
  Search,
  Bell,
  LogOut,
} from "lucide-react";
import { QamareroLogo } from "@/components/layout/qamarero-logo";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Ticket;
  adminOnly?: boolean;
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Operaciones",
    items: [
      { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
      { href: "/incidents", label: "Incidencias", icon: Ticket },
      { href: "/tablero", label: "Tablero Kanban", icon: LayoutGrid },
      { href: "/corcho", label: "Corcho", icon: StickyNote },
      { href: "/casos", label: "Casos · RMA", icon: RefreshCw },
      { href: "/rmas", label: "RMA", icon: RotateCcw },
    ],
  },
  {
    title: "Bandejas",
    items: [
      { href: "/intercom", label: "Bandeja Intercom", icon: Inbox },
      { href: "/submissions", label: "Bandeja Soporte", icon: ClipboardList },
    ],
  },
  {
    title: "Catálogo",
    items: [
      { href: "/inventario", label: "Inventario", icon: Boxes },
      { href: "/providers", label: "Proveedores", icon: Building2 },
      { href: "/clients", label: "Clientes", icon: Store },
    ],
  },
  {
    title: "Administración",
    items: [
      { href: "/users", label: "Usuarios", icon: UserCog, adminOnly: true },
      { href: "/settings", label: "Configuración", icon: Settings, adminOnly: true },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  technician: "Técnico",
  viewer: "Visor",
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const userName = session?.user?.name ?? "Usuario";
  const userRole = session?.user?.role ?? "viewer";

  return (
    <div className="app">
      {/* ─── SIDEBAR ─── */}
      <aside className="sidebar">
        <div className="sidebar__brand">
          <QamareroLogo size={26} className="text-white" />
          <div className="sidebar__brand-text">
            <div className="sidebar__brand-name">Hardware Support</div>
            <div className="sidebar__brand-sub">Manager</div>
          </div>
        </div>

        {SECTIONS.map((section) => {
          const items = section.items.filter((it) => !it.adminOnly || isAdmin);
          if (items.length === 0) return null;
          return (
            <div key={section.title}>
              <div className="sidebar__section">{section.title}</div>
              {items.map((it) => {
                const active = pathname === it.href || pathname.startsWith(it.href + "/");
                const Icon = it.icon;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={`nav-item ${active ? "is-active" : ""}`}
                  >
                    <Icon size={16} /> {it.label}
                  </Link>
                );
              })}
            </div>
          );
        })}

        <div className="sidebar__user">
          <div className="avatar">{initials(userName)}</div>
          <div className="sidebar__user-info">
            <div className="sidebar__user-name">{userName}</div>
            <div className="sidebar__user-role">{ROLE_LABELS[userRole] ?? userRole}</div>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--icon btn--sm"
            title="Cerrar sesión"
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={{ marginLeft: "auto", color: "var(--gray-400)" }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* ─── MAIN ─── */}
      <div className="main">
        <div className="topbar">
          <div className="topbar__title">
            <h1>Hardware Support</h1>
          </div>
          <div className="search">
            <Search size={14} />
            <input placeholder="Buscar global…" />
          </div>
          <button className="btn btn--ghost btn--icon" title="Notificaciones">
            <Bell size={16} />
          </button>
        </div>

        <div className="page">{children}</div>
      </div>
    </div>
  );
}
