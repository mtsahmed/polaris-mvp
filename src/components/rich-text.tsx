import { parseRichText } from "@/lib/rich-text";
import { cn } from "@/lib/utils";
import { SourceChip } from "./source-chip";

// Renders AI research text: citations as icon chips, people's names highlighted.
export function RichText({ text, omitHref, className }: { text: string; omitHref?: string; className?: string }) {
  const tokens = parseRichText(text, omitHref);
  return (
    <span className={className}>
      {tokens.map((t, i) => {
        if (t.kind === "text") return <span key={i}>{t.text}</span>;
        if (t.kind === "person") return <PersonName key={i} name={t.text} />;
        return (
          <span key={i}>
            {" "}
            <SourceChip href={t.href} host={t.host} />
          </span>
        );
      })}
    </span>
  );
}

export function PersonName({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "rounded-md bg-gold/25 px-1 py-px font-semibold text-foreground box-decoration-clone dark:bg-gold/20",
        className,
      )}
    >
      {name}
    </span>
  );
}
