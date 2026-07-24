// ============================================================================
// Preferência de aparência do painel admin (fundo preto ou branco).
// É só uma preferência local do navegador — não precisa de backend nem
// sincroniza entre dispositivos, como o resto das "Ações locais" do sistema.
// ============================================================================

export type AdminTheme = "dark" | "light";

const STORAGE_KEY = "admin_theme";
const EVENT_NAME = "admin-theme-change";

export function getStoredAdminTheme(): AdminTheme {
  if (typeof window === "undefined") return "dark";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function setStoredAdminTheme(theme: AdminTheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* noop */
  }
  window.dispatchEvent(new CustomEvent<AdminTheme>(EVENT_NAME, { detail: theme }));
}

/** Assina mudanças de tema feitas em qualquer lugar da árvore (mesma aba). */
export function subscribeAdminTheme(callback: (theme: AdminTheme) => void): () => void {
  function handler(e: Event) {
    callback((e as CustomEvent<AdminTheme>).detail);
  }
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
