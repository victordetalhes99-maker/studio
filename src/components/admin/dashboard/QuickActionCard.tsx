import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface QuickActionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  to?: string;
  href?: string;
  disabled?: boolean;
  disabledHint?: string;
}

export function QuickActionCard({
  icon: Icon,
  title,
  description,
  to,
  href,
  disabled = false,
  disabledHint = "Disponível após integração",
}: QuickActionCardProps) {
  const body = (
    <div
      className={cn(
        "group flex h-full items-start gap-3 rounded-xl border border-border/60 bg-card/50 p-4 backdrop-blur-sm transition-all",
        !disabled && "hover:border-[color:var(--gold)]/50 hover:bg-card/70",
        disabled && "opacity-60 cursor-not-allowed",
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-muted-foreground group-hover:text-[color:var(--gold)] group-hover:border-[color:var(--gold)]/50 transition-colors">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );

  if (disabled) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>{body}</div>
          </TooltipTrigger>
          <TooltipContent>{disabledHint}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block h-full">
        {body}
      </a>
    );
  }

  return (
    <Link to={to ?? "#"} className="block h-full">
      {body}
    </Link>
  );
}
