import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Search,
  ShieldAlert,
  UserPlus,
  FileText,
  PenLine,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCheckIn, useDebounced, todayISO, fetchCheckIns, type CheckIn } from "@/lib/checkins";
import { useAdminClients, type AdminClient } from "@/lib/clientes-admin";
import { onlyDigits } from "@/lib/clientes";
import { getErrorMessage } from "@/lib/errors";
import { useActiveTattooArtistNames } from "@/lib/tattoo-artists";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}

export function NewCheckInDialog({ open, onClose, onCreated }: Props) {
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 200);
  const { data: clientes, isLoading: loadingClientes } = useAdminClients();
  const [selected, setSelected] = useState<AdminClient | null>(null);
  const [tatuador, setTatuador] = useState<string>("");
  const [observacoes, setObs] = useState("");
  const [existingToday, setExistingToday] = useState<CheckIn[]>([]);
  const [checkingDup, setCheckingDup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const tattooArtists = useActiveTattooArtistNames();

  useEffect(() => {
    if (!open) {
      setQ("");
      setSelected(null);
      setTatuador("");
      setObs("");
      setExistingToday([]);
    }
  }, [open]);

  // Ao selecionar cliente, verifica duplicidade e pré-seleciona tatuador
  useEffect(() => {
    if (!selected) return;
    setTatuador(selected.tatuador ?? "");
    setCheckingDup(true);
    fetchCheckIns({ day: todayISO() })
      .then((rows) => setExistingToday(rows.filter((r) => r.cpf === selected.cpf)))
      .catch(() => setExistingToday([]))
      .finally(() => setCheckingDup(false));
  }, [selected]);

  const results = useMemo(() => {
    const s = debouncedQ.trim().toLowerCase();
    if (s.length < 2) return [];
    const digits = onlyDigits(s);
    return clientes
      .filter((c) => {
        const bag = `${c.nome} ${c.cpf} ${c.telefone ?? ""} ${c.email ?? ""}`.toLowerCase();
        if (digits.length >= 3 && (c.cpf.includes(digits) || (c.telefone ?? "").includes(digits)))
          return true;
        return bag.includes(s);
      })
      .slice(0, 8);
  }, [clientes, debouncedQ]);

  const duplicadoAberto = existingToday.find((c) =>
    ["waiting", "called", "in_service"].includes(c.status),
  );

  async function handleSubmit() {
    if (!selected) return;
    if (duplicadoAberto) {
      toast.error("Este cliente já tem check-in aberto hoje.");
      return;
    }
    setSubmitting(true);
    try {
      const id = await createCheckIn({
        cpf: selected.cpf,
        clienteNome: selected.nome,
        tatuador: tatuador || null,
        riscoFlag: selected.riscoNivel === "attention",
        riscoMotivos: selected.riscoMotivos,
        temFicha: selected.temFicha,
        temAssinatura: selected.temAssinatura,
        observacoes: observacoes.trim() || undefined,
      });
      toast.success(`Check-in criado. ${selected.nome} entrou na fila.`);
      onCreated(id);
      onClose();
    } catch (err) {
      const msg = getErrorMessage(err, "Falha ao criar check-in");
      if (msg.includes("aberto hoje")) {
        toast.error("Este cliente já tem check-in aberto hoje.");
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo check-in</DialogTitle>
          <DialogDescription>
            Localize o cliente pelo cadastro real. Nenhum cliente novo é criado por engano — o
            cadastro é sempre feito no kiosk ou na tela de clientes.
          </DialogDescription>
        </DialogHeader>

        {!selected ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nome, CPF, telefone ou e-mail…"
                className="pl-9"
              />
            </div>

            <div className="max-h-72 overflow-auto rounded-lg border border-border/60">
              {loadingClientes ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando cadastros…
                </div>
              ) : debouncedQ.trim().length < 2 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Digite ao menos 2 caracteres para buscar.
                </div>
              ) : results.length === 0 ? (
                <div className="space-y-2 py-6 text-center text-sm">
                  <p className="text-muted-foreground">Nenhum cliente encontrado com essa busca.</p>
                  <p className="text-xs text-muted-foreground/80">
                    O cliente ainda não existe? Peça para preencher a ficha no kiosk (/) ou cadastre
                    em Clientes.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {results.map((c) => (
                    <li key={c.cpf}>
                      <button
                        type="button"
                        onClick={() => setSelected(c)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-background/40"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {c.nomeIniciais}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block truncate font-medium text-foreground">
                            {c.nome}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {c.telefoneMasked ?? "—"} · {c.tatuador ?? "sem tatuador"}
                          </span>
                        </span>
                        {c.riscoNivel === "attention" && (
                          <Badge variant="destructive" className="gap-1">
                            <ShieldAlert className="h-3 w-3" /> Risco
                          </Badge>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-card/40 p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {selected.nomeIniciais}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">{selected.nome}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {selected.telefoneMasked ?? "—"} · último atendimento{" "}
                    {selected.ultimaSessao
                      ? new Date(selected.ultimaSessao).toLocaleDateString("pt-BR")
                      : "—"}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                  Trocar
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Badge variant={selected.temFicha ? "secondary" : "outline"} className="gap-1">
                  <FileText className="h-3 w-3" />{" "}
                  {selected.temFicha ? "Ficha preenchida" : "Sem ficha"}
                </Badge>
                <Badge variant={selected.temAssinatura ? "secondary" : "outline"} className="gap-1">
                  <PenLine className="h-3 w-3" />{" "}
                  {selected.temAssinatura ? "Assinatura" : "Sem assinatura"}
                </Badge>
                {selected.riscoNivel === "attention" && (
                  <Badge variant="destructive" className="gap-1">
                    <ShieldAlert className="h-3 w-3" /> Alerta: {selected.riscoMotivos.join(", ")}
                  </Badge>
                )}
              </div>
            </div>

            {duplicadoAberto && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  Este cliente já tem check-in aberto hoje (posição {duplicadoAberto.queuePosition}
                  ). Abra o registro existente em vez de criar outro.
                </div>
              </div>
            )}

            {checkingDup && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Verificando duplicidade…
              </div>
            )}

            <div>
              <Label className="mb-1.5 block">Tatuador do atendimento</Label>
              <Select value={tatuador} onValueChange={setTatuador}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {tattooArtists.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Define o tatuador apenas deste check-in — não altera o tatuador principal do
                cliente.
              </p>
            </div>

            <div>
              <Label className="mb-1.5 block">Observações (opcional)</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObs(e.target.value.slice(0, 1000))}
                placeholder="Ex.: chegou adiantado, precisa reagendar orçamento…"
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selected || submitting || Boolean(duplicadoAberto)}
            className="gap-1.5"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {submitting ? "Registrando…" : "Registrar check-in"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
