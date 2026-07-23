import { NavLink, useLocation, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Calendar,
  ClipboardList,
  Database,
  FileSignature,
  Files,
  LayoutDashboard,
  LogOut,
  Palette,
  Settings,
  ShieldAlert,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    label: "Principal",
    items: [{ title: "Visão geral", to: "/admin", icon: LayoutDashboard, end: true }],
  },
  {
    label: "Gestão",
    items: [
      { title: "Tatuadores", to: "/admin/tatuadores", icon: Palette },
      { title: "Clientes", to: "/admin/clientes", icon: Users },
      { title: "Check-ins", to: "/admin/checkins", icon: Calendar },
    ],
  },
  {
    label: "Documentos",
    items: [
      { title: "Fichas", to: "/admin/fichas", icon: ClipboardList },
      { title: "Contratos", to: "/admin/contratos", icon: FileSignature },
      { title: "Documentos", to: "/admin/documentos", icon: Files },
    ],
  },
  {
    label: "Análise",
    items: [
      { title: "Clientes de risco", to: "/admin/clientes-risco", icon: ShieldAlert },
      { title: "Relatórios", to: "/admin/relatorios", icon: BarChart3 },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Backup", to: "/admin/backup", icon: Database },
      { title: "Configurações", to: "/admin/configuracoes", icon: Settings },
    ],
  },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { email, signOut } = useAuth();
  const initials =
    (email ?? "AD")
      .split("@")[0]
      .split(/[._-]/)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "AD";

  const isActive = (to: string, end?: boolean) =>
    end
      ? location.pathname === to
      : location.pathname === to || location.pathname.startsWith(to + "/");

  async function handleSignOut() {
    await signOut();
    toast.success("Sessão encerrada.");
    navigate("/admin-login", { replace: true });
  }

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border/60">
        <NavLink to="/admin" className="flex items-center gap-2.5 px-1 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[color:var(--gold)] to-[color:var(--gold-soft)] font-display text-base font-bold text-[color:var(--primary-foreground)]">
            85
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display text-sm font-semibold leading-tight text-sidebar-foreground">
                85 TATTOO
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Painel administrativo
              </div>
            </div>
          )}
        </NavLink>
      </SidebarHeader>

      <SidebarContent>
        {GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isActive(item.to, item.end);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                        <NavLink
                          to={item.to}
                          end={item.end}
                          className={cn(
                            "relative flex items-center gap-2.5",
                            active && "text-[color:var(--gold)]",
                          )}
                        >
                          {active && (
                            <span
                              className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[color:var(--gold)]"
                              aria-hidden
                            />
                          )}
                          <item.icon className="h-4 w-4" aria-hidden />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={email ?? "Administrador"} className="gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--gold)]/40 bg-background/60 text-xs font-semibold text-[color:var(--gold)]">
                {initials}
              </span>
              {!collapsed && (
                <div className="min-w-0 flex-1 text-left">
                  <div className="truncate text-xs font-medium text-sidebar-foreground">
                    Administrador
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {email ?? "Sessão ativa"}
                  </div>
                </div>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Sair" onClick={handleSignOut}>
              <button type="button" className="text-muted-foreground hover:text-foreground">
                <LogOut className="h-4 w-4" aria-hidden />
                <span>Sair</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
