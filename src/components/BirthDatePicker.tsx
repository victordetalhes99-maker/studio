import * as React from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * BirthDatePicker
 * - value / onChange no formato ISO "YYYY-MM-DD" (mesmo formato salvo pelo backend).
 * - Fluxo guiado quando o campo está vazio: Ano -> Mês -> Dia.
 * - Trabalha somente com strings/números; nunca instancia Date do valor final.
 */

export interface BirthDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  placeholder?: string;
  ariaLabel?: string;
  minYear?: number;
  maxYear?: number;
  allowClear?: boolean;
  className?: string;
  disabled?: boolean;
  onBlur?: () => void;
  /** Mostra texto "Você pode digitar a data ou escolher pelo calendário." abaixo. */
  showHelper?: boolean;
}

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const MESES_CURTOS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];
const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}
function isLeap(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}
function daysInMonth(year: number, monthIndex0: number) {
  const table = [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return table[monthIndex0];
}
function isoToBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}
function brToIso(br: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br);
  if (!m) return "";
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (mo < 1 || mo > 12) return "";
  if (d < 1 || d > daysInMonth(y, mo - 1)) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}
function maskBr(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
function todayParts() {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
}
function isFutureIso(iso: string): boolean {
  const t = todayParts();
  const [y, m, d] = iso.split("-").map(Number);
  if (y !== t.y) return y > t.y;
  if (m - 1 !== t.m) return m - 1 > t.m;
  return d > t.d;
}

type View = "year" | "month" | "day";
type YearMode = "decades" | "years";

export function BirthDatePicker({
  value,
  onChange,
  id,
  name,
  placeholder = "DD/MM/AAAA",
  ariaLabel = "Data de nascimento",
  minYear,
  maxYear,
  allowClear = true,
  className,
  disabled,
  onBlur,
  showHelper = true,
}: BirthDatePickerProps) {
  const today = todayParts();
  const yearMax = maxYear ?? today.y;
  const yearMin = minYear ?? today.y - 120;

  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState<string>(isoToBr(value));
  const [error, setError] = React.useState<string | null>(null);

  const hasInitial = !!(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
  const [view, setView] = React.useState<View>(hasInitial ? "day" : "year");
  const [yearMode, setYearMode] = React.useState<YearMode>(hasInitial ? "years" : "decades");
  const [yearQuery, setYearQuery] = React.useState<string>("");

  const initial = React.useMemo(() => {
    if (hasInitial) {
      const [y, m] = value.split("-").map(Number);
      return { y, m: m - 1 };
    }
    return { y: Math.min(2000, yearMax), m: 0 };
  }, [value, yearMax, hasInitial]);

  const [cursorYear, setCursorYear] = React.useState(initial.y);
  const [cursorMonth, setCursorMonth] = React.useState(initial.m);
  const [draftIso, setDraftIso] = React.useState<string>(value);
  // década atualmente selecionada (start year, ex.: 2000 = 2000-2009)
  const [decadeStart, setDecadeStart] = React.useState<number>(
    () => Math.floor(initial.y / 10) * 10,
  );

  React.useEffect(() => {
    setText(isoToBr(value));
    setDraftIso(value);
    setError(null);
  }, [value]);

  React.useEffect(() => {
    if (!open) return;
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m] = value.split("-").map(Number);
      setCursorYear(y);
      setCursorMonth(m - 1);
      setDecadeStart(Math.floor(y / 10) * 10);
      setDraftIso(value);
      setView("day");
      setYearMode("years");
    } else {
      setDraftIso("");
      setView("year");
      setYearMode("decades");
      setYearQuery("");
    }
  }, [open, value]);

  function commitFromText(txt: string) {
    if (!txt) {
      setError(null);
      onChange("");
      return;
    }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(txt)) {
      setError("Digite a data no formato DD/MM/AAAA.");
      return;
    }
    const iso = brToIso(txt);
    if (!iso) {
      setError("Informe uma data de nascimento válida.");
      return;
    }
    const [y] = iso.split("-").map(Number);
    if (y < yearMin || y > yearMax) {
      setError("Informe uma data de nascimento válida.");
      return;
    }
    if (isFutureIso(iso)) {
      setError("A data de nascimento não pode estar no futuro.");
      return;
    }
    setError(null);
    onChange(iso);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = maskBr(e.target.value);
    setText(masked);
    if (masked.length === 10) commitFromText(masked);
    else setError(null);
  }
  function handleInputBlur() {
    if (text && text.length !== 10) setError("Digite a data no formato DD/MM/AAAA.");
    else if (text.length === 10) commitFromText(text);
    onBlur?.();
  }

  const firstDayIdx = React.useMemo(
    () => new Date(cursorYear, cursorMonth, 1).getDay(),
    [cursorYear, cursorMonth],
  );
  const totalDays = daysInMonth(cursorYear, cursorMonth);

  function selectDay(d: number) {
    const iso = `${cursorYear}-${pad(cursorMonth + 1)}-${pad(d)}`;
    if (isFutureIso(iso)) return;
    setDraftIso(iso);
  }
  function confirm() {
    if (!draftIso) {
      setError("Selecione o dia, o mês e o ano.");
      return;
    }
    if (isFutureIso(draftIso)) {
      setError("A data de nascimento não pode estar no futuro.");
      return;
    }
    onChange(draftIso);
    setText(isoToBr(draftIso));
    setError(null);
    setOpen(false);
  }
  function cancel() {
    setText(isoToBr(value));
    setDraftIso(value);
    setError(null);
    setOpen(false);
  }
  function clear() {
    setDraftIso("");
    setText("");
    setError(null);
    onChange("");
    setOpen(false);
  }
  function prevMonth() {
    let m = cursorMonth - 1;
    let y = cursorYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    if (y < yearMin) return;
    setCursorMonth(m);
    setCursorYear(y);
  }
  function nextMonth() {
    let m = cursorMonth + 1;
    let y = cursorYear;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    if (y > yearMax) return;
    setCursorMonth(m);
    setCursorYear(y);
  }

  const draftParts =
    draftIso && /^\d{4}-\d{2}-\d{2}$/.test(draftIso) ? draftIso.split("-").map(Number) : null;
  const isSelected = (d: number) =>
    !!draftParts &&
    draftParts[0] === cursorYear &&
    draftParts[1] - 1 === cursorMonth &&
    draftParts[2] === d;
  const isToday = (d: number) => today.y === cursorYear && today.m === cursorMonth && today.d === d;
  const isDayDisabled = (d: number) => {
    const iso = `${cursorYear}-${pad(cursorMonth + 1)}-${pad(d)}`;
    return isFutureIso(iso);
  };

  // décadas disponíveis
  const decades: number[] = React.useMemo(() => {
    const startDecade = Math.floor(yearMin / 10) * 10;
    const endDecade = Math.floor(yearMax / 10) * 10;
    const out: number[] = [];
    for (let d = endDecade; d >= startDecade; d -= 10) out.push(d);
    return out;
  }, [yearMin, yearMax]);

  // anos da década atual filtrados
  const yearsInDecade: number[] = React.useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < 10; i++) {
      const y = decadeStart + i;
      if (y >= yearMin && y <= yearMax) out.push(y);
    }
    return out;
  }, [decadeStart, yearMin, yearMax]);

  const filteredYears: number[] = React.useMemo(() => {
    const q = yearQuery.replace(/\D/g, "");
    if (!q) return yearsInDecade;
    // Busca global entre yearMin/yearMax
    const all: number[] = [];
    for (let y = yearMax; y >= yearMin; y--) if (String(y).includes(q)) all.push(y);
    return all.slice(0, 30);
  }, [yearQuery, yearsInDecade, yearMin, yearMax]);

  function pickYear(y: number) {
    setCursorYear(y);
    setDecadeStart(Math.floor(y / 10) * 10);
    setYearQuery("");
    setView("month");
  }

  const showHelperText = !hasInitial;

  return (
    <div className={cn("relative", className)}>
      <Popover
        open={open}
        onOpenChange={(o) => {
          if (!disabled) setOpen(o);
          if (!o) onBlur?.();
        }}
      >
        <PopoverTrigger asChild>
          <div className="relative">
            <input
              id={id}
              name={name}
              type="text"
              inputMode="numeric"
              autoComplete="bday"
              placeholder={placeholder}
              aria-label={ariaLabel}
              aria-invalid={!!error}
              disabled={disabled}
              value={text}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onClick={() => !disabled && setOpen(true)}
              onFocus={() => !disabled && setOpen(true)}
              className={cn(
                "luxury-input w-full rounded-xl px-4 py-3 pr-11",
                error && "border-destructive focus:border-destructive",
              )}
              maxLength={10}
            />
            <button
              type="button"
              tabIndex={-1}
              aria-label="Abrir seletor de data"
              disabled={disabled}
              onClick={(e) => {
                e.preventDefault();
                if (!disabled) setOpen((v) => !v);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center h-8 w-8 rounded-lg text-[color:var(--gold)] hover:bg-[color:var(--gold)]/10 transition"
            >
              <CalendarIcon className="h-4 w-4" />
            </button>
          </div>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            "z-50 p-0 w-[min(23rem,calc(100vw-1.5rem))] max-w-[23rem]",
            "border border-white/10 bg-[#111114] text-white shadow-2xl rounded-2xl overflow-hidden",
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Guia superior */}
          {showHelperText && (
            <div className="px-3 pt-3 pb-1 text-[11px] text-white/60">
              {view === "year" && "Passo 1 de 3 · Escolha o ano de nascimento"}
              {view === "month" && "Passo 2 de 3 · Escolha o mês"}
              {view === "day" && "Passo 3 de 3 · Escolha o dia"}
            </div>
          )}

          {/* Header com botões explícitos */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-white/5 bg-black/40">
            <button
              type="button"
              onClick={() => {
                if (view === "year") {
                  // navegar entre décadas quando em modo de anos
                  setDecadeStart((s) => Math.max(s - 10, Math.floor(yearMin / 10) * 10));
                } else {
                  prevMonth();
                }
              }}
              aria-label="Anterior"
              className="grid place-items-center h-9 w-9 rounded-lg hover:bg-white/5 text-white/80 border border-white/5"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex-1 flex items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => setView((v) => (v === "month" ? "day" : "month"))}
                aria-expanded={view === "month"}
                aria-label={`Mês: ${MESES[cursorMonth]}. Clique para trocar o mês.`}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer",
                  "border bg-white/[0.03] hover:bg-white/5 hover:border-[color:var(--gold)]/40",
                  view === "month"
                    ? "border-[color:var(--gold)]/60 text-[color:var(--gold)] bg-[color:var(--gold)]/10"
                    : "border-white/10 text-white/90",
                )}
              >
                <span>{MESES[cursorMonth]}</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setView((v) => (v === "year" ? "day" : "year"));
                  setYearMode("years");
                  setDecadeStart(Math.floor(cursorYear / 10) * 10);
                }}
                aria-expanded={view === "year"}
                aria-label={`Ano: ${cursorYear}. Clique para escolher outro ano.`}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-semibold transition cursor-pointer",
                  "border bg-white/[0.03] hover:bg-white/5 hover:border-[color:var(--gold)]/40",
                  view === "year"
                    ? "border-[color:var(--gold)]/60 text-[color:var(--gold)] bg-[color:var(--gold)]/10"
                    : "border-white/15 text-white",
                )}
              >
                <span className="text-white/60 mr-0.5">Ano:</span>
                <span>{cursorYear}</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (view === "year") {
                  setDecadeStart((s) => {
                    const maxStart = Math.floor(yearMax / 10) * 10;
                    return Math.min(s + 10, maxStart);
                  });
                } else {
                  nextMonth();
                }
              }}
              aria-label="Próximo"
              className="grid place-items-center h-9 w-9 rounded-lg hover:bg-white/5 text-white/80 border border-white/5"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* CTA "Escolher ano" visível enquanto não confirmado */}
          {view !== "year" && !hasInitial && (
            <div className="px-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setView("year");
                  setYearMode("years");
                  setDecadeStart(Math.floor(cursorYear / 10) * 10);
                }}
                className="w-full text-xs font-medium py-2 rounded-lg border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 text-[color:var(--gold)] hover:bg-[color:var(--gold)]/15 transition"
              >
                Escolher ano de nascimento
              </button>
            </div>
          )}

          {/* Body */}
          <div className="p-3">
            {view === "year" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-white/50 mb-1">
                    Digite o ano
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="ex.: 2000"
                    value={yearQuery}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setYearQuery(v);
                      setYearMode(v ? "years" : yearMode);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const y = Number(yearQuery);
                        if (yearQuery.length === 4 && y >= yearMin && y <= yearMax) {
                          e.preventDefault();
                          pickYear(y);
                        }
                      }
                    }}
                    className="w-full rounded-lg bg-black/40 border border-white/10 focus:border-[color:var(--gold)]/60 focus:outline-none px-3 py-2 text-sm text-white placeholder:text-white/30"
                  />
                </div>

                {/* Tabs: décadas / anos */}
                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setYearMode("decades")}
                    className={cn(
                      "px-2 py-1 rounded-md transition",
                      yearMode === "decades"
                        ? "bg-white/10 text-white"
                        : "text-white/50 hover:text-white/80",
                    )}
                  >
                    Por década
                  </button>
                  <button
                    type="button"
                    onClick={() => setYearMode("years")}
                    className={cn(
                      "px-2 py-1 rounded-md transition",
                      yearMode === "years"
                        ? "bg-white/10 text-white"
                        : "text-white/50 hover:text-white/80",
                    )}
                  >
                    {yearQuery ? "Resultados" : `${decadeStart}–${decadeStart + 9}`}
                  </button>
                </div>

                {yearMode === "decades" && !yearQuery ? (
                  <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-auto pr-1">
                    {decades.map((d) => {
                      const active = decadeStart === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            setDecadeStart(d);
                            setYearMode("years");
                          }}
                          className={cn(
                            "py-2 rounded-lg text-sm transition border",
                            active
                              ? "border-[color:var(--gold)]/60 bg-[color:var(--gold)]/10 text-[color:var(--gold)]"
                              : "border-white/10 bg-white/[0.02] text-white/85 hover:bg-white/5",
                          )}
                        >
                          {d}–{d + 9}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-[220px] overflow-auto pr-1">
                    {filteredYears.length === 0 ? (
                      <div className="col-span-3 text-center text-xs text-white/40 py-4">
                        Nenhum ano encontrado.
                      </div>
                    ) : (
                      filteredYears.map((y) => {
                        const sel = draftParts ? draftParts[0] === y : cursorYear === y;
                        const isCurrent = today.y === y;
                        return (
                          <button
                            key={y}
                            type="button"
                            onClick={() => pickYear(y)}
                            className={cn(
                              "py-2.5 rounded-lg text-sm transition outline-none border",
                              "focus-visible:ring-2 focus-visible:ring-[color:var(--gold)]/60",
                              sel
                                ? "border-[color:var(--gold)] bg-[color:var(--gold)] text-black font-semibold"
                                : "border-white/10 bg-white/[0.02] text-white/90 hover:bg-white/5 hover:border-[color:var(--gold)]/40",
                              isCurrent && !sel && "ring-1 ring-inset ring-white/20",
                            )}
                          >
                            {y}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}

            {view === "month" && (
              <div className="grid grid-cols-3 gap-2">
                {MESES_CURTOS.map((mn, idx) => {
                  const sel =
                    draftParts && draftParts[0] === cursorYear && draftParts[1] - 1 === idx;
                  const isCurrent = today.y === cursorYear && today.m === idx;
                  const disabled = cursorYear === yearMax && idx > today.m && cursorYear >= today.y;
                  return (
                    <button
                      key={mn}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setCursorMonth(idx);
                        setView("day");
                      }}
                      className={cn(
                        "py-2.5 rounded-lg text-sm transition outline-none border",
                        "focus-visible:ring-2 focus-visible:ring-[color:var(--gold)]/60",
                        sel
                          ? "border-[color:var(--gold)] bg-[color:var(--gold)] text-black font-semibold"
                          : "border-white/10 bg-white/[0.02] text-white/90 hover:bg-white/5 hover:border-[color:var(--gold)]/40",
                        isCurrent && !sel && "ring-1 ring-inset ring-white/20",
                        disabled && "opacity-40 cursor-not-allowed hover:bg-white/[0.02]",
                      )}
                    >
                      {mn}
                    </button>
                  );
                })}
              </div>
            )}

            {view === "day" && (
              <>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {DIAS_SEMANA.map((d, i) => (
                    <div
                      key={i}
                      className="text-[10px] uppercase tracking-wider text-white/40 text-center py-1"
                    >
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDayIdx }).map((_, i) => (
                    <div key={`e-${i}`} />
                  ))}
                  {Array.from({ length: totalDays }).map((_, i) => {
                    const day = i + 1;
                    const sel = isSelected(day);
                    const td = isToday(day);
                    const dis = isDayDisabled(day);
                    return (
                      <button
                        type="button"
                        key={day}
                        disabled={dis}
                        aria-selected={sel}
                        aria-disabled={dis}
                        onClick={() => selectDay(day)}
                        className={cn(
                          "h-9 rounded-lg text-sm transition outline-none",
                          "focus-visible:ring-2 focus-visible:ring-[color:var(--gold)]/60",
                          !sel && !dis && "text-white/85 hover:bg-white/5",
                          td && !sel && "ring-1 ring-inset ring-white/20",
                          sel && "bg-[color:var(--gold)] text-black font-semibold shadow",
                          dis && "text-white/25 cursor-not-allowed",
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-white/5 bg-black/40">
            {allowClear ? (
              <button
                type="button"
                onClick={clear}
                className="text-xs text-white/60 hover:text-white/90 transition px-2 py-1.5 rounded-md"
              >
                Limpar
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancel}
                className="text-xs text-white/70 hover:text-white transition px-3 py-1.5 rounded-md border border-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={!draftIso}
                className={cn(
                  "text-xs font-medium px-3 py-1.5 rounded-md transition",
                  draftIso
                    ? "bg-[color:var(--gold)] text-black hover:brightness-95"
                    : "bg-white/5 text-white/40 cursor-not-allowed",
                )}
              >
                Confirmar
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {showHelper && !error && (
        <p className="mt-1.5 text-xs text-white/50">
          Você pode digitar a data ou escolher pelo calendário.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export default BirthDatePicker;
