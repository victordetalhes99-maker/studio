import { NavLink, Outlet } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Download,
  FileClock,
  Gauge,
  HardDrive,
  History,
  RotateCcw,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { cn } from "@/lib/utils";

const TABS: Array<{ to: string; label: string; icon: typeof Gauge; end?: boolean }> = [
  { to: "/admin/backup", label: "Visão geral", icon: Gauge, end: true },
  { to: "/admin/backup/destinos", label: "Destinos", icon: HardDrive },
  { to: "/admin/backup/politica", label: "Política", icon: ScrollText },
  { to: "/admin/backup/historico", label: "Histórico", icon: History },
  { to: "/admin/backup/integridade", label: "Integridade", icon: ShieldCheck },
  { to: "/admin/backup/exportacao", label: "Exportação", icon: Download },
  { to: "/admin/backup/restauracao", label: "Restauração", icon: RotateCcw },
  { to: "/admin/backup/alertas", label: "Alertas", icon: AlertTriangle },
  { to: "/admin/backup/diagnostico", label: "Diagnóstico", icon: Activity },
];

export default function BackupLayout() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de proteção de dados"
        description="Gerencie cópias de segurança, exportações, armazenamento externo e recuperação dos dados do estúdio."
      />

      <div className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              cn(
                "group inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                isActive
                  ? "border-[color:var(--gold)]/60 bg-[color:var(--gold)]/10 text-[color:var(--gold)]"
                  : "border-border/50 bg-card/30 text-muted-foreground hover:border-border hover:text-foreground",
              )
            }
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}

export { FileClock };
