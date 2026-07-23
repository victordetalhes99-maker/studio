import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function SettingsSection({
  title,
  description,
  children,
  footer,
  className,
}: SettingsSectionProps) {
  return (
    <section
      className={cn("rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm", className)}
    >
      <header className="border-b border-border/40 px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </header>
      <div className="space-y-4 px-6 py-5">{children}</div>
      {footer ? (
        <footer className="flex justify-end gap-2 border-t border-border/40 px-6 py-3">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}
