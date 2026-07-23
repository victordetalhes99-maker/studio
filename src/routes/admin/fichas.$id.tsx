import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  ClipboardList,
  FileSignature,
  Loader2,
  Phone,
  Mail,
  Printer,
  RefreshCw,
  ShieldAlert,
  User as UserIcon,
} from "lucide-react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { EmptyState } from "@/components/admin/feedback/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatDateBR,
  formatDateTimeBR,
  useFichaDetalhe,
  TIPO_LABEL,
  STATUS_LABEL,
  RISK_KEYS,
} from "@/lib/fichas";
import { getAssinaturaUrl, maskCPF, maskPhone } from "@/lib/clientes";
import type { Anamnese } from "@/lib/clientes";

const QUESTOES: Array<{ key: keyof Anamnese; label: string; descKey?: keyof Anamnese }> = [
  { key: "tratamentoMedico", label: "Em tratamento médico" },
  { key: "alergia", label: "Possui alergia", descKey: "alergiaDesc" },
  { key: "cirurgiaRecente", label: "Cirurgia recente", descKey: "cirurgiaDesc" },
  { key: "diabetes", label: "Diabetes", descKey: "diabetesDesc" },
  { key: "gestante", label: "Gestante" },
  { key: "hipertensao", label: "Hipo/hipertensão arterial" },
  { key: "marcapasso", label: "Marcapasso" },
  { key: "doencaTransmissivel", label: "Doença transmissível", descKey: "doencaTransmissivelDesc" },
  { key: "convulsao", label: "Convulsão / epilepsia" },
  { key: "circulatorio", label: "Distúrbio circulatório" },
  { key: "problemaPele", label: "Problema de pele / cicatrização", descKey: "problemaPeleDesc" },
  { key: "fumante", label: "Fumante" },
  { key: "alimentou24h", label: "Alimentou-se nas últimas 24h" },
  { key: "drogasAlcool", label: "Sob efeito de drogas/álcool" },
  { key: "bronzeado", label: "Pele bronzeada" },
  { key: "depressaoAnsiedade", label: "Depressão / pânico / ansiedade" },
  { key: "anemia", label: "Anemia" },
  { key: "queloide", label: "Queloide" },
  { key: "cardiopatia", label: "Cardiopatia" },
  { key: "hemofilia", label: "Hemofilia" },
  { key: "hepatite", label: "Hepatite" },
  { key: "vitiligo", label: "Vitiligo" },
];

