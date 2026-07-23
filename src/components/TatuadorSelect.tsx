import { Check, User } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTatuadores } from "@/lib/admin-data/hooks";

/**
 * Seleção única de tatuador responsável.
 *
 * - Consome a fonte central (`useTatuadores`) usada pelo painel admin.
 * - Filtra apenas ativos.
 * - Nenhum campo livre: cliente só pode escolher da lista.
 * - Valor salvo = id estável do tatuador (o próprio nome canônico, único na fonte).
 *   Isso preserva o vínculo em ficha, contrato, check-in e PDFs, que já usam o
 *   nome como referência ao profissional.
 */
export function TatuadorSelect({
  value,
  onChange,
  disabled,
  error,
  id = "tatuador-responsavel",
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  error?: string | null;
  id?: string;
}) {
  const { data, isLoading, error: loadError } = useTatuadores();
  const ativos = data.filter((t) => t.status === "ativo");
  const selecionado = ativos.find((t) => t.nome === value) ?? null;

  const labelId = `${id}-label`;
  const helperId = `${id}-helper`;

  return (
    <div className="mb-6">
      <label
        id={labelId}
        htmlFor={id}
        className="text-[10px] tracking-[0.3em] text-gold/80 uppercase mb-3 block"
      >
        Tatuador responsável
      </label>

      {isLoading ? (
        <div
          className="luxury-input w-full rounded-xl px-4 py-3 text-sm text-muted-foreground animate-pulse"
          aria-busy="true"
          aria-live="polite"
        >
          Carregando tatuadores...
        </div>
      ) : loadError ? (
        <div
          className="luxury-input w-full rounded-xl px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          Não foi possível carregar os tatuadores. Recarregue a página para tentar novamente.
        </div>
      ) : ativos.length === 0 ? (
        <div
          className="luxury-input w-full rounded-xl px-4 py-3 text-sm text-muted-foreground"
          role="status"
        >
          Nenhum tatuador disponível no momento.
        </div>
      ) : (
        <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger
            id={id}
            aria-labelledby={labelId}
            aria-describedby={error ? helperId : undefined}
            aria-invalid={error ? true : undefined}
            className="luxury-input w-full min-h-12 rounded-xl px-4 py-3 text-left data-[placeholder]:text-muted-foreground focus:ring-2 focus:ring-gold/50 focus:ring-offset-0"
          >
            {selecionado ? (
              <span className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-gold/15 text-[11px] font-medium tracking-wider text-gold ring-1 ring-gold/30"
                >
                  {selecionado.iniciais}
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="font-medium text-foreground">{selecionado.nome}</span>
                </span>
              </span>
            ) : (
              <SelectValue placeholder="Selecione seu tatuador" />
            )}
          </SelectTrigger>
          <SelectContent
            position="popper"
            className="max-h-72 bg-card/95 backdrop-blur-xl border-border/60"
          >
            {ativos.map((t) => {
              const isSelected = t.nome === value;
              return (
                <SelectItem
                  key={t.id}
                  value={t.nome}
                  className="focus:bg-gold/10 data-[state=checked]:bg-gold/15 data-[state=checked]:text-gold py-3 pr-8 pl-3"
                >
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/40 text-[11px] font-medium tracking-wider text-foreground/90 ring-1 ring-border/60"
                    >
                      {t.iniciais || <User className="size-3.5" />}
                    </span>
                    <span className="flex flex-col leading-tight">
                      <span className="font-medium text-foreground">{t.nome}</span>
                    </span>
                    {isSelected && (
                      <Check aria-hidden="true" className="ml-auto size-4 text-gold" />
                    )}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      )}

      {selecionado && !error && (
        <p className="text-[11px] text-gold/80 mt-2 flex items-center gap-1.5">
          <Check aria-hidden="true" className="size-3.5" />
          Profissional selecionado: <span className="font-medium">{selecionado.nome}</span>
        </p>
      )}
      {error && (
        <p id={helperId} className="text-[12px] text-destructive mt-2" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
