import { Check } from "lucide-react";
import type { PipelineStage } from "@/lib/types";
import { cn } from "@/lib/utils";

// One prospect's place in the pipeline (spec section 6), read from prospects.stage.
// "New lead" shows as not started; Won and Lost show as an end label after the bar.
const STEPS: { stage: PipelineStage; label: string }[] = [
  { stage: "researching", label: "Researching" },
  { stage: "ready_to_pitch", label: "Ready to pitch" },
  { stage: "contacted", label: "Contacted" },
  { stage: "replied", label: "Replied" },
  { stage: "meeting_booked", label: "Meeting booked" },
];

export function ProspectStageBar({ stage, className }: { stage: PipelineStage; className?: string }) {
  const ended = stage === "won" || stage === "lost";
  const index = ended ? STEPS.length : STEPS.findIndex((s) => s.stage === stage); // -1 for new_lead

  return (
    <nav aria-label="Pipeline stage" className={cn("flex flex-wrap items-center gap-x-2 gap-y-2", className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
        {STEPS.map((s, i) => {
          const done = i < index;
          const current = i === index;
          return (
            <li key={s.stage} aria-current={current ? "step" : undefined} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden="true" className={cn("h-px w-4 bg-border", done || current ? "bg-brand/50" : "")} />}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-medium",
                  done && "border-success/40 text-success",
                  current && "border-brand bg-brand/10 text-brand",
                  !done && !current && "text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden="true" /> : <span aria-hidden="true">{i + 1}</span>}
                {s.label}
                <span className="sr-only">{done ? ", done" : current ? ", current" : ", not yet"}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {index === -1 && <span className="text-[13px] text-muted-foreground/75 italic">Not started: new lead</span>}
      {ended && (
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[13px] font-semibold",
            stage === "won" ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive",
          )}
        >
          {stage === "won" ? "Won" : "Lost"}
        </span>
      )}
    </nav>
  );
}
