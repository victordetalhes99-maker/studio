import { useMemo, useState } from "react";
import { MoreHorizontal, Palette, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { EmptyState } from "@/components/admin/feedback/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTatuadores } from "@/lib/admin-data/hooks";
import {
  createTattooArtist,
  deleteTattooArtist,
  setTattooArtistActive,
  updateTattooArtist,
} from "@/lib/tattoo-artists";
import type { TattooArtist } from "@/lib/admin-data/types";

type DialogMode = "create" | "edit";

export default function TatuadoresPage() {
  const { data, isEmpty, error } = useTatuadores();
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("create");
  const [selected, setSelected] = useState<TattooArtist | null>(null);
  const [nome, setNome] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TattooArtist | null>(null);
  const [removing, setRemoving] = useState(false);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter((artist) => artist.nome.toLowerCase().includes(term));
  }, [data, q]);

  function openCreateDialog() {
    setDialogMode("create");
    setSelected(null);
    setNome("");
    setAtivo(true);
    setDialogOpen(true);
  }

  function openEditDialog(artist: TattooArtist) {
    setDialogMode("edit");
    setSelected(artist);
    setNome(artist.nome);
    setAtivo(artist.status === "ativo");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      if (dialogMode === "create") {
        await createTattooArtist({ nome, ativo });
        toast.success("Tatuador cadastrado com persistencia real.");
      } else if (selected) {
        await updateTattooArtist(selected.id, { nome, ativo });
        toast.success("Cadastro do tatuador atualizado.");
      }
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar tatuador.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(artist: TattooArtist) {
    try {
      await setTattooArtistActive(artist.id, artist.status !== "ativo");
      toast.success(
        artist.status === "ativo"
          ? "Tatuador inativado com sucesso."
          : "Tatuador reativado com sucesso.",
      );
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao alterar status.");
    }
  }

  async function removeArtist(artist: TattooArtist) {
    setRemoving(true);
    try {
      await deleteTattooArtist(artist.id, artist.nome);
      toast.success("Tatuador removido do cadastro.");
      setRemoveTarget(null);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao remover tatuador.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tatuadores"
        description="Equipe persistida no Supabase, com status real e metricas derivadas de clientes e check-ins."
        actions={
          <Button className="btn-gold" onClick={openCreateDialog}>
            Novo tatuador
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar tatuador..."
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {filtrados.length} de {data.length} tatuadores
        </p>
      </div>

      {error ? (
        <EmptyState
          icon={Palette}
          title="Falha ao carregar tatuadores"
          description={error.message}
        />
      ) : isEmpty ? (
        <EmptyState
          icon={Palette}
          title="Nenhum tatuador cadastrado"
          description="Cadastre o primeiro profissional para liberar recepcao, clientes e filtros."
          action={
            <Button className="btn-gold" onClick={openCreateDialog}>
              Cadastrar primeiro tatuador
            </Button>
          }
        />
      ) : filtrados.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhum resultado"
          description="Ajuste a busca ou remova o filtro."
          compact
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm">
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead>Tatuador</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Clientes de hoje</TableHead>
                <TableHead className="text-right">Atendimentos no mes</TableHead>
                <TableHead>Ultima atividade</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((artist) => (
                <TableRow key={artist.id} className="border-border/40">
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--gold)]/30 bg-background/60 text-[11px] font-semibold text-[color:var(--gold)]">
                        {artist.iniciais}
                      </span>
                      <span className="font-medium">{artist.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        artist.status === "ativo"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                      }
                    >
                      {artist.status === "ativo" ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {artist.clientesHoje ?? 0}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {artist.atendimentosMes ?? 0}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {artist.ultimaAtividade
                      ? new Date(artist.ultimaAtividade).toLocaleString("pt-BR")
                      : "Sem atividade registrada"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(artist)}>
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(artist)}>
                          {artist.status === "ativo" ? "Inativar" : "Reativar"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setRemoveTarget(artist)}
                          className="text-destructive"
                        >
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? "Novo tatuador" : "Editar tatuador"}
            </DialogTitle>
            <DialogDescription>
              O cadastro persiste no Supabase e passa a abastecer recepcao, clientes, check-ins e
              filtros.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="artist-name">Nome</Label>
              <Input
                id="artist-name"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome artistico ou profissional"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground/85">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
                className="size-4 accent-[oklch(0.82_0.13_85)]"
              />
              Disponivel para novos atendimentos
            </label>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              className="btn-gold"
              onClick={handleSave}
              disabled={saving || nome.trim().length < 2}
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {removeTarget?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso apaga o tatuador do cadastro permanentemente. Só é possível remover quando não há
              nenhum cliente ou check-in vinculado a ele — se houver, a remoção será bloqueada
              automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeTarget && removeArtist(removeTarget)}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
