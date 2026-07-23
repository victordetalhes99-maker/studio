// Utilitário para extrair mensagem de erro de forma segura a partir de `unknown`.
// Evita `catch (e: any)` no código de UI e mantém as mensagens legíveis ao usuário.

export interface ErrorLike {
  message?: string;
  statusCode?: number | string;
}

export function getErrorMessage(err: unknown, fallback = "Falha na operação"): string {
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === "string") return err || fallback;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as ErrorLike).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return fallback;
}

export function toErrorLike(err: unknown): ErrorLike {
  if (err && typeof err === "object") return err as ErrorLike;
  return {};
}
