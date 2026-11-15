"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AlertTriangle, Check, ChevronDown, Circle, CircleCheck } from "lucide-react";
import type { MilestoneState, MilestoneStatus } from "@/lib/journey/compute";
import { milestoneForPath } from "@/lib/journey/milestones";
import { cn } from "@/lib/utils";

export type JourneyBarItem = MilestoneStatus & { href: string };

const STATE_TEXT: Record<MilestoneState, string> = {
  complete: "Complete",
  in_progress: "In progress",
  not_started: "Not started",
  attention: "Needs attention",
};

// Seven-milestone progress bar for the selected profile (spec section 4). Every state, count and
// status line comes from getJourneyStatus(); this component only decides which one is current.
export function JourneyBar({ profileName, items }: { profileName: string; items: JourneyBarItem[] }) {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab");
  const current = milestoneForPath(pathname, tab);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelId = useId();
  const listId = useId();

  const currentIndex = items.findIndex((m) => m.key === current);
  const focusIndex = currentIndex >= 0 ? currentIndex : Math.max(0, items.findIndex((m) => m.state !== "complete"));
  const focus = items[focusIndex];
  const open = items.find((m) => m.key === expanded);

  return (
    <nav aria-label="Progress" className="mb-8 rounded-3xl border bg-card px-3 py-3 shadow-sm sm:px-4">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 text-[13px]">
        <span className="font-semibold text-emerald-700 dark:text-emerald-400">Profile:</span>
        <span className="font-medium">{profileName}</span>
      </div>

      {/* Phones: one line, tap to show the full list. */}
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm sm:hidden"
        aria-expanded={mobileOpen}
        aria-controls={listId}
        onClick={() => setMobileOpen((v) => !v)}
      >
        <span className="font-semibold">
          Step {focusIndex + 1} of {items.length}: {focus?.label}
        </span>
        <span className="truncate text-muted-foreground">· {focus?.built ? focus.status : "Coming soon"}</span>
        <ChevronDown className={cn("ml-auto size-4 shrink-0 transition-transform", mobileOpen && "rotate-180")} />
      </button>

      <div className={cn("sm:block sm:overflow-x-auto", mobileOpen ? "mt-3 block" : "hidden")}>
        {/* Desktop: a stepper. Each stage's number sits in a circle above its name, and a line
            joins the circles; a segment turns green once the stage before it is complete. */}
        <ol id={listId} className="grid gap-1 sm:min-w-[44rem] sm:grid-cols-7 sm:gap-0">
          {items.map((m, i) => {
            const isCurrent = m.key === current;
            const complete = m.built && m.state === "complete";
            const prevComplete = i > 0 && items[i - 1].built && items[i - 1].state === "complete";
            const marker = (
              <span
                aria-hidden="true"
                className={cn(
                  "relative z-10 grid size-6 shrink-0 place-items-center rounded-full border bg-card text-[11px] font-semibold tabular-nums",
                  !m.built && "border-dashed text-muted-foreground",
                  complete && "border-success bg-success text-white",
                  m.built && m.state === "in_progress" && "border-brand text-brand",
                  m.built && m.state === "not_started" && "text-muted-foreground",
                  m.built && m.state === "attention" && "border-destructive bg-destructive/10 text-destructive",
                  isCurrent && "ring-3 ring-brand/25",
                )}
              >
                {i + 1}
                {complete && (
                  <span className="absolute -right-1 -bottom-1 grid size-3 place-items-center rounded-full bg-card text-success">
                    <Check className="size-2.5" strokeWidth={4} />
                  </span>
                )}
              </span>
            );
            const label = m.built ? (
              <Link href={m.href} className="rounded-md font-semibold outline-none hover:text-brand focus-visible:ring-3 focus-visible:ring-ring/50">
                {m.label}
              </Link>
            ) : (
              <span className="font-semibold">{m.label}</span>
            );

            return (
              <li
                key={m.key}
                aria-current={isCurrent ? "step" : undefined}
                aria-disabled={m.built ? undefined : "true"}
                className={cn(
                  "relative flex items-start gap-2.5 rounded-2xl border border-transparent px-1.5 py-1.5 sm:flex-col sm:items-center sm:gap-1 sm:text-center",
                  isCurrent && "border-brand/40 bg-brand/[0.06]",
                  !m.built && "opacity-60",
                )}
              >
                {/* Connecting line: left half joins the previous stage, right half the next one. */}
                {i > 0 && (
                  <span
                    aria-hidden="true"
                    className={cn("absolute top-[18px] right-1/2 -left-px hidden h-0.5 sm:block", prevComplete ? "bg-success" : "bg-border")}
                  />
                )}
                {i < items.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={cn("absolute top-[18px] -right-px left-1/2 hidden h-0.5 sm:block", complete ? "bg-success" : "bg-border")}
                  />
                )}
                {marker}
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-[11px] leading-tight sm:justify-center">
                    {label}
                    {m.built && (
                      <button
                        type="button"
                        className="grid size-4 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                        aria-expanded={expanded === m.key}
                        aria-controls={panelId}
                        aria-label={`${expanded === m.key ? "Hide" : "Show"} ${m.label} tasks`}
                        onClick={() => setExpanded((k) => (k === m.key ? null : m.key))}
                      >
                        <ChevronDown className={cn("size-3 transition-transform", expanded === m.key && "rotate-180")} />
                      </button>
                    )}
                  </span>
                  <span
                    className={cn(
                      "block text-[9px] leading-tight",
                      !m.built ? "text-muted-foreground/75 italic" : "text-muted-foreground",
                      m.built && m.state === "attention" && "font-medium text-destructive",
                    )}
                  >
                    {m.built ? m.status : "Coming soon"}
                  </span>
                  <span className="sr-only">{m.built ? `, ${STATE_TEXT[m.state]}` : ", not available yet"}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div id={panelId} hidden={!open}>
        {open && (
          <div className="mt-3 rounded-2xl border border-dashed px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              {open.state === "attention" && <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />}
              {open.label}: {STATE_TEXT[open.state].toLowerCase()}
            </div>
            <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-3">
              {open.subtasks.map((s) => (
                <li key={s.label} className="flex items-start gap-2 text-sm">
                  {s.done ? (
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  ) : (
                    <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                  <span>
                    <span className="font-medium">{s.label}</span>
                    <span className="sr-only">{s.done ? ": done" : ": not done"}</span>
                    {s.detail && <span className="block text-[13px] text-muted-foreground/75 italic">{s.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
}
