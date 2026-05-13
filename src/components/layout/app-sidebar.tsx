"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAlertBadges } from "./sidebar-badges";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  AlertTriangle,
  RotateCcw,
  Store,
  Building2,
  Package,
  Inbox,
  UserCog,
  Settings,
  LogOut,
  ChevronUp,
  BarChart3,
  Plus,
  ClipboardList,
} from "lucide-react";

const navigation = [
  { name: "Panel", href: "/dashboard", icon: LayoutDashboard, exact: false },
  { name: "Analítica", href: "/analytics", icon: BarChart3, exact: false },
  { name: "Incidencias", href: "/incidents", icon: AlertTriangle, exact: false },
  { name: "RMAs", href: "/rmas", icon: RotateCcw, exact: false },
  { name: "Bandeja Intercom", href: "/intercom", icon: Inbox, exact: false },
  { name: "Bandeja Soporte", href: "/submissions", icon: ClipboardList, exact: false },
  { name: "Clientes", href: "/clients", icon: Store, exact: false },
  { name: "Proveedores", href: "/providers", icon: Building2, exact: false },
  { name: "Almacén", href: "/warehouse", icon: Package, exact: false },
];

const adminNavigation = [
  { name: "Usuarios", href: "/users", icon: UserCog },
  { name: "Configuración", href: "/settings", icon: Settings },
];

function UserAvatar({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
      {initial}
    </div>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { data: badges } = useAlertBadges();
  const isAdmin = session?.user?.role === "admin";

  const badgeMap: Record<string, number | undefined> = {
    "/incidents": badges?.incidents,
    "/rmas": badges?.rmas,
    "/warehouse": badges?.warehouse,
    "/intercom": badges?.intercom,
  };
  const userName = session?.user?.name ?? "Usuario";
  const userRole = session?.user?.role ?? "viewer";

  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    technician: "Técnico",
    viewer: "Visor",
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <span className="text-xs font-bold tracking-tight">HSM</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight leading-tight text-sidebar-foreground">
              Hardware Support
            </span>
            <span className="text-xs text-sidebar-foreground/60">
              Manager
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <div className="px-3 pt-3 pb-1 flex gap-2">
          <Link
            href="/incidents/new"
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Incidencia
          </Link>
          <Link
            href="/rmas/new"
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            RMA
          </Link>
        </div>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href) &&
                    (!("excludePrefix" in item) || !pathname.startsWith((item as { excludePrefix: string }).excludePrefix));
                return (
                <SidebarMenuItem key={item.href} className="relative">
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-sidebar-primary" />
                  )}
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className="transition-colors duration-150"
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                  {badgeMap[item.href] != null && badgeMap[item.href]! > 0 && (
                    <SidebarMenuBadge>
                      <span className="inline-flex items-center justify-center min-w-[1.25rem]">
                        {badgeMap[item.href]}
                      </span>
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavigation.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith(item.href)}
                      className="transition-colors duration-150"
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="h-auto py-2">
                  <UserAvatar name={userName} />
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium leading-tight">{userName}</span>
                    <span className="text-xs text-sidebar-foreground/60">
                      {roleLabels[userRole] ?? userRole}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-56">
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
