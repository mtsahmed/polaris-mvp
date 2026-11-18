"use client";

import { useState } from "react";
import type { SegmentSlice } from "@/lib/dashboard/companies";
import { cn } from "@/lib/utils";

const SIZE = 220;
const STROKE = 34;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const GAP = 2; // px of surface between segments

// Leads by industry segment (owner review, 18 Nov 2026). Hovering a segment or its legend row
// shows its count and share in the centre; the legend names every segment with its count, so
// nothing depends on colour alone, and the Table view lists every company.
export function SegmentDonut({ slices }: { slices: SegmentSlice[] }) {
  const [active, setActive] = useState<string | null>(null);
  const total = slices.reduce((n, s) => n + s.count, 0);
  if (!total)
    return (
      <p className="text-[13px] text-muted-foreground/75 italic">
        No companies in the pipeline yet.
      </p>
    );

  const shown = slices.find((s) => s.segment === active) ?? null;
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;
  const single = slices.length === 1;
  // Where each segment starts on the ring: the running total of the ones before it.
  const starts = slices.map((_, i) => slices.slice(0, i).reduce((n, x) => n + (x.count / total) * CIRC, 0));

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-10">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="size-52 shrink-0"
        role="img"
        aria-label={`Leads by segment: ${slices.map((s) => `${s.segment} ${s.count}`).join(", ")}`}
      >
        {/* The ring starts at 12 o'clock and runs clockwise. */}
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={STROKE}
          />
          {slices.map((s, i) => {
            const len = (s.count / total) * CIRC;
            const dash = single ? len : Math.max(len - GAP, 0.5);
            const el = (
              <circle
                key={s.segment}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={s.colour}
                strokeWidth={active === s.segment ? STROKE + 6 : STROKE}
                strokeDasharray={`${dash} ${CIRC - dash}`}
                strokeDashoffset={-starts[i]}
                className={cn(
                  "cursor-pointer transition-[stroke-width,opacity]",
                  active && active !== s.segment && "opacity-40",
                )}
                onMouseEnter={() => setActive(s.segment)}
                onMouseLeave={() => setActive(null)}
              >
                <title>{`${s.segment}: ${s.count} (${pct(s.count)})`}</title>
              </circle>
            );
            return el;
          })}
        </g>
        <g>
          <text
            x="50%"
            y="47%"
            textAnchor="middle"
            className="fill-foreground font-heading text-[34px] font-semibold tabular-nums"
          >
            {shown ? shown.count : total}
          </text>
          <text
            x="50%"
            y="60%"
            textAnchor="middle"
            className="fill-muted-foreground text-[13px]"
          >
            {shown
              ? `${pct(shown.count)} of leads`
              : total === 1
                ? "lead"
                : "leads"}
          </text>
        </g>
      </svg>

      <ul className="w-full min-w-0 space-y-1.5 text-sm">
        {slices.map((s) => (
          <li
            key={s.segment}
            onMouseEnter={() => setActive(s.segment)}
            onMouseLeave={() => setActive(null)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-2 py-1 transition-colors",
              active === s.segment && "bg-muted/60",
            )}
          >
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-sm"
              style={{ background: s.colour }}
            />
            <span className="min-w-0 flex-1 truncate" title={s.segment}>
              {s.segment}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {s.count} · {pct(s.count)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
