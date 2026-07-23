import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  Copy,
  Eraser,
  FileSignature,
  Loader2,
  Mail,
  Phone,
  ShieldAlert,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { EmptyState } from "@/components/admin/feedback/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  anonymizeClient,
  deleteClientLgpd,
  formatDateBR,
  formatDateTimeBR,
  maskCpfSafe,
  updateStatus,
  useAdminClient,
} from "@/lib/clientes-admin";
import { maskCPF } from "@/lib/clientes";
import { RISK_KEYS } from "@/lib/admin";

export default function AdminClienteDetalhe() {
  const { cpf } = useParams<{ cpf: string }>();
  const navigate = useNavigate();
  const { data, isLoading, notFound, error, refetch } = useAdminClient(cpf);
  const [busy, setBusy] = useState<null | "status" | "anon" | "del">(null);
  const [confirmAnon, setConfirmAnon] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const sessoesOrdenadas = useMemo(
    () => (data?.sessoes ?? []).slice().sort((a, b) => (b.data ?? "").localeCompare(a.data ?? "")),
    [data?.sessoes],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/clientes")}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
        </Button>
        <Skeleton className="h-14 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/clientes")}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
        </Button>
        <EmptyState
          icon={UserIcon}
          title="Cliente nao encontrado"
          description={`Nenhum cliente cadastrado com o CPF ${cpf ? maskCPF(cpf) : "informado"}.`}
          action={
            <Button asChild variant="outline">
              <Link to="/admin/clientes">Voltar para a base</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/clientes")}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
        </Button>
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <div className="flex-1">Falha ao carregar cliente. {error?.message}</div>
          <Button size="sm" variant="outline" onClick={refetch}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  async function onToggleStatus() {
    if (!data) return;
    setBusy("status");
    const next = data.status === "aguardando" ? "atendido" : "aguardando";
    try {
      await updateStatus(data.cpf, next);
      toast.success(`Status atualizado para "${next}".`);
      refetch();
    } catch (e) {
      toast.error(`Falha ao atualizar status: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function onAnonymize() {
    if (!data) return;
    setBusy("anon");
    try {
      await anonymizeClient(data.cpf);
      toast.success("Cliente anonimizado (LGPD).");
      refetch();
    } catch (e) {
      toast.error(`Falha na anonimização: ${(e as Error).message}`);
    } finally {
      setBusy(null);
      setConfirmAnon(false);
    }
  }

  async function onDelete() {
    if (!data) return;
    setBusy("del");
    try {
      await deleteClientLgpd(data.cpf);
      toast.success("Solicitacao de eliminacao registrada para analise.");
      setConfirmDel(false);
      setBusy(null);
      refetch();
    } catch (e) {
      toast.error(`Falha ao registrar a solicitacao: ${(e as Error).message}`);
      setBusy(null);
      setConfirmDel(false);
    }
  }

  const dc = data.dadosCadastrais;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/clientes")}>
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar para a base
      </Button>

      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card/80 via-card/50 to-background/60 p-6 backdrop-blur-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[color:var(--gold)]/50 bg-background/60 text-lg font-semibold text-[color:var(--gold)]">
              {data.nomeIniciais}
            </span>
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <span>Cliente</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(data.cpf);
                    toast.success("CPF copiado.");
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/40 px-1.5 py-0.5 font-mono text-[10px] normal-case tracking-normal text-foreground/80 hover:border-[color:var(--gold)]/50"
                  title="Copiar CPF"
                >
                  {maskCpfSafe(data.cpf)}
                  <Copy className="h-3 w-3" />
                </button>
              </div>
              <h1 className="mt-1 font-display text-3xl font-semibold text-foreground sm:text-4xl">
                {data.nome || "Sem nome"}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge
                  variant="outline"
                  className={
                    data.status === "aguardando"
                      ? "border-amber-500/40 text-amber-300"
                      : data.status === "pendente_responsavel"
                        ? "border-amber-400/40 text-amber-200"
                        : "border-emerald-500/40 text-emerald-300"
                  }
                >
                  {data.status}
                </Badge>
                {data.tatuador ? (
                  <span className="rounded-md border border-border/60 bg-background/40 px-2 py-0.5 text-xs">
                    Tatuador:{" "}
                    <strong className="font-medium text-foreground">{data.tatuador}</strong>
                  </span>
                ) : null}
                {data.riscoNivel === "attention" ? (
                  <Badge variant="outline" className="border-destructive/40 text-destructive">
                    <ShieldAlert className="mr-1 h-3 w-3" />
                    Alertas de anamnese
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onToggleStatus} disabled={busy !== null}>
              {busy === "status" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Marcar como {data.status === "aguardando" ? "atendido" : "aguardando"}
            </Button>
            <Button variant="outline" onClick={() => setConfirmAnon(true)} disabled={busy !== null}>
              <Eraser className="mr-1.5 h-4 w-4" />
              Anonimizar (LGPD)
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDel(true)}
              disabled={busy !== null}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Solicitar eliminacao
            </Button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-background/40 p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Telefone
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-foreground/90">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              {data.telefoneMasked ?? "-"}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/40 p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              E-mail
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-foreground/90">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate">{data.email ?? "-"}</span>
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/40 p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Sessoes / Ultima
            </div>
            <div className="mt-0.5 text-foreground/90 tabular-nums">
              {data.totalSessoes} · {formatDateBR(data.ultimaSessao)}
            </div>
          </div>
        </div>
      </section>

      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="ficha">Ficha</TabsTrigger>
          <TabsTrigger value="sessoes">
            Sessoes{data.totalSessoes > 0 ? ` · ${data.totalSessoes}` : ""}
          </TabsTrigger>
          <TabsTrigger value="risco">Risco</TabsTrigger>
          <TabsTrigger value="admin">Administrativo</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-3">
          <PageHeader
            title="Dados cadastrais"
            description="Informacoes do cliente conforme registrado no check-in."
          />
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm sm:grid-cols-2">
            <Info label="Nome completo" value={dc?.nomeCompleto} />
            <Info label="Data de nascimento" value={dc?.dataNascimento} />
            <Info label="Genero" value={dc?.genero} />
            <Info label="RG" value={dc?.rg} />
            <Info label="CPF" value={maskCpfSafe(data.cpf)} mono />
            <Info label="Endereco" value={dc?.endereco} />
            <Info label="Como conheceu" value={dc?.comoConheceu} />
            <Info label="Tatuador" value={dc?.tatuador} />
            <Info label="Cadastro" value={formatDateTimeBR(data.criadoEm)} />
            <Info label="Ultima atualizacao" value={formatDateTimeBR(data.atualizadoEm)} />
          </div>
        </TabsContent>

        <TabsContent value="ficha">
          {data.temFicha ? (
            <div className="rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm">
              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <ClipboardList className="h-4 w-4 text-[color:var(--gold)]" />
                Anamnese registrada
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Object.entries(data.anamnese)
                  .filter(([, v]) => v !== "" && v !== undefined && v !== null)
                  .map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-sm"
                    >
                      <span className="text-muted-foreground">{k}</span>
                      <span className="text-right text-foreground/90">{String(v)}</span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={ClipboardList}
              title="Ficha ainda nao preenchida"
              description="Este cliente ainda nao passou pelo fluxo completo de anamnese."
            />
          )}
        </TabsContent>

        <TabsContent value="sessoes">
          {sessoesOrdenadas.length === 0 ? (
            <EmptyState
              icon={FileSignature}
              title="Nenhuma sessao registrada"
              description="Quando o cliente for atendido, cada sessao aparecera aqui com data, tatuador e assinatura."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-background/40 text-left">
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Data
                    </th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Tatuador
                    </th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Assinatura
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sessoesOrdenadas.map((s, i) => (
                    <tr key={i} className="border-b border-border/30 last:border-0">
                      <td className="px-4 py-3 text-foreground/90">{formatDateTimeBR(s.data)}</td>
                      <td className="px-4 py-3 text-foreground/85">
                        {s.tatuador ?? data.tatuador ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-foreground/80">
                        {s.assinatura ? "Registrada" : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="risco">
          {data.riscoNivel === "attention" ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
              <div className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-4 w-4" />
                <strong>Este cliente possui alertas de risco.</strong>
              </div>
              <ul className="mt-3 list-disc pl-5 text-sm text-foreground/90">
                {data.riscoMotivos.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Baseado nos itens {RISK_KEYS.map((k) => k.label).join(", ")} da anamnese.
              </p>
            </div>
          ) : (
            <EmptyState
              icon={ShieldAlert}
              title="Nenhum alerta de risco"
              description="A anamnese nao indica alertas medicos que exijam atencao."
            />
          )}
        </TabsContent>

        <TabsContent value="admin">
          <div className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">
              LGPD e retencao
            </h3>
            <p className="text-sm text-muted-foreground">
              Acoes abaixo sao registradas na trilha de auditoria administrativa. Anonimizar
              preserva a referencia tecnica minima; eliminacao definitiva depende de solicitacao,
              analise e decisao fundamentada.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmAnon(true)}
                disabled={busy !== null}
              >
                <Eraser className="mr-1.5 h-4 w-4" />
                Anonimizar (LGPD)
              </Button>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDel(true)}
                disabled={busy !== null}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Solicitar eliminacao
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmAnon} onOpenChange={setConfirmAnon}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anonimizar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Os dados pessoais serao limpos. A referencia tecnica minima permanece para auditoria,
              retencao e historico justificavel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "anon"}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onAnonymize} disabled={busy === "anon"}>
              {busy === "anon" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Anonimizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar solicitacao de eliminacao?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao nao elimina dados imediatamente. Ela apenas abre uma solicitacao LGPD para
              verificacao, analise e decisao registrada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "del"}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              disabled={busy === "del"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy === "del" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Registrar solicitacao
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Info({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm text-foreground/90 ${mono ? "font-mono" : ""}`}>
        {value && value.trim() ? value : "-"}
      </div>
    </div>
  );
}
