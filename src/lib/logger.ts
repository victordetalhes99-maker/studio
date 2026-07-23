type Primitive = string | number | boolean | null | undefined;

type LogLevel = "debug" | "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

const SENSITIVE_KEY_RE =
  /(authorization|token|secret|password|senha|cookie|cpf|email|telefone|phone|health|saude|medical|assinatura|signature|base64|document|rg|whatsapp|url)/i;

const DEFAULT_REDACTION = "[redacted]";

function maskString(value: string): string {
  if (value.length <= 6) return DEFAULT_REDACTION;
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

export function sanitizeLogValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    if (value.length > 180) return `${maskString(value.slice(0, 180))}...`;
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(sanitizeLogValue);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    };
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        SENSITIVE_KEY_RE.test(key) ? DEFAULT_REDACTION : sanitizeLogValue(entry),
      ]),
    );
  }
  return String(value);
}

function canEmitDebugLogs(): boolean {
  return import.meta.env.DEV && import.meta.env.MODE !== "production";
}

export function logSecure(level: LogLevel, message: string, meta?: LogMeta): void {
  if (level === "debug" && !canEmitDebugLogs()) return;
  const payload = meta ? sanitizeLogValue(meta) : undefined;
  const line = payload ? [message, payload] : [message];
  if (level === "error") console.error(...line);
  else if (level === "warn") console.warn(...line);
  else if (level === "info") console.info(...line);
  else console.debug(...line);
}

export function buildOperationId(seed: Primitive): string {
  const base = String(seed ?? "op");
  return `${base}-${Date.now().toString(36)}`;
}
