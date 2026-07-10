"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  CalendarCheck,
  LayoutDashboard,
  BarChart3,
  Ticket,
  LayoutGrid,
  StickyNote,
  RefreshCw,
  RotateCcw,
  Inbox,
  ClipboardList,
  Boxes,
  Tag,
  Building2,
  Store,
  UserCog,
  Settings,
  LogOut,
} from "lucide-react";
import { QamareroLogo } from "@/components/layout/qamarero-logo";
import { GlobalSearch } from "@/components/shell/global-search";
import { NotificationsBell } from "@/components/shell/notifications-bell";
import { useAlertBadges } from "@/components/layout/sidebar-badges";

type BadgeKey = "incidents" | "rmas" | "intercom" | "submissions";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Ticket;
  adminOnly?: boolean;
  badge?: BadgeKey;
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Operaciones",
    items: [
      { href: "/mi-dia", label: "Mi día", icon: CalendarCheck },
      { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
      { href: "/metricas", label: "Métricas soporte", icon: BarChart3 },
      { href: "/incidents", label: "Incidencias", icon: Ticket, badge: "incidents" },
      { href: "/tablero", label: "Tablero Kanban", icon: LayoutGrid },
      { href: "/corcho", label: "Corcho", icon: StickyNote },
      { href: "/casos", label: "Casos · RMA", icon: RefreshCw },
      { href: "/rmas", label: "RMA", icon: RotateCcw, badge: "rmas" },
    ],
  },
  {
    title: "Bandejas",
    items: [
      { href: "/intercom", label: "Bandeja Intercom", icon: Inbox, badge: "intercom" },
      { href: "/submissions", label: "Bandeja Soporte", icon: ClipboardList, badge: "submissions" },
    ],
  },
  {
    title: "Catálogo",
    items: [
      { href: "/inventario", label: "Inventario", icon: Boxes },
      { href: "/equipos", label: "Equipos", icon: Tag },
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
  const { data: badges } = useAlertBadges();
  const isAdmin = session?.user?.role === "admin";
  const userName = session?.user?.name ?? "Usuario";
  const userRole = session?.user?.role ?? "viewer";

  // Mapea cada badge del nav a su contador (incidencias = estancadas+SLA;
  // RMA = atascados en proveedor + almacén; intercom = pendientes de registrar).
  function badgeValue(key: BadgeKey): number {
    if (!badges) return 0;
    if (key === "incidents") return badges.incidents;
    if (key === "rmas") return badges.rmas + badges.warehouse;
    if (key === "submissions") return badges.submissions;
    return badges.intercom;
  }

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
                const count = it.badge ? badgeValue(it.badge) : 0;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={`nav-item ${active ? "is-active" : ""}`}
                  >
                    <Icon size={16} /> {it.label}
                    {count > 0 && (
                      <span className={`nav-item__count ${it.badge !== "intercom" && it.badge !== "submissions" ? "nav-item__count--alert" : ""}`}>
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
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
          <GlobalSearch />
          <div style={{ flex: 1 }} />
          <NotificationsBell />
        </div>

        <div className="page">{children}</div>
      </div>
    </div>
  );
}
