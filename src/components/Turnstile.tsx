import { useEffect, useRef } from "react";
import { loadTurnstileScript, TURNSTILE_SITE_KEY } from "@/lib/turnstile";

interface Props {
  onToken: (token: string | null) => void;
  action?: string;
  theme?: "light" | "dark" | "auto";
  className?: string;
}

export default function Turnstile({ onToken, action, theme = "dark", className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTurnstileScript().then(() => {
      if (cancelled || !ref.current) return;
      const ts = window.turnstile;

      if (!ts) return;
      try {
        widgetIdRef.current = ts.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme,
          action,
          callback: (token: string) => onToken(token),
          "error-callback": () => onToken(null),
          "expired-callback": () => onToken(null),
          "timeout-callback": () => onToken(null),
        });
      } catch {
        /* ignore double-render */
      }
    });
    return () => {
      cancelled = true;
      try {
        const ts = window.turnstile;
        if (ts && widgetIdRef.current) ts.remove(widgetIdRef.current);
      } catch {
        /* ignore */
      }
    };
  }, [action, theme, onToken]);

  return <div ref={ref} className={className} />;
}
