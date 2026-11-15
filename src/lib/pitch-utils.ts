import type { DealType, PipelineStage, Signal } from "@/lib/types";

// What each deal type means for the outreach and what usually comes next.
export const DEAL_TYPE_INFO: Record<DealType, { label: string; next: string }> = {
  partnership: {
    label: "Partnership",
    next: "Both sides contribute (content, sponsorship, event). Next: agree scope and who pays for what.",
  },
  customer: {
    label: "Customer",
    next: "They buy or pilot your product or service. Next: a short call to scope a pilot and its terms.",
  },
  referral: {
    label: "Referral",
    next: "You send each other clients. Next: agree how referrals are passed on and rewarded.",
  },
  co_marketing: {
    label: "Co-marketing",
    next: "You promote something together. Next: pick the joint asset (case study, feature, event) and dates.",
  },
};

// One stable order for research signals everywhere (newest dated first, undated last),
// so the R1, R2… labels in the UI match the ones the AI saw.
export function orderSignals<T extends Pick<Signal, "source_date" | "summary">>(signals: T[]): T[] {
  return [...signals].sort((a, b) => {
    if (a.source_date && b.source_date) return b.source_date.localeCompare(a.source_date) || a.summary.localeCompare(b.summary);
    if (a.source_date) return -1;
    if (b.source_date) return 1;
    return a.summary.localeCompare(b.summary);
  });
}

export function signalLabel(index: number) {
  return `R${index + 1}`;
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export const STAGE_LABEL: Record<PipelineStage, string> = {
  new_lead: "New lead",
  researching: "Researching",
  ready_to_pitch: "Ready to pitch",
  contacted: "Contacted",
  replied: "Replied",
  meeting_booked: "Meeting booked",
  won: "Won",
  lost: "Lost",
};
