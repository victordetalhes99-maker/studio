import { NavLink, Outlet } from "react-router-dom";
import {
  Bell,
  Database,
  FileText,
  KeyRound,
  Palette,
  Plug,
  Settings2,
  ShieldCheck,
  Sliders,
  UserCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { cn } from "@/lib/utils";

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const TABS: Tab[] = [
  { to: "/admin/configuracoes", label: "Geral", icon: Settings2, end: true },
  { to: "/admin/configuracoes/identidade", label: "Identidade visual", icon: Palette },
  { to: "/admin/configuracoes/administrador", label: "Administrador", icon: UserCog },
  { to: "/admin/configuracoes/seguranca", label: "Segurança", icon: ShieldCheck },
  { to: "/admin/configuracoes/operacao", label: "Operação", icon: Sliders },
  { to: "/admin/configuracoes/documentos", label: "Documentos", icon: FileText },
  { to: "/admin/configuracoes/backup", label: "Backup", icon: Database },
  { to: "/admin/configuracoes/integracoes", label: "Integrações", icon: Plug },
  { to: "/admin/configuracoes/sistema", label: "Sistema", icon: Bell },
];

export default function ConfiguracoesLayout() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        description="Preferências gerais, identidade, segurança e integrações do sistema."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <nav className="flex flex-row gap-1 overflow-x-auto rounded-xl border border-border/60 bg-card/40 p-1 backdrop-blur-sm lg:flex-col lg:overflow-visible lg:p-1.5">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                    "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                    isActive &&
                      "bg-[color:var(--gold)]/12 text-[color:var(--gold)] hover:bg-[color:var(--gold)]/15 hover:text-[color:var(--gold)]",
                  )
                }
              >
                <tab.icon className="h-3.5 w-3.5" />
                <span className="whitespace-nowrap">{tab.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
