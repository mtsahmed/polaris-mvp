import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-3">
        {eyebrow && <div className="kicker">{eyebrow}</div>}
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        {description && (
          <p className="max-w-[62ch] text-lg leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
    </header>
  );
}
