import type { Anamnese, YesNo } from "@/lib/clientes";

interface Props {
  value: Anamnese;
  onChange: (v: Anamnese) => void;
}

const QUESTOES: Array<{
  key: keyof Anamnese;
  label: string;
  descKey?: keyof Anamnese;
}> = [
  { key: "tratamentoMedico", label: "Está em tratamento médico?" },
  { key: "alergia", label: "Possui alguma alergia?", descKey: "alergiaDesc" },
  { key: "cirurgiaRecente", label: "Cirurgia recente?", descKey: "cirurgiaDesc" },
  { key: "diabetes", label: "Diabetes?", descKey: "diabetesDesc" },
  { key: "gestante", label: "É gestante?" },
  { key: "hipertensao", label: "Hipo ou hipertensão arterial?" },
  { key: "marcapasso", label: "Portador de marcapasso?" },
  {
    key: "doencaTransmissivel",
    label: "Alguma doença transmissível?",
    descKey: "doencaTransmissivelDesc",
  },
  { key: "convulsao", label: "Histórico de convulsão / epilepsia?" },
  { key: "circulatorio", label: "Distúrbio circulatório?" },
  { key: "problemaPele", label: "Problema de pele ou cicatrização?", descKey: "problemaPeleDesc" },
  { key: "fumante", label: "Fumante?" },
  { key: "alimentou24h", label: "Alimentou-se nas últimas 24h?" },
  { key: "drogasAlcool", label: "Está sob efeito de drogas ou álcool?" },
  { key: "bronzeado", label: "Está com a pele bronzeada?" },
  { key: "depressaoAnsiedade", label: "Depressão, pânico ou ansiedade?" },
  { key: "anemia", label: "Possui anemia?" },
  { key: "queloide", label: "Queloide?" },
  { key: "cardiopatia", label: "Cardiopatia?" },
  { key: "hemofilia", label: "Hemofilia?" },
  { key: "hepatite", label: "Hepatite?" },
  { key: "vitiligo", label: "Vitiligo?" },
];

export const TIPOS_SANGUINEOS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Não sei"];

export function AnamneseForm({ value, onChange }: Props) {
  const set = <K extends keyof Anamnese>(k: K, v: Anamnese[K]) => onChange({ ...value, [k]: v });

  return (
    <div className="space-y-3">
      {QUESTOES.map((q) => {
        const v = value[q.key] as YesNo | "";
        return (
          <div key={q.key} className="glass rounded-xl p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm sm:text-base text-foreground/90 flex-1 min-w-0">{q.label}</p>
              <div className="flex gap-2 shrink-0">
                <YNBtn
                  active={v === "sim"}
                  onClick={() => set(q.key, "sim" as Anamnese[typeof q.key])}
                >
                  Sim
                </YNBtn>
                <YNBtn
                  active={v === "nao"}
                  onClick={() => set(q.key, "nao" as Anamnese[typeof q.key])}
                >
                  Não
                </YNBtn>
              </div>
            </div>
            {q.descKey && v === "sim" && (
              <input
                type="text"
                placeholder="Especifique"
                value={(value[q.descKey] as string) || ""}
                onChange={(e) =>
                  set(q.descKey!, e.target.value as Anamnese[typeof q.descKey & keyof Anamnese])
                }
                className="luxury-input mt-3 w-full rounded-lg px-4 py-2.5 text-sm animate-in fade-in slide-in-from-top-2 duration-300"
              />
            )}
          </div>
        );
      })}

      <div className="glass rounded-xl p-4">
        <p className="text-sm sm:text-base text-foreground/90 mb-3">Tipo sanguíneo e fator RH</p>
        <div className="flex flex-wrap gap-2">
          {TIPOS_SANGUINEOS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set("tipoSanguineo", t)}
              className={`px-3 py-2 rounded-lg text-sm border transition-all ${
                value.tipoSanguineo === t
                  ? "bg-gold/15 border-gold text-gold"
                  : "border-white/10 text-foreground/70 hover:border-gold/40"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function YNBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-[68px] px-4 py-2.5 rounded-lg text-sm font-semibold tracking-wide border transition-all ${
        active
          ? "bg-gold/15 border-gold text-gold shadow-[0_0_20px_oklch(0.82_0.13_85/0.25)]"
          : "border-white/10 text-foreground/60 hover:border-gold/40 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function emptyAnamnese(): Anamnese {
  return {
    tratamentoMedico: "",
    alergia: "",
    cirurgiaRecente: "",
    diabetes: "",
    gestante: "",
    hipertensao: "",
    marcapasso: "",
    doencaTransmissivel: "",
    convulsao: "",
    circulatorio: "",
    problemaPele: "",
    fumante: "",
    tipoSanguineo: "",
    alimentou24h: "",
    drogasAlcool: "",
    bronzeado: "",
    depressaoAnsiedade: "",
    anemia: "",
    queloide: "",
    cardiopatia: "",
    hemofilia: "",
    hepatite: "",
    vitiligo: "",
  };
}