export default function AdminFichaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: ficha, isLoading, notFound, error, refetch } = useFichaDetalhe(id);
  const [assinaturaUrl, setAssinaturaUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (ficha?.assinaturaPath) {
      getAssinaturaUrl(ficha.assinaturaPath).then((u) => alive && setAssinaturaUrl(u));
    } else {
      setAssinaturaUrl(null);
    }
    return () => {
      alive = false;
    };
  }, [ficha?.assinaturaPath]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/fichas")}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
        </Button>
        <Skeleton className="h-14 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (notFound || !ficha) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/fichas")}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
        </Button>
        <EmptyState
          icon={ClipboardList}
          title="Ficha não encontrada"
          description="Confira o link ou selecione novamente na lista."
          action={
            <Button asChild variant="outline">
              <Link to="/admin/fichas">Ver todas as fichas</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Falha ao carregar a ficha"
        description={error.message}
        action={
          <Button variant="outline" onClick={refetch}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Tentar novamente
          </Button>
        }
      />
    );
  }

  const { cliente, anamnese, riscoMotivos } = ficha;

  return (
    <div className="space-y-6" data-print-area>
      <div className="flex items-center justify-between" data-no-print>
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/fichas")}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refetch}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" /> Imprimir
          </Button>
        </div>
      </div>

      <PageHeader
        title={cliente.nome || "Cliente sem nome"}
        description={`Ficha #${ficha.versao} — ${TIPO_LABEL[ficha.tipo]} • ${STATUS_LABEL[ficha.status]}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={ficha.tipo === "primeira_visita" ? "default" : "secondary"}>
              {TIPO_LABEL[ficha.tipo]}
            </Badge>
            {ficha.risco === "attention" ? (
              <Badge variant="destructive" className="gap-1">
                <ShieldAlert className="h-3 w-3" /> Alerta de saúde
              </Badge>
            ) : (
              <Badge variant="secondary">Sem alertas</Badge>
            )}
            {ficha.temAssinatura && (
              <Badge variant="outline" className="gap-1">
                <FileSignature className="h-3 w-3" /> Assinada
              </Badge>
            )}
          </div>
        }
      />

      {/* Resumo do cabeçalho */}
      <div className="grid gap-3 md:grid-cols-3">
        <InfoCard icon={UserIcon} label="Cliente">
          <div className="text-sm font-medium text-foreground">{cliente.nome || "—"}</div>
          <div className="text-xs text-muted-foreground">{maskCPF(cliente.cpf)}</div>
        </InfoCard>
        <InfoCard icon={UserIcon} label="Tatuador">
          <div className="text-sm font-medium text-foreground">{ficha.tatuador ?? "—"}</div>
          <div className="text-xs text-muted-foreground">
            {ficha.tipo === "primeira_visita" ? "Vinculado no cadastro" : "Sessão recorrente"}
          </div>
        </InfoCard>
        <InfoCard icon={Calendar} label="Data">
          <div className="text-sm font-medium text-foreground">{formatDateTimeBR(ficha.data)}</div>
          <div className="text-xs text-muted-foreground">
            Atualizada em {formatDateBR(ficha.atualizadoEm)}
          </div>
        </InfoCard>
      </div>

      <Tabs defaultValue="saude" className="space-y-4">
        <TabsList>
          <TabsTrigger value="saude">Saúde</TabsTrigger>
          <TabsTrigger value="pessoais">Dados pessoais</TabsTrigger>
          <TabsTrigger value="risco">Alertas</TabsTrigger>
          <TabsTrigger value="assinatura">Assinatura</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        {/* Saúde */}
        <TabsContent value="saude" className="space-y-3">
          <div className="rounded-xl border border-border/60 bg-card/40 p-4">
            <h3 className="font-display text-lg text-foreground">Perguntas de saúde</h3>
            <p className="text-xs text-muted-foreground">
              Respostas fornecidas pelo cliente no{" "}
              {ficha.tipo === "primeira_visita" ? "cadastro" : "check-in recorrente"}.
            </p>
            <dl className="mt-4 grid gap-2 sm:grid-cols-2">
              {QUESTOES.map((q) => {
                const v = anamnese[q.key] as string;
                const desc = q.descKey ? (anamnese[q.descKey] as string) : "";
                return (
                  <div
                    key={q.key}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border/40 bg-background/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <dt className="text-sm text-foreground/85">{q.label}</dt>
                      {desc && <dd className="mt-0.5 text-xs text-muted-foreground">{desc}</dd>}
                    </div>
                    <YesNoPill value={v} />
                  </div>
                );
              })}
            </dl>
            {anamnese.tipoSanguineo && (
              <div className="mt-3 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-sm">
                Tipo sanguíneo:{" "}
                <span className="font-medium text-foreground">{anamnese.tipoSanguineo}</span>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Dados pessoais */}
        <TabsContent value="pessoais" className="space-y-3">
          <div className="rounded-xl border border-border/60 bg-card/40 p-4">
            <h3 className="font-display text-lg text-foreground">Dados pessoais</h3>
            <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <Info label="Nome completo" value={cliente.nome} />
              <Info label="CPF" value={maskCPF(cliente.cpf)} />
              <Info label="Data de nascimento" value={cliente.dataNascimento} />
              <Info label="Gênero" value={cliente.genero} />
              <Info label="RG" value={cliente.rg} />
              <Info
                label="Telefone"
                value={cliente.telefone ? maskPhone(cliente.telefone) : undefined}
                icon={Phone}
              />
              <Info label="E-mail" value={cliente.email} icon={Mail} />
              <Info label="Como conheceu" value={cliente.comoConheceu} />
              <Info label="Endereço" value={cliente.endereco} className="sm:col-span-2" />
            </dl>
          </div>
        </TabsContent>

        {/* Risco */}
        <TabsContent value="risco" className="space-y-3">
          <div className="rounded-xl border border-border/60 bg-card/40 p-4">
            <h3 className="font-display text-lg text-foreground">Alertas de saúde</h3>
            <p className="text-xs text-muted-foreground">
              Sinalização automática baseada nas respostas Sim para condições relevantes. Não
              substitui avaliação médica.
            </p>
            {riscoMotivos.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nenhum alerta identificado.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {riscoMotivos.map((m) => (
                  <li
                    key={m}
                    className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                  >
                    <ShieldAlert className="h-4 w-4" /> {m}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 text-xs text-muted-foreground">
              Regras avaliadas: {RISK_KEYS.map((r) => r.label).join(", ")}.
            </div>
          </div>
        </TabsContent>

        {/* Assinatura */}
        <TabsContent value="assinatura" className="space-y-3">
          <div className="rounded-xl border border-border/60 bg-card/40 p-4">
            <h3 className="font-display text-lg text-foreground">Assinatura & termo</h3>
            {!ficha.temAssinatura ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Esta ficha não possui assinatura registrada.
              </p>
            ) : assinaturaUrl ? (
              <div className="mt-3 overflow-hidden rounded-lg border border-border/60 bg-white p-4">
                <img
                  src={assinaturaUrl}
                  alt="Assinatura do cliente"
                  className="mx-auto max-h-48 object-contain"
                />
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando assinatura protegida…
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Assinaturas ficam em bucket privado. O acesso é temporário e auditável.
            </p>
          </div>
        </TabsContent>

        {/* Histórico */}
        <TabsContent value="historico" className="space-y-3">
          <div className="rounded-xl border border-border/60 bg-card/40 p-4">
            <h3 className="font-display text-lg text-foreground">Histórico e versões</h3>
            <div className="mt-3 space-y-2 text-sm">
              <TimelineItem label="Ficha iniciada" value={formatDateTimeBR(ficha.criadoEm)} />
              <TimelineItem
                label={`Ficha #${ficha.versao} registrada`}
                value={formatDateTimeBR(ficha.data)}
              />
              {ficha.temAssinatura && (
                <TimelineItem label="Assinatura anexada" value={formatDateTimeBR(ficha.data)} />
              )}
              <TimelineItem
                label="Última atualização"
                value={formatDateTimeBR(ficha.atualizadoEm)}
              />
            </div>

            {ficha.outrasFichas.length > 0 && (
              <>
                <div className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Outras fichas do cliente
                </div>
                <div className="space-y-1.5">
                  {ficha.outrasFichas.map((o) => (
                    <Link
                      key={o.id}
                      to={`/admin/fichas/${o.id}`}
                      className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-sm transition-colors hover:border-[color:var(--gold)]/50"
                    >
                      <span className="flex items-center gap-2">
                        <Badge variant={o.tipo === "primeira_visita" ? "default" : "secondary"}>
                          {TIPO_LABEL[o.tipo]}
                        </Badge>
                        <span className="text-foreground/80">v{o.versao}</span>
                        {o.risco === "attention" && (
                          <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDateBR(o.data)}</span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof UserIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Info({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value?: string;
  icon?: typeof UserIcon;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-1.5 text-sm text-foreground/90">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        {value || <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

function YesNoPill({ value }: { value: string }) {
  if (value === "sim") {
    return (
      <span className="inline-flex items-center rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 text-[11px] font-medium text-destructive">
        Sim
      </span>
    );
  }
  if (value === "nao") {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
        Não
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border/60 bg-background/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      —
    </span>
  );
}

function TimelineItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2">
      <span className="text-foreground/85">{label}</span>
      <span className="text-xs text-muted-foreground">{value}</span>
    </div>
  );
}
