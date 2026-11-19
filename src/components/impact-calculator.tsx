"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Info, Link2, RotateCcw } from "lucide-react";
import {
  computeImpact,
  DEFAULT_INPUTS,
  fromHash,
  LIMITS,
  toHash,
  type ImpactInputs,
} from "@/lib/impact/model";
import { cn } from "@/lib/utils";

// Landing-page business impact calculator. Every number is the visitor's own assumption; the
// maths is in src/lib/impact/model.ts (tested). Colours use the landing tokens (sidebar-*), so it
// follows the page's dark and light backgrounds.

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usdCompact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const one = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const money = (v: number) => (Math.abs(v) >= 100000 ? usdCompact.format(v) : usd.format(v));

// How often something happens, from a monthly count: "every 4 weeks", "every 3 months".
function every(perMonth: number): string {
  const months = 1 / perMonth;
  if (months < 0.9) {
    const weeks = Math.max(1, Math.round(months * 4.3));
    return weeks === 1 ? "every week" : `every ${weeks} weeks`;
  }
  const m = Math.round(months);
  return m === 1 ? "every month" : `every ${m} months`;
}

type Field = { key: keyof ImpactInputs; label: string; hint: string; format: (v: number) => string };

const GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: "Your time",
    fields: [
      { key: "hoursPerMonth", label: "Hours a month on prospecting", hint: "Research, finding people, writing first emails.", format: (v) => `${v} h` },
      { key: "manualHoursPerPitch", label: "Hours per pitch by hand", hint: "Researching one company, finding the right person, writing a tailored email.", format: (v) => `${v} h` },
      { key: "polarisHoursPerPitch", label: "Hours per pitch with Polaris", hint: "Reviewing the cited research, editing the draft, approving it.", format: (v) => `${v} h` },
    ],
  },
  {
    title: "Your funnel",
    fields: [
      { key: "replyRate", label: "Reply rate today", hint: "Share of your pitches that get any reply.", format: (v) => `${v}%` },
      { key: "meetingRate", label: "Replies that become meetings", hint: "", format: (v) => `${v}%` },
      { key: "winRate", label: "Meetings that become deals", hint: "", format: (v) => `${v}%` },
      { key: "dealValue", label: "Average deal value", hint: "First-year value of one won deal.", format: (v) => usd.format(v) },
      { key: "salesCycleMonths", label: "Sales cycle", hint: "Months from first email to signed deal.", format: (v) => `${v} ${v === 1 ? "month" : "months"}` },
    ],
  },
  {
    title: "Your costs",
    fields: [
      { key: "hourlyValue", label: "Value of an hour of your time", hint: "", format: (v) => usd.format(v) },
      { key: "polarisMonthlyCost", label: "Polaris running cost a month", hint: "AI, contact data and hosting. Change it to your own figure.", format: (v) => usd.format(v) },
    ],
  },
];

const UPLIFTS = [
  { value: 0, label: "Volume only", note: "Same reply rate; more pitches" },
  { value: 1, label: "+1 point replies", note: "Research-led pitches reply a little more" },
  { value: 2, label: "+2 points replies", note: "A stronger assumption" },
];

