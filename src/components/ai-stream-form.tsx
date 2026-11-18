"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { PolarisWorking } from "@/components/polaris-working";
import type { AiTask } from "@/lib/ai-jobs/tasks";
import { useAiStream } from "@/lib/ai-stream/use-ai-stream";
import { cn } from "@/lib/utils";

// A form for an AI step the user waits on. It sends the form fields (plus `fields`) to
// POST /api/ai/[task] and shows the Polaris working panel with a live line ("Reading
// naturahq.com…") and, for emails, the draft as it is written. SubmitButton inside works as with
// ActionForm: it shows the pending label and the star while the run lasts.
export function AiStreamForm({
  task,
  fields,
  resultKey = null,
  working,
  note,
  children,
  className,
  panelClassName,
  draftLabel = "First email so far",
  panelSlot,
}: {
  task: AiTask;
  fields?: Record<string, string>;
  // Changes when the result is saved (a timestamp or id). Used only if the connection drops.
  resultKey?: string | null;
  working: string; // the first line, before the server reports anything
  note?: string; // one sentence on how long it takes, under the live line
  children: ReactNode;
  className?: string;
  panelClassName?: string;
  draftLabel?: string;
  // id of an element elsewhere on the page (for example the top of a card's body) where the
  // working panel shows, when the form itself sits in a narrow spot such as a card header.
  panelSlot?: string;
}) {
  const ai = useAiStream(task, resultKey);

  async function action(formData: FormData) {
    const body: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) if (typeof value === "string") body[key] = value;
    await ai.run({ ...body, ...fields }, working);
  }

  const panel = (
    <PolarisWorking panel className={cn("mt-3 items-start", panelClassName)}>
      <span className="block">{ai.line}</span>
      {note && ai.running && <span className="mt-1 block text-xs not-italic text-muted-foreground/70">{note}</span>}
      {ai.draft && (
        <span className="mt-3 block rounded-xl border border-border/60 bg-card px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap not-italic text-foreground">
          <span className="mb-1 block font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
            {draftLabel}
          </span>
          {ai.draft}
        </span>
      )}
    </PolarisWorking>
  );

  return (
    <form action={action} className={className}>
      <fieldset disabled={ai.waiting} className="contents">
        {children}
      </fieldset>
      {(ai.running || ai.waiting) && <Portal slot={panelSlot}>{panel}</Portal>}
      {ai.error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {ai.error}
        </p>
      )}
    </form>
  );
}

// The panel only renders while a run is active (after a click), so the document is available.
function Portal({ slot, children }: { slot?: string; children: ReactNode }) {
  const target = slot ? document.getElementById(slot) : null;
  return target ? createPortal(children, target) : children;
}
