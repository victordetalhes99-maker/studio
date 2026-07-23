import { supabase } from "@/integrations/supabase/client";

export const TURNSTILE_SITE_KEY = "0x4AAAAAADognQzkw5zB0jmN";

let scriptLoading: Promise<void> | null = null;

export function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-turnstile="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.dataset.turnstile = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar Turnstile"));
    document.head.appendChild(s);
  });
  return scriptLoading;
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  action?: string,
): Promise<boolean> {
  if (!token) return false;
  try {
    const { data, error } = await supabase.functions.invoke("verify-turnstile", {
      body: { token, action },
    });
    if (error) return false;
    return Boolean((data as { success?: boolean } | null)?.success);
  } catch {
    return false;
  }
}
