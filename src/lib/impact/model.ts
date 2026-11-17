// Business impact calculator for the landing page. Pure, so it is tested.
//
// Every input is the visitor's own assumption. Polaris has no measured results yet (the roadmap's
// success metric, reply and meeting rate per 20 pitches, is still being collected), so the model
// claims only what follows from the inputs: the same prospecting hours buy more researched
// pitches when Polaris does the research, contact finding and first draft, and those pitches run
// through the visitor's own funnel. Any reply-rate uplift is an explicit, optional assumption.

export type ImpactInputs = {
  hoursPerMonth: number; // hours the team spends on prospecting each month
  manualHoursPerPitch: number; // research, finding the person and writing one pitch by hand
  polarisHoursPerPitch: number; // reviewing, editing and approving one Polaris pitch
  replyRate: number; // % of pitches that get a reply today
  replyUplift: number; // extra reply-rate points assumed for research-led pitches (0 = volume only)
  meetingRate: number; // % of replies that become a meeting
  winRate: number; // % of meetings that become a deal
  dealValue: number; // average first-year value of a won deal, $
  salesCycleMonths: number; // months from first pitch to signed deal
  hourlyValue: number; // what an hour of the team's time is worth, $
  polarisMonthlyCost: number; // what running Polaris costs per month, $
};

export const DEFAULT_INPUTS: ImpactInputs = {
  hoursPerMonth: 40,
  manualHoursPerPitch: 3,
  polarisHoursPerPitch: 0.75,
  replyRate: 5,
  replyUplift: 0,
  meetingRate: 40,
  winRate: 20,
  dealValue: 10000,
  salesCycleMonths: 2,
  hourlyValue: 75,
  polarisMonthlyCost: 350,
};

// Slider ranges, shared by the page and the URL parser so a shared link cannot set odd values.
export const LIMITS: Record<keyof ImpactInputs, { min: number; max: number; step: number }> = {
  hoursPerMonth: { min: 5, max: 200, step: 5 },
  manualHoursPerPitch: { min: 0.5, max: 8, step: 0.25 },
  polarisHoursPerPitch: { min: 0.25, max: 4, step: 0.25 },
  replyRate: { min: 0.5, max: 30, step: 0.5 },
  replyUplift: { min: 0, max: 5, step: 1 },
  meetingRate: { min: 5, max: 100, step: 5 },
  winRate: { min: 5, max: 100, step: 5 },
  dealValue: { min: 500, max: 250000, step: 500 },
  salesCycleMonths: { min: 0, max: 9, step: 1 },
  hourlyValue: { min: 0, max: 500, step: 5 },
  polarisMonthlyCost: { min: 0, max: 3000, step: 25 },
};

export type Funnel = {
  pitches: number;
  replies: number;
  meetings: number;
  deals: number;
  revenue: number; // per month, once deals start landing
};

