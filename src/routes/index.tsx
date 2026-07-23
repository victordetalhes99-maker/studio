import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCliente, isValidCPF, maskCPF, onlyDigits } from "@/lib/clientes";

const INTRO_TEXT =
  "Sua experiência começa agora. Para garantir total segurança, privacidade e exclusividade no seu procedimento, realize o seu check-in digital rápido antes de iniciar a sua sessão.";

export default function CheckinPage() {
  const [step, setStep] = useState<"intro" | "cpf">("intro");
  const [typed, setTyped] = useState("");
  const [cpf, setCpf] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Check-in — 85 TATTOO Studio";
  }, []);

  useEffect(() => {
    if (step !== "intro") return;
    setTyped("");
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      setTyped(INTRO_TEXT.slice(0, i));
      if (i >= INTRO_TEXT.length) window.clearInterval(id);
    }, 32);
    return () => window.clearInterval(id);
  }, [step]);

  const valid = isValidCPF(cpf);

  const avancar = async () => {
    if (!valid) {
      setErro("CPF inválido. Confira os números digitados.");
      return;
    }
    const digits = onlyDigits(cpf);
    sessionStorage.setItem("checkin_cpf", digits);
    sessionStorage.setItem("checkin_ts_ok", "1");
    const cliente = await getCliente(digits);
    if (cliente) navigate("/recorrente");
    else navigate("/cadastro");
  };

  const typingDone = typed.length >= INTRO_TEXT.length;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <header className="text-center mb-10 sm:mb-14">
        <p className="text-[10px] sm:text-xs tracking-[0.5em] text-gold/80 uppercase mb-3">
          &#8203;
        </p>
        <h1 className="font-light text-5xl sm:text-7xl tracking-tight">
          <span className="gradient-gold-text font-serif italic">85 TATTOO </span>
          <span className="text-foreground">&#8203;</span>
        </h1>
        <div className="mx-auto mt-5 h-px w-24 bg-gradient-to-r from-transparent via-gold to-transparent" />
      </header>

      <section className="glass-strong rounded-2xl w-full max-w-md p-7 sm:p-9 relative overflow-hidden">
        {step === "intro" ? (
          <div key="intro" className="animate-fade-in">
            <p className="text-[10px] tracking-[0.3em] text-gold/80 uppercase mb-5 text-center">
              Bem-vindo à 85 Tattoo House
            </p>
            <p className="text-base sm:text-lg leading-relaxed text-foreground/90 font-light min-h-[12rem] sm:min-h-[10rem]">
              {typed}
              <span className="inline-block w-[2px] h-[1.1em] align-[-0.15em] bg-gold ml-0.5 animate-pulse" />
            </p>

            <button
              onClick={() => setStep("cpf")}
              disabled={!typingDone}
              className="btn-gold w-full mt-8 rounded-xl py-4 text-base uppercase tracking-[0.2em]"
            >
              Iniciar Check-in
            </button>
          </div>
        ) : (
          <div key="cpf" className="animate-fade-in">
            <h2 className="text-xl sm:text-2xl font-light text-foreground mb-1">Check-in</h2>
            <p className="text-sm text-muted-foreground mb-7">Digite seu CPF para iniciar</p>

            <label className="block text-[10px] tracking-[0.3em] text-gold/80 uppercase mb-2">
              CPF
            </label>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={cpf}
              onChange={(e) => {
                setErro(null);
                setCpf(maskCPF(e.target.value));
              }}
              onKeyDown={(e) => e.key === "Enter" && avancar()}
              placeholder="000.000.000-00"
              className="luxury-input w-full rounded-xl px-5 py-4 text-lg tracking-widest text-center"
            />

            {erro && <p className="mt-3 text-sm text-destructive text-center">{erro}</p>}

            <button
              onClick={avancar}
              disabled={!valid}
              className="btn-gold w-full mt-6 rounded-xl py-4 text-base uppercase tracking-[0.2em]"
            >
              Avançar
            </button>

            <p className="text-[11px] text-muted-foreground text-center mt-6 leading-relaxed">
              Seus dados são protegidos e utilizados exclusivamente para o seu atendimento no
              estúdio.
            </p>
          </div>
        )}
      </section>

      <footer className="mt-10 text-[10px] tracking-[0.4em] text-muted-foreground/60 uppercase">
        <a href="/lgpd" className="hover:text-gold transition-colors">
          Direitos do titular (LGPD)
        </a>
      </footer>
    </main>
  );
}