export function ImpactCalculator() {
  const [inputs, setInputs] = useState<ImpactInputs>(DEFAULT_INPUTS);
  const [touched, setTouched] = useState(false);
  const [copied, setCopied] = useState(false);
  const r = useMemo(() => computeImpact(inputs), [inputs]);

  // A shared link (#impact?…) opens the same scenario.
  // Also on hashchange, for a link opened while the page is already showing.
  useEffect(() => {
    const load = () => {
      const shared = fromHash(window.location.hash);
      if (!shared) return;
      setInputs(shared);
      document.getElementById("impact")?.scrollIntoView({ block: "start" });
    };
    load();
    window.addEventListener("hashchange", load);
    return () => window.removeEventListener("hashchange", load);
  }, []);

  // Keep the address in step once the visitor changes something, without adding history entries.
  useEffect(() => {
    if (!touched) return;
    window.history.replaceState(null, "", `${window.location.pathname}${toHash(inputs)}`);
  }, [inputs, touched]);

  const set = (key: keyof ImpactInputs, value: number) => {
    setTouched(true);
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}${toHash(inputs)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the address bar already holds the link.
    }
  };

  const reset = () => {
    setTouched(true);
    setInputs(DEFAULT_INPUTS);
  };

  const ret = r.returnMultiple;

  return (
    <section id="impact" aria-labelledby="impact-title" className="relative scroll-mt-24 px-5 pb-6 pt-4 sm:px-8">
      <div className="mx-auto max-w-[1120px] space-y-8">
        <header className="space-y-4">
          <div className="kicker text-gold">Business impact</div>
          <h2 id="impact-title" className="text-3xl font-semibold text-sidebar-foreground tracking-tight text-balance sm:text-4xl">
            What Polaris could mean for <span className="text-gradient">your pipeline</span>
          </h2>
          <p className="max-w-3xl text-lg leading-relaxed text-sidebar-foreground/80">
            Polaris researches each company, finds the right person and drafts a cited pitch, so an hour of your time
            covers more of your market. Put in your own numbers to see what that means for replies, meetings and
            revenue.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          {/* Inputs */}
          <div className="space-y-6 rounded-3xl border border-sidebar-border bg-sidebar-accent/40 p-5 sm:p-6">
            {GROUPS.map((g) => (
              <fieldset key={g.title} className="space-y-4">
                <legend className="mb-3 font-mono text-xs font-medium tracking-[0.14em] text-gold uppercase">{g.title}</legend>
                {g.fields.map((f) => (
                  <Slider key={f.key} field={f} value={inputs[f.key]} onChange={(v) => set(f.key, v)} />
                ))}
              </fieldset>
            ))}
          </div>

          {/* Results */}
          <div className="space-y-5">
            <div role="radiogroup" aria-label="Reply rate assumption" className="flex flex-wrap gap-2">
              {UPLIFTS.map((u) => {
                const on = inputs.replyUplift === u.value;
                return (
                  <button
                    key={u.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    title={u.note}
                    onClick={() => set("replyUplift", u.value)}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      on
                        ? "border-brand bg-brand/15 text-sidebar-foreground"
                        : "border-sidebar-border text-sidebar-foreground/75 hover:text-sidebar-foreground",
                    )}
                  >
                    {u.label}
                  </button>
                );
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Tile
                big
                label="Extra revenue in the first 12 months"
                value={money(r.extraRevenue12)}
                note={`After a ${inputs.salesCycleMonths}-month sales cycle`}
              />
              <Tile
                label="Return on Polaris"
                value={ret === null ? "—" : `${one.format(ret)}×`}
                note={ret === null ? "Set a running cost to see it" : `Extra revenue ÷ ${usd.format(r.polarisCost12)} a year`}
              />
              <Tile
                label="Extra meetings a month"
                value={one.format(r.extraMeetings)}
                note={`${one.format(r.extraDealsPerYear)} extra deals in the first year`}
              />
              <Tile label="Pipeline added a month" value={money(r.extraPipelinePerMonth)} note="Extra meetings × deal value" />
            </div>

            <Comparison r={r} />
            <Chart data={r.cumulative} />

            <p className="rounded-2xl border border-sidebar-border px-4 py-3 text-[0.9375rem] leading-relaxed text-sidebar-foreground/85">
              <strong className="font-semibold text-sidebar-foreground">Or keep today&apos;s volume.</strong> Sending the
              same {r.without.pitches} pitches a month with Polaris frees about {one.format(r.hoursSavedAtSameVolume)} hours
              a month, worth {usd.format(r.timeValueSaved)}.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-2 rounded-full border border-sidebar-border px-4 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {copied ? <Check className="size-4 text-success" /> : <Link2 className="size-4" />}
                {copied ? "Link copied" : "Copy link to this scenario"}
              </button>
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <RotateCcw className="size-4" /> Reset to examples
              </button>
            </div>
          </div>
        </div>

        <p className="flex gap-2.5 rounded-2xl border border-dashed border-sidebar-border px-4 py-3 text-[13px] leading-relaxed text-sidebar-foreground/75 italic">
          <Info className="mt-0.5 size-4 shrink-0 text-gold not-italic" aria-hidden="true" />
          <span>
            Estimates from the numbers above, not Polaris results. The starting values are examples; replace them with
            your own. &quot;Volume only&quot; assumes your reply rate stays the same and counts only the extra pitches
            your hours can cover. Deals are spread evenly; real results vary month to month.
          </span>
        </p>
      </div>
    </section>
  );
}

function Slider({ field, value, onChange }: { field: Field; value: number; onChange: (v: number) => void }) {
  const lim = LIMITS[field.key];
  const id = `impact-${field.key}`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[0.9375rem] font-medium">
          {field.label}
        </label>
        <output htmlFor={id} className="shrink-0 font-heading text-base font-semibold tabular-nums">
          {field.format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={lim.min}
        max={lim.max}
        step={lim.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-describedby={field.hint ? `${id}-hint` : undefined}
        className="h-2 w-full cursor-pointer accent-brand"
      />
      {field.hint && (
        <p id={`${id}-hint`} className="text-[13px] leading-snug text-sidebar-foreground/65">
          {field.hint}
        </p>
      )}
    </div>
  );
}

function Tile({ label, value, note, big = false }: { label: string; value: string; note: string; big?: boolean }) {
  return (
    <div className={cn("rounded-2xl border border-sidebar-border bg-sidebar-accent/40 p-4", big && "sm:col-span-3")}>
      <div className="text-sm text-sidebar-foreground/75">{label}</div>
      <div
        className={cn(
          "mt-1 font-heading font-semibold tracking-tight tabular-nums",
          big ? "text-gradient text-5xl" : "text-3xl",
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-[13px] text-sidebar-foreground/65 italic">{note}</div>
    </div>
  );
}

function Comparison({ r }: { r: ReturnType<typeof computeImpact> }) {
  const rows: { label: string; a: string; b: string }[] = [
    { label: "Researched pitches", a: String(r.without.pitches), b: String(r.with.pitches) },
    { label: "Replies", a: one.format(r.without.replies), b: one.format(r.with.replies) },
    { label: "Meetings", a: one.format(r.without.meetings), b: one.format(r.with.meetings) },
    { label: "Deals", a: one.format(r.without.deals), b: one.format(r.with.deals) },
    { label: "Revenue", a: money(r.without.revenue), b: money(r.with.revenue) },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-sidebar-border">
      <table className="w-full text-[0.9375rem]">
        <caption className="sr-only">A month of prospecting, without and with Polaris</caption>
        <thead className="bg-sidebar-accent/50 text-left text-sm">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium text-sidebar-foreground/75">
              Each month
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium text-sidebar-foreground/75">
              By hand
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-semibold">
              With Polaris
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-sidebar-border/70">
              <th scope="row" className="px-4 py-2 text-left font-normal text-sidebar-foreground/85">
                {row.label}
              </th>
              <td className="px-4 py-2 text-right tabular-nums text-sidebar-foreground/75">{row.a}</td>
              <td className="px-4 py-2 text-right font-semibold tabular-nums">{row.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {r.without.meetings > 0 && r.with.meetings > 0 && (
        <p className="border-t border-sidebar-border/70 px-4 py-2.5 text-[0.9375rem] leading-relaxed">
          {/* Meetings, not deals: the number a team can check within weeks, in its own calendar
              and in Polaris's Outreach timeline. */}
          <strong className="font-semibold">
            {one.format(r.with.meetings / r.without.meetings)}× the conversations from the same hours:
          </strong>{" "}
          a new meeting roughly {every(r.with.meetings)} with Polaris, against {every(r.without.meetings)} by hand.
          <span className="mt-0.5 block text-[13px] text-sidebar-foreground/65 italic">
            Easy to check: Polaris logs every reply and meeting on Outreach and the Dashboard.
          </span>
        </p>
      )}
    </div>
  );
}

// Cumulative revenue over the first 12 months, with and without Polaris.
function Chart({ data }: { data: { month: number; without: number; with: number }[] }) {
  const W = 600;
  const H = 200;
  const pad = { l: 14, r: 18, t: 12, b: 24 };
  const max = Math.max(1, ...data.map((d) => d.with), ...data.map((d) => d.without));
  const x = (m: number) => pad.l + ((m - 1) / 11) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const line = (k: "with" | "without") => data.map((d) => `${x(d.month)},${y(d[k])}`).join(" ");
  const area = `${pad.l},${y(0)} ${line("with")} ${x(12)},${y(0)}`;
  const last = data[data.length - 1];

  return (
    <figure className="rounded-2xl border border-sidebar-border p-4">
      <figcaption className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium">Revenue won, first 12 months</span>
        <span className="flex items-center gap-4 text-[13px] text-sidebar-foreground/75">
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-4 rounded-full bg-brand" aria-hidden="true" /> With Polaris {money(last.with)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-4 rounded-full bg-sidebar-foreground/40" aria-hidden="true" /> By hand {money(last.without)}
          </span>
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`By month 12: ${money(last.with)} with Polaris, ${money(last.without)} by hand.`}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad.l} x2={W - pad.r} y1={y(max * f)} y2={y(max * f)} className="stroke-sidebar-border" strokeDasharray="3 5" />
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} className="stroke-sidebar-border" />
        <polygon points={area} className="fill-brand/10" />
        <polyline points={line("without")} fill="none" className="stroke-sidebar-foreground/40" strokeWidth={2.5} strokeLinejoin="round" />
        <polyline points={line("with")} fill="none" className="stroke-brand" strokeWidth={3} strokeLinejoin="round" />
        {data.map((d) => (
          <text key={d.month} x={x(d.month)} y={H - 6} textAnchor="middle" className="fill-sidebar-foreground/60 text-[11px]">
            {d.month === 1 || d.month % 3 === 0 ? `M${d.month}` : ""}
          </text>
        ))}
      </svg>
    </figure>
  );
}