export type ImpactResult = {
  without: Funnel;
  with: Funnel;
  extraPitches: number;
  extraMeetings: number;
  extraDealsPerYear: number;
  extraPipelinePerMonth: number; // extra meetings × deal value
  extraRevenue12: number; // first 12 months, allowing for the sales cycle
  hoursSavedAtSameVolume: number; // if the team keeps today's pitch count instead
  timeValueSaved: number; // those hours × hourly value
  polarisCost12: number;
  returnMultiple: number | null; // (extra revenue in 12 months) / (12 months of Polaris); null if cost is 0
  pitchesPerDeal: { without: number | null; with: number | null };
  cumulative: { month: number; without: number; with: number }[]; // revenue, months 1–12
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function clampInputs(raw: Partial<Record<keyof ImpactInputs, unknown>>): ImpactInputs {
  const out = { ...DEFAULT_INPUTS };
  for (const key of Object.keys(LIMITS) as (keyof ImpactInputs)[]) {
    const v = Number(raw[key]);
    if (raw[key] !== undefined && raw[key] !== "" && Number.isFinite(v)) out[key] = clamp(v, LIMITS[key].min, LIMITS[key].max);
  }
  return out;
}

function funnel(pitches: number, replyRate: number, i: ImpactInputs): Funnel {
  const replies = pitches * (replyRate / 100);
  const meetings = replies * (i.meetingRate / 100);
  const deals = meetings * (i.winRate / 100);
  return { pitches, replies, meetings, deals, revenue: deals * i.dealValue };
}

// Revenue earned by the end of each month: pitches start in month 1, and a month's deals land
// salesCycleMonths later.
function cumulativeRevenue(monthly: number, cycle: number): number[] {
  const out: number[] = [];
  let total = 0;
  for (let m = 1; m <= 12; m++) {
    if (m > cycle) total += monthly;
    out.push(total);
  }
  return out;
}

export function computeImpact(input: ImpactInputs): ImpactResult {
  const i = clampInputs(input);
  // Whole pitches only: nobody sends 13.3 emails.
  const manualPitches = Math.floor(i.hoursPerMonth / i.manualHoursPerPitch);
  const polarisPitches = Math.floor(i.hoursPerMonth / i.polarisHoursPerPitch);
  const without = funnel(manualPitches, i.replyRate, i);
  const withP = funnel(polarisPitches, Math.min(100, i.replyRate + i.replyUplift), i);

  const cycle = Math.round(i.salesCycleMonths);
  const cWithout = cumulativeRevenue(without.revenue, cycle);
  const cWith = cumulativeRevenue(withP.revenue, cycle);
  const extraRevenue12 = cWith[11] - cWithout[11];
  const polarisCost12 = i.polarisMonthlyCost * 12;
  const hoursSaved = manualPitches * Math.max(0, i.manualHoursPerPitch - i.polarisHoursPerPitch);
  const perDeal = (f: Funnel) => (f.deals > 0 ? f.pitches / f.deals : null);

  return {
    without,
    with: withP,
    extraPitches: withP.pitches - without.pitches,
    extraMeetings: withP.meetings - without.meetings,
    extraDealsPerYear: (withP.deals - without.deals) * Math.max(0, 12 - cycle),
    extraPipelinePerMonth: (withP.meetings - without.meetings) * i.dealValue,
    extraRevenue12,
    hoursSavedAtSameVolume: hoursSaved,
    timeValueSaved: hoursSaved * i.hourlyValue,
    polarisCost12,
    returnMultiple: polarisCost12 > 0 ? extraRevenue12 / polarisCost12 : null,
    pitchesPerDeal: { without: perDeal(without), with: perDeal(withP) },
    cumulative: cWith.map((v, idx) => ({ month: idx + 1, without: cWithout[idx], with: v })),
  };
}

// The scenario in the page address after "#", so a link opens the same numbers. Numbers only.
const SHORT: Record<keyof ImpactInputs, string> = {
  hoursPerMonth: "h",
  manualHoursPerPitch: "mh",
  polarisHoursPerPitch: "ph",
  replyRate: "rr",
  replyUplift: "up",
  meetingRate: "mr",
  winRate: "wr",
  dealValue: "dv",
  salesCycleMonths: "sc",
  hourlyValue: "hv",
  polarisMonthlyCost: "pc",
};

export function toHash(i: ImpactInputs): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(SHORT) as (keyof ImpactInputs)[]) {
    if (i[key] !== DEFAULT_INPUTS[key]) params.set(SHORT[key], String(i[key]));
  }
  const s = params.toString();
  return s ? `#impact?${s}` : "#impact";
}

export function fromHash(hash: string): ImpactInputs | null {
  const m = /^#impact\?(.*)$/.exec(hash);
  if (!m) return null;
  const params = new URLSearchParams(m[1]);
  const raw: Partial<Record<keyof ImpactInputs, unknown>> = {};
  for (const key of Object.keys(SHORT) as (keyof ImpactInputs)[]) {
    const v = params.get(SHORT[key]);
    if (v !== null) raw[key] = v;
  }
  return clampInputs(raw);
}
