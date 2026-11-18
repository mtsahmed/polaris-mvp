"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { saveCompanyNotes } from "@/app/(app)/dashboard/actions";
import { Input } from "@/components/ui/input";
import { ADDED_WITHIN, queryCompanies, SORTS, type AddedWithin, type CompanyRow, type SortKey } from "@/lib/dashboard/companies";
import { STAGE_LABEL, STAGE_ORDER } from "@/lib/outreach/rules";
import type { PipelineStage } from "@/lib/types";
import { cn } from "@/lib/utils";

// Status and Sort by sit in a column at the right edge: same label and box widths.
const RIGHT_LABEL = "w-14 text-right font-medium";
const RIGHT_SELECT = "w-40";
const SELECT =
  "h-10 rounded-xl border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

// Dashboard table view (owner review, 18 Nov 2026): one row per company in the pipeline, a search
// box for company or region, filters (segment, status, date added), a sort menu and notes that
// save when the box loses focus. Follows the data-table rules in docs/design-guide.md.
export function CompanyTable({ rows, segments }: { rows: CompanyRow[]; segments: string[] }) {
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("");
  const [stage, setStage] = useState<PipelineStage | "">("");
  const [added, setAdded] = useState<AddedWithin>("any");
  const [sort, setSort] = useState<SortKey>("recent");

  const shown = useMemo(
    () => queryCompanies(rows, { search, segment, stage, added, sort }, STAGE_ORDER),
    [rows, search, segment, stage, added, sort],
  );
  const filtered = search || segment || stage || added !== "any";

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a company or region"
          aria-label="Search a company or region"
          className="h-11 pl-10"
        />
      </div>

      {/* Two rows: Segment stretches so Status sits at the right edge, above Sort by. */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <span className="font-medium">Segment</span>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            className={cn(SELECT, "min-w-0 flex-1")}
          >
            <option value="">All</option>
            {segments.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className={RIGHT_LABEL}>Status</span>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as PipelineStage | "")}
            className={cn(SELECT, RIGHT_SELECT)}
          >
            <option value="">All</option>
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium">Date added</span>
          <select value={added} onChange={(e) => setAdded(e.target.value as AddedWithin)} className={SELECT}>
            {ADDED_WITHIN.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className={RIGHT_LABEL}>Sort by</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={cn(SELECT, RIGHT_SELECT)}>
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-[13px] text-muted-foreground/75 italic">
        {filtered ? `${shown.length} of ${rows.length} companies match.` : `${rows.length} companies.`} Notes are the same as
        &ldquo;What you already know&rdquo; in the pitch studio, and save when you click away.
      </p>

      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <thead className="bg-muted/30 text-left">
            <tr className="[&>th]:border-b [&>th]:border-border/40 [&>th]:px-4 [&>th]:py-2.5 [&>th]:font-semibold">
              <th scope="col">Company</th>
              <th scope="col">Segment</th>
              <th scope="col">Status</th>
              <th scope="col">Main email</th>
              <th scope="col" className="w-[34%]">
                Notes
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="align-top [&>td]:border-t [&>td]:border-border/40 [&>td]:px-4 [&>td]:py-2.5">
                <td>
                  <Link href={`/intelligence/${r.id}`} className="font-medium hover:text-brand hover:underline">
                    {r.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {r.location ?? "Location unknown"} · added {dateFmt.format(new Date(r.added))}
                  </div>
                </td>
                <td>{r.segment}</td>
                <td className="whitespace-nowrap">{r.status}</td>
                <td>
                  {r.email ? (
                    <span className="space-y-0.5">
                      <a href={`mailto:${r.email}`} className="break-all text-blue-600 hover:underline dark:text-blue-400">
                        {r.email}
                      </a>
                      {r.emailUnconfirmed && (
                        <span className="block text-xs text-muted-foreground italic">Not confirmed: may be guessed</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/60">–</span>
                  )}
                </td>
                <td>
                  <NotesCell id={r.id} initial={r.notes} company={r.name} />
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No company matches. Clear the search or a filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NotesCell({ id, initial, company }: { id: string; initial: string; company: string }) {
  const [saved, setSaved] = useState(initial);
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();

  function save() {
    if (value.trim() === saved.trim()) return;
    start(async () => {
      const result = await saveCompanyNotes(id, value);
      if (result.ok) {
        setSaved(value);
        toast.success(`Notes saved for ${company}.`);
      } else {
        toast.error(result.message ?? "Could not save the notes.");
      }
    });
  }

  // Grows with the text up to four lines (13px italic text, 4 x 18px line + 12px padding = 5.25rem), then scrolls
  // inside the box, so long notes never make the row taller (owner review, 18 November 2026).
  return (
    <textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      rows={2}
      maxLength={4000}
      placeholder="Add a note"
      aria-label={`Notes for ${company}`}
      className={cn(
        "field-sizing-content min-h-9 max-h-[5.25rem] w-full resize-none overflow-y-auto rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[13px] italic leading-[18px] outline-none transition-colors placeholder:text-muted-foreground/50 hover:border-border focus:border-ring focus:bg-background",
        pending && "opacity-60",
      )}
    />
  );
}
