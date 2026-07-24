import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, ExternalLink, LogOut } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/AuthProvider";

const PAGE_TITLES: Record<string, { title: string; description: string }> = {
  "/admin": {
    title: "Visão geral",
    description: "Resumo operacional do estúdio.",
  },
  "/admin/tatuadores": { title: "Tatuadores", description: "Equipe do estúdio." },
  "/admin/clientes": { title: "Clientes", description: "Base de clientes do estúdio." },
  "/admin/checkins": { title: "Check-ins", description: "Fila e histórico de atendimentos." },
  "/admin/fichas": { title: "Fichas", description: "Anamnese e fichas dos clientes." },
  "/admin/contratos": { title: "Contratos", description: "Contratos assinados e pendentes." },
  "/admin/documentos": { title: "Documentos", description: "Central de documentos do estúdio." },
  "/admin/risco": { title: "Clientes de risco", description: "Alertas de saúde e restrições." },
  "/admin/relatorios": { title: "Relatórios", description: "Análises operacionais e financeiras." },
  "/admin/backup": { title: "Backup", description: "Cópia de segurança dos dados." },
  "/admin/configuracoes": { title: "Configurações", description: "Preferências do estúdio." },
};

function currentPage(pathname: string) {
  const keys = Object.keys(PAGE_TITLES).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (pathname === k || pathname.startsWith(k + "/")) return PAGE_TITLES[k];
  }
  return { title: "Painel", description: "" };
}

function formatDate(d: Date) {
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function AdminHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const page = currentPage(location.pathname);
  const today = formatDate(new Date());
  const { email, signOut } = useAuth();
  const initials =
    (email ?? "AD")
      .split("@")[0]
      .split(/[._-]/)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "AD";

  async function handleSignOut() {
    await signOut();
    toast.success("Sessão encerrada.");
    navigate("/admin-login", { replace: true });
  }

  return (
    <header
      data-admin-header
      className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/60 bg-background/85 px-3 backdrop-blur-md sm:px-4"
    >
      <SidebarTrigger className="h-9 w-9 rounded-md border border-border/60 bg-background/60 text-muted-foreground hover:border-border hover:text-foreground" />
      <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-semibold text-foreground">{page.title}</h2>
        <p className="hidden truncate text-xs text-muted-foreground sm:block">{page.description}</p>
      </div>

      <span className="hidden text-xs capitalize text-muted-foreground lg:inline">{today}</span>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
            aria-label="Notificações"
          >
            <Bell className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <div className="text-sm font-semibold">Notificações</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Nenhuma notificação. Elas aparecerão aqui após a integração dos módulos operacionais.
          </p>
        </PopoverContent>
      </Popover>

      <Button asChild variant="outline" size="sm" className="hidden gap-1.5 sm:inline-flex">
        <Link to="/">
          <ExternalLink className="h-3.5 w-3.5" />
          <span>Recepção</span>
        </Link>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--gold)]/40 bg-background/60 text-xs font-semibold text-[color:var(--gold)] hover:border-[color:var(--gold)]/70"
            aria-label="Menu do administrador"
          >
            {initials}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span>Administrador</span>
            {email && (
              <span className="truncate text-[10px] font-normal text-muted-foreground">
                {email}
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/admin/configuracoes/administrador">Meu perfil</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/admin/configuracoes">Configurações</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/admin/configuracoes/seguranca">Segurança</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleSignOut} className="text-red-300 focus:text-red-200">
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
