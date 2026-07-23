import { cn } from "@/lib/utils";
import { STATUS_LABELS, statusTone, type StatusTone } from "@/lib/backup/format";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "border-border/60 bg-background/60 text-muted-foreground",
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  danger: "border-red-500/40 bg-red-500/10 text-red-400",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-400",
};

export function StatusBadge({
  status,
  label,
}: {
  status: string | null | undefined;
  label?: string;
}) {
  const tone = statusTone(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        TONE_CLASS[tone],
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tone === "success" && "bg-emerald-400",
          tone === "warning" && "bg-amber-400",
          tone === "danger" && "bg-red-400",
          tone === "info" && "bg-sky-400 animate-pulse",
          tone === "neutral" && "bg-muted-foreground/60",
        )}
      />
      {label ?? STATUS_LABELS[status ?? ""] ?? status ?? "—"}
    </span>
  );
}
