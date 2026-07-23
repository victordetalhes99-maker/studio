// Tipagem global do widget Cloudflare Turnstile carregado via <script>.
export interface TurnstileRenderOptions {
  sitekey: string;
  theme?: "light" | "dark" | "auto";
  action?: string;
  callback?: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
}

export interface TurnstileGlobal {
  render(el: HTMLElement, options: TurnstileRenderOptions): string;
  remove(widgetId: string): void;
  reset(widgetId?: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileGlobal;
  }
}

export {};
