// Dashboard data (owner review, 18 November 2026): the segment donut on Main and the company
// table on Table view. Pure, so it is tested; shared by the server page and the client table.

import type { PipelineStage } from "@/lib/types";
import { OTHER_SEGMENT } from "@/lib/segments";

export type CompanyRow = {
  id: string; // prospect id
  name: string;
  segment: string;
  stage: PipelineStage;
  status: string; // stage label, e.g. "Meeting booked"
  location: string | null;
  email: string | null;
  emailUnconfirmed: boolean;
  notes: string;
  added: string; // ISO time the company joined the pipeline
};

// ---------------------------------------------------------------------------
// Donut: leads by segment
// ---------------------------------------------------------------------------

// Seven colours, then everything else is "Other" (never a generated eighth colour).
export const SEGMENT_COLOURS = 7;

export type SegmentSlice = { segment: string; count: number; colour: string };

// Colours follow the segment, not its size: the ICP's industries take the colour slots in the
// ICP's order, any other segment after them alphabetically, so a filter or a new lead never
// repaints a segment.
export function segmentSlices(rows: { segment: string }[], icpSegments: string[]): SegmentSlice[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.segment, (counts.get(r.segment) ?? 0) + 1);

  const extra = [...counts.keys()]
    .filter((s) => s !== OTHER_SEGMENT && !icpSegments.includes(s))
    .sort((a, b) => a.localeCompare(b));
  const order = [...icpSegments, ...extra];
  const coloured = order.slice(0, SEGMENT_COLOURS);

  const slices: SegmentSlice[] = [];
  coloured.forEach((segment, i) => {
    const count = counts.get(segment) ?? 0;
    if (count) slices.push({ segment, count, colour: `var(--segment-${i + 1})` });
  });
  const other = [...counts].filter(([s]) => !coloured.includes(s)).reduce((n, [, c]) => n + c, 0);
  if (other) slices.push({ segment: OTHER_SEGMENT, count: other, colour: "var(--segment-other)" });
  return slices;
}

// ---------------------------------------------------------------------------
// Table: search, filters, sort
// ---------------------------------------------------------------------------

export const SORTS = [
  { key: "recent", label: "Recent" },
  { key: "oldest", label: "Oldest" },
  { key: "segment", label: "Segment" },
  { key: "status", label: "Status" },
  { key: "region", label: "Region" },
] as const;
export type SortKey = (typeof SORTS)[number]["key"];

export const ADDED_WITHIN = [
  { key: "any", label: "Any time", days: null },
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
] as const;
export type AddedWithin = (typeof ADDED_WITHIN)[number]["key"];

export type TableQuery = {
  search: string; // company name or region
  segment: string; // "" = all
  stage: PipelineStage | "";
  added: AddedWithin;
  sort: SortKey;
};

export function queryCompanies(rows: CompanyRow[], q: TableQuery, stageOrder: PipelineStage[], now = Date.now()): CompanyRow[] {
  const term = q.search.trim().toLowerCase();
  const days = ADDED_WITHIN.find((a) => a.key === q.added)?.days ?? null;
  const out = rows.filter(
    (r) =>
      (!term || r.name.toLowerCase().includes(term) || (r.location ?? "").toLowerCase().includes(term)) &&
      (!q.segment || r.segment === q.segment) &&
      (!q.stage || r.stage === q.stage) &&
      (days === null || now - Date.parse(r.added) <= days * 86_400_000),
  );
  const byName = (a: CompanyRow, b: CompanyRow) => a.name.localeCompare(b.name);
  const sorters: Record<SortKey, (a: CompanyRow, b: CompanyRow) => number> = {
    recent: (a, b) => b.added.localeCompare(a.added),
    oldest: (a, b) => a.added.localeCompare(b.added),
    segment: (a, b) => a.segment.localeCompare(b.segment) || byName(a, b),
    status: (a, b) => stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage) || byName(a, b),
    // Companies with no known location go last.
    region: (a, b) =>
      (a.location ? 0 : 1) - (b.location ? 0 : 1) || (a.location ?? "").localeCompare(b.location ?? "") || byName(a, b),
  };
  return out.sort(sorters[q.sort]);
}
