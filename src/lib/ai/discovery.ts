import "server-only";
import { z } from "zod";
import type { Icp, Profile } from "@/lib/types";
import { generateStructured } from "./generate";
import { SIGNAL_TYPES } from "./pitch";
import { icpSummary, profileSummary } from "./profile-summary";

// ---------------------------------------------------------------------------
// Discovery: find companies that might match a profile's ICP, each backed by cited findings and
// a light relevance summary. Scoring and deeper research happen in the Intelligence stage.
// ---------------------------------------------------------------------------

// End-to-end review (18 Nov 2026): at least 10 companies per run, within Vercel's 300-second
// limit. One search for 5 companies took about three minutes, so a run is split into batches of
// about 5 that search in parallel, each from a different angle (an ICP industry where possible).
export const DISCOVERY_COUNTS = [10, 15, 20] as const;
export const DEFAULT_DISCOVERY = 10;
export const MAX_DISCOVERY = 20;
const BATCH_SIZE = 5;

// Variety for runs with more batches than ICP industries.
const EXTRA_ANGLES = [
  "smaller, independent or founder-led companies",
  "established mid-size companies",
  "companies with news from the last six months (launches, funding, expansion, hiring)",
  "companies in a neighbouring niche that still fits the ICP",
];

export type DiscoveryBatch = { ask: number; angle: string | null };

// Splits a run into parallel batches. Each asks for one more company than its share, since some
// are dropped (no website, no finding whose link was read) or found by two batches. Pure.
export function planDiscoveryBatches(count: number, industries: string[]): DiscoveryBatch[] {
  const n = Math.max(1, Math.ceil(count / BATCH_SIZE));
  const ask = Math.ceil(count / n) + 1;
  if (n === 1) return [{ ask, angle: null }];
  return Array.from({ length: n }, (_, i) => {
    const own = industries.filter((_, j) => j % n === i);
    const angle = own.length ? own.join("; ") : EXTRA_ANGLES[(i - industries.length + EXTRA_ANGLES.length * n) % EXTRA_ANGLES.length];
    return { ask, angle };
  });
}

const DiscoverySchema = z.object({
  companies: z
    .array(
      z.object({
        name: z.string().describe("The company's name as it presents itself."),
        website: z.string().describe("The company's own homepage URL. Empty if you did not see it."),
        industry: z.string().describe("Industry in a few words. Empty if the sources do not say."),
        location: z.string().describe("Headquarters city and state or country. Empty if the sources do not say."),
        size: z
          .string()
          .describe('Company size as a source states it, e.g. "11-50 employees" or "about 200 staff". Empty if no source says.'),
        segment: z
          .string()
          .describe("The one target segment from the list in the prompt this company belongs to, copied exactly. \"Other\" if none fits."),
        fit_summary: z
          .string()
          .describe("One or two sentences: why this company looks relevant to the profile's ICP, from the findings only. A quick relevance check, not a verdict."),
        signals: z
          .array(
            z.object({
              type: z.enum(SIGNAL_TYPES),
              summary: z.string().describe("One sentence: what the source shows about the company."),
              source_url: z.string().describe("Exact URL of the page you read or the search result this came from."),
              source_date: z
                .string()
                .describe("Publication date as YYYY-MM-DD if the source shows one; empty string if it does not."),
              quote: z.string().describe("A short verbatim excerpt from that source supporting the summary."),
            }),
          )
          .describe("One to four findings about this company, each with its own source."),
      }),
    )
    .describe("Companies that fit, best first. Fewer is fine; never pad."),
  search_notes: z
    .array(z.string())
    .describe("Short notes on what was hard to find or where the ICP was too vague to search well."),
});

export type DiscoveryOutput = z.infer<typeof DiscoverySchema>;

const DISCOVERY_SYSTEM = `You find companies for Polaris, which helps businesses (often media and creative businesses, sometimes software or service companies) win partnerships, sponsorships, pilots and customers.

Use web search to find real companies that match the ideal customer profile (ICP) given, then give evidence for each.

Rules:
- Only include a company if you found at least one specific source about it. Every finding needs the exact URL of a page you read or a search result you were shown, plus a short verbatim quote from it. Never construct, guess or shorten a URL.
- Prefer recent, specific evidence (the last 12 months where possible): launches, campaigns, partnerships, sponsorships, events, funding, expansion, hiring, leadership changes, audience or content strategy. A company's own description of what it does is acceptable when nothing more specific exists.
- Skip directory listings, list articles that only name the company, and SEO filler as the sole evidence.
- Respect the geographies in the ICP. Do not include the profile's own company or any company on the exclusion list.
- Do not use outside knowledge about a company.
- Do not put URLs or markdown links inside summary, fit_summary or notes; links go only in source_url and website.
- Plain, specific language. No marketing superlatives.`;

export async function discoverCompanies(input: {
  profile: Profile;
  icp: Icp | null;
  focus: string | null;
  count: number;
  exclude: string[];
  angle?: string | null; // this batch's share of the search
  segments: string[];
  signal?: AbortSignal;
}) {
  return generateStructured({
    task: "discovery",
    system: DISCOVERY_SYSTEM,
    prompt: `Find up to ${input.count} companies for this profile to approach.

The profile we represent (do not include it):
${profileSummary(input.profile)}

${icpSummary(input.icp)}
${input.focus ? `\nThe user wants this search narrowed to: ${input.focus}\n` : ""}${
      input.angle ? `\nOther searches run at the same time cover other parts of the ICP. Search only this part: ${input.angle}\n` : ""
    }
Target segments (pick one per company, copied exactly, or "Other"): ${input.segments.length ? input.segments.join(" | ") : "(none given: use Other)"}

Exclude these domains (already in the profile's pipeline or dismissed): ${input.exclude.length ? input.exclude.join(", ") : "(none)"}`,
    schema: DiscoverySchema,
    schemaName: "company_discovery",
    webSearch: { maxUses: 6 },
    effort: "medium",
    maxTokens: 12000,
    signal: input.signal,
  });
}
