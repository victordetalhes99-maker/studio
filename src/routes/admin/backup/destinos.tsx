import { Cloud, Download, HardDrive, ShieldCheck, TestTube2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/admin/feedback/EmptyState";
import { StatusBadge } from "@/components/admin/backup/StatusBadge";
import { useBackupDestinations } from "@/lib/backup/hooks";
import { DESTINATION_LABELS, formatDateTime } from "@/lib/backup/format";
import type { BackupDestination, DestinationKind } from "@/lib/backup/types";

const DEFAULT_CARDS: Array<{
  kind: DestinationKind;
  icon: typeof Cloud;
  description: string;
  fields: Array<{ label: string; hint: string }>;
}> = [
  {
    kind: "r2",
    icon: Cloud,
    description:
      "Destino principal recomendado. Armazenamento externo com custo previsível e replicação regional.",
    fields: [
      { label: "Account ID", hint: "R2_ACCOUNT_ID" },
      { label: "Access Key ID", hint: "R2_ACCESS_KEY_ID" },
      { label: "Secret Access Key", hint: "R2_SECRET_ACCESS_KEY" },
      { label: "Bucket", hint: "R2_BUCKET" },
      { label: "Endpoint", hint: "R2_ENDPOINT" },
    ],
  },
  {
    kind: "google_drive",
    icon: HardDrive,
    description:
      "Cópia secundária opcional. Requer OAuth e concessão explícita da conta de serviço.",
    fields: [
      { label: "Client ID", hint: "GOOGLE_CLIENT_ID" },
      { label: "Client Secret", hint: "GOOGLE_CLIENT_SECRET" },
      { label: "Refresh Token", hint: "GOOGLE_DRIVE_REFRESH_TOKEN" },
      { label: "Pasta de destino", hint: "GOOGLE_DRIVE_FOLDER_ID" },
    ],
  },
  {
    kind: "local",
    icon: Download,
    description:
      "Download manual criptografado. Uso emergencial — não substitui destinos automáticos.",
    fields: [{ label: "Chave de criptografia", hint: "BACKUP_ENCRYPTION_KEY" }],
  },
];

function DestinationCard({
  kind,
  icon: Icon,
  description,
  fields,
  existing,
}: {
  kind: DestinationKind;
  icon: typeof Cloud;
  description: string;
  fields: Array<{ label: string; hint: string }>;
  existing?: BackupDestination;
}) {
  const status = existing?.status ?? "nao_configurado";
  const label = existing?.label ?? DESTINATION_LABELS[kind];

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <Icon className="h-3.5 w-3.5 text-[color:var(--gold)]" />
            {DESTINATION_LABELS[kind]}
          </div>
          <h3 className="mt-2 font-display text-lg text-foreground">{label}</h3>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">{description}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2">
        {fields.map((f) => (
          <div key={f.hint} className="rounded-lg border border-border/40 bg-background/30 p-2.5">
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
              {f.label}
            </dt>
            <dd className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
              {(existing?.config_masked as Record<string, string> | undefined)?.[f.hint] ??
                "•••• (segredo)"}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] text-muted-foreground/80">
          Última validação: {formatDateTime(existing?.last_tested_at)}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled>
            <TestTube2 className="mr-1.5 h-3.5 w-3.5" /> Testar
          </Button>
          <Button size="sm" className="btn-gold" disabled>
            {existing ? "Editar" : "Configurar"}
          </Button>
        </div>
      </div>

      {existing?.last_error && (
        <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/5 p-2 text-[11px] text-red-400">
          {existing.last_error}
        </p>
      )}
    </div>
  );
}

export default function BackupDestinosPage() {
  const { data, isLoading, error } = useBackupDestinations();

  const byKind = new Map(data.map((d) => [d.kind, d] as const));

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-300/90">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Credenciais nunca são digitadas nem armazenadas no navegador. O botão “Configurar”
            abrirá um fluxo seguro no backend após a integração ser ativada. Enquanto isso, os
            destinos permanecem como <strong>Não configurado</strong>.
          </p>
        </div>
      </div>

      {error && (
        <EmptyState
          icon={HardDrive}
          title="Não foi possível carregar os destinos"
          description="Verifique se você está autenticado como administrador."
          compact
        />
      )}

      {!error && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {DEFAULT_CARDS.map((c) => (
            <DestinationCard key={c.kind} {...c} existing={byKind.get(c.kind)} />
          ))}
        </div>
      )}

      {!isLoading && !error && data.length === 0 && (
        <p className="text-center text-xs text-muted-foreground/70">
          Nenhum destino registrado no banco. As integrações serão ativadas em fluxo separado.
        </p>
      )}
    </div>
  );
}
