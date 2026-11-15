import "server-only";
import { z } from "zod";
import { SIGNAL_TYPES } from "@/lib/ai/pitch";
import { icpSummary, profileSummary } from "@/lib/ai/profile-summary";
import { plainText } from "@/lib/rich-text";
import { researchProvider } from "@/lib/research/provider";
import type { Icp, Profile } from "@/lib/types";
import { CRITERIA, type CriterionKey } from "./fit";

// ---------------------------------------------------------------------------
// The intelligence brief (spec 7.3–7.5): deeper research on one shortlisted company, then a
// fit score from five criteria, timing, risks, a recommendation, roles and concept starters.
// Every claim points at findings by label; labels are mapped to stored signal ids in code, and
// any finding whose link the AI did not really read is dropped before anything is saved.
// ---------------------------------------------------------------------------

export const MAX_NEW_FINDINGS = 10;
const CRITERION_KEYS = CRITERIA.map((c) => c.key) as [CriterionKey, ...CriterionKey[]];

const BriefSchema = z.object({
  findings: z
    .array(
      z.object({
        type: z.enum(SIGNAL_TYPES),
        summary: z.string().describe("One sentence: what the source shows."),
        source_url: z.string().describe("Exact URL of the page you read or the search result this came from."),
        source_date: z.string().describe("Publication date as YYYY-MM-DD if the source shows one; empty string if not."),
        quote: z.string().describe("A short verbatim excerpt from that source."),
      }),
    )
    .describe(`New findings from this research, labelled N1, N2… in order. Up to ${MAX_NEW_FINDINGS}.`),
  summary: z
    .string()
    .describe("Two or three sentences: who the company is and why it is or is not relevant to this profile."),
  criteria: z
    .array(
      z.object({
        key: z.enum(CRITERION_KEYS),
        rating: z
          .number()
          .nullable()
          .describe("0 to 20, or null when there is no evidence for this criterion (Unknown). Never guess."),
        reason: z.string().describe("One line. When rating is null, say what evidence is missing."),
        refs: z.array(z.string()).describe("Labels of the findings (E# or N#) this rating rests on."),
      }),
    )
    .describe("Exactly one entry for each of the five criteria."),
  why_now: z
    .array(z.object({ statement: z.string(), ref: z.string().describe("Label of the finding (E# or N#).") }))
    .describe("Dated timing signals: a campaign, launch, new market, relevant hire, funding or sponsorship. Empty if none."),
  risks: z
    .array(
      z.object({
        statement: z.string(),
        ref: z
          .string()
          .describe("Label of the finding behind this risk, or an empty string when the risk is a lack of evidence."),
      }),
    )
    .describe("What could make this a poor fit: an exclusive partner in place, audience mismatch, cutbacks."),
  recommendation: z.enum(["pursue", "hold", "skip"]),
  recommendation_reason: z.string().describe("One sentence."),
  suggested_angle: z.string().describe("One sentence: the angle a pitch should take."),
  target_roles: z
    .array(z.object({ role: z.string().describe("A job title or function, never a person's name."), reason: z.string() }))
    .describe("One to three roles to approach."),
  concept_starters: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().describe("Two or three sentences: what the profile proposes and what the company gets."),
        refs: z.array(z.string()).describe("Labels of the findings this idea builds on."),
      }),
    )
    .describe("Two or three partnership ideas tied to the evidence."),
});

const SYSTEM = `You write intelligence briefs for Polaris, which helps businesses (often media and creative businesses, sometimes software or service companies) win partnerships, sponsorships, pilots and customers.

Research the company: read its website first, then search the web for recent, specific evidence, and open the pages you rely on rather than trusting search snippets. Then judge how well it fits the profile and its ideal customer profile (ICP).

Evidence rules:
- Existing findings are labelled E1, E2…; new findings you add are labelled N1, N2… in the order you list them.
- Every new finding needs the exact URL of a page you read or a search result you were shown, plus a short verbatim quote. Never construct, guess or shorten a URL.
- Every rating, timing signal, concept starter and sourced risk must cite finding labels. Do not use outside knowledge about the company.
- If there is no evidence for a criterion, set its rating to null (Unknown) and say what is missing. Never fill a gap with a guess; a null rating is better than an invented one.

Criteria, each rated 0–20 only when evidence exists:
${CRITERIA.map((c) => `- ${c.key}: ${c.question}`).join("\n")}

Recommendation: pursue (clear fit and a reason to act), hold (plausible but unproven or poorly timed) or skip (poor fit). Target roles are job titles or functions only, never named people.

Write plainly, without marketing superlatives. No URLs or markdown links inside text fields; links go only in source_url.`;

export type ExistingSignal = { id: string; type: string; summary: string; source_url: string; source_date: string | null };

export async function researchBrief(input: {
  profile: Profile;
  icp: Icp | null;
  company: { name: string; website: string | null };
  existing: ExistingSignal[];
  notes: string | null;
}) {
  const existing = input.existing
    .map(
      (s, i) =>
        `E${i + 1} [${s.type}${s.source_date ? `, ${s.source_date}` : ""}] ${plainText(s.summary)} (${s.source_url})`,
    )
    .join("\n");

  return researchProvider().run({
    task: "intelligence-brief",
    system: SYSTEM,
    prompt: `Write the brief for this company as a possible partner or customer for the profile below.

Company: ${input.company.name}
${input.company.website ? `Website (W1): ${input.company.website}` : "Website: not known"}

Existing findings:
${existing || "(none)"}

The profile we represent (do not research it):
${profileSummary(input.profile)}

${icpSummary(input.icp)}
${input.notes ? `\nNotes from the user (leads, not facts):\n${input.notes}\n` : ""}`,
    schema: BriefSchema,
    schemaName: "intelligence_brief",
    urls: input.company.website ? [{ label: "W1", url: input.company.website }] : undefined,
    maxSearches: 6,
    effort: "high",
    maxTokens: 16000,
  });
}

export type BriefOutput = z.infer<typeof BriefSchema>;
