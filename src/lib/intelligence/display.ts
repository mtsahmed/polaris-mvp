import { BAND_LABEL, type FitBand } from "./fit";
import { BRIEF_STALE_DAYS, effectiveStatus, type Brief, type BriefStatus } from "./types";

export const STATUS_LABEL: Record<BriefStatus, string> = {
  researching: "Researching",
  ready: "Ready",
  insufficient_evidence: "Insufficient evidence",
  failed: "Research failed",
};

export function bandLabel(band: FitBand | null) {
  return band ? BAND_LABEL[band] : null;
}

export function bandTone(band: FitBand | null) {
  if (band === "strong") return "text-success";
  if (band === "possible") return "text-brand";
  return "text-muted-foreground";
}

export function ageInDays(iso: string, now = Date.now()) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000));
}

export function ageLabel(iso: string | null) {
  if (!iso) return null;
  const d = ageInDays(iso);
  return d === 0 ? "Today" : d === 1 ? "1 day old" : `${d} days old`;
}

export function isStale(b: Pick<Brief, "researched_at">) {
  return Boolean(b.researched_at && ageInDays(b.researched_at) > BRIEF_STALE_DAYS);
}

export { effectiveStatus };
