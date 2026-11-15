"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

// A citation shown the way AI search tools show them: the site's icon and name, linking to the
// page, with the full address in the tooltip. The icon is the site's own /favicon.ico (no
// third-party icon service); a globe is shown when the site has none.
export function SourceChip({
  href,
  host,
  showHost = true,
  className,
}: {
  href: string;
  host: string;
  showHost?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  let origin = "";
  try {
    origin = new URL(href).origin;
  } catch {
    // leave empty: globe icon
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      title={href}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border bg-muted/60 py-px pr-2 pl-0.5 align-middle text-[11px] leading-4 font-medium text-muted-foreground no-underline transition-colors hover:border-brand/40 hover:bg-brand/10 hover:text-brand",
        !showHost && "pr-1",
        className,
      )}
    >
      <span className="grid size-3.5 shrink-0 place-items-center overflow-hidden rounded-full bg-background">
        {origin && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element -- tiny remote favicon, any host
          <img
            src={`${origin}/favicon.ico`}
            alt=""
            width={14}
            height={14}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            onLoad={(e) => {
              // Some sites answer /favicon.ico with an empty or 1px image.
              if (e.currentTarget.naturalWidth < 2) setFailed(true);
            }}
            className="size-3.5 object-contain"
          />
        ) : (
          <Globe className="size-2.5" aria-hidden="true" />
        )}
      </span>
      {showHost ? <span className="truncate">{host}</span> : <span className="sr-only">{host}</span>}
    </a>
  );
}
