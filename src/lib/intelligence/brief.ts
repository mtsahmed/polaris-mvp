import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/generate";
import { SIGNAL_TYPES } from "@/lib/ai/pitch";
import { icpSummary, profileSummary } from "@/lib/ai/profile-summary";
import { plainText } from "@/lib/rich-text";
import { researchProvider } from "@/lib/research/provider";
import { DEAL_TYPES, type Icp, type Profile } from "@/lib/types";
import {
  CUSTOMER_CRITERIA,
  KNOCKOUT_RULES,
  knockoutRulesFor,
  PARTNER_CRITERIA,
  type CriterionDef,
  type KnockoutRule,
} from "./fit";

// ---------------------------------------------------------------------------
// The intelligence brief (spec 7.3–7.5): deeper research on one shortlisted company, then a
// fit score for a suggested deal goal (both criteria sets rated), knockouts, timing, risks, roles
// and concept starters. The recommendation itself is decided in code (fit.ts recommend()).
// Every claim points at findings by label; labels are mapped to stored signal ids in code, and
// any finding whose link the AI did not really read is dropped before anything is saved.
// ---------------------------------------------------------------------------

export const MAX_NEW_FINDINGS = 10;

const keysOf = (defs: readonly CriterionDef[]) => defs.map((c) => c.key) as [string, ...string[]];

function ratingsSchema(defs: readonly CriterionDef[], name: string) {
  return z
    .array(
      z.object({
        key: z.enum(keysOf(defs)),
        rating: z
          .number()
          .nullable()
          .describe("0, 5, 10, 15 or 20 using the anchors, or null when there is no evidence (Unknown). Never guess."),
        reason: z.string().describe("One line. When rating is null, say what evidence is missing."),
        refs: z.array(z.string()).describe("Labels of the findings (E# or N#) this rating rests on."),
      }),
    )
    .describe(`Exactly one entry for each of the five ${name} criteria.`);
}

// The scoring part of a brief, shared by full research and by re-scoring from saved findings.
const SCORE_FIELDS = {
  deal_goal: z
    .enum(DEAL_TYPES)
    .describe(
      "The most promising kind of deal with this company: customer (they buy or pilot the profile's offer), partnership (both contribute: content, sponsorship, event, co-product), referral (they send each other clients) or co_marketing (they promote something together).",
    ),
  deal_goal_reason: z.string().describe("One sentence: why this deal goal, citing what the company does."),
  customer_criteria: ratingsSchema(CUSTOMER_CRITERIA, "customer"),
  partner_criteria: ratingsSchema(PARTNER_CRITERIA, "partner"),
  knockouts: z
    .array(
      z.object({
        rule: z.enum(KNOCKOUT_RULES),
        reason: z.string().describe("One line: what the finding shows."),
        ref: z.string().describe("Label of the finding (E# or N#) that shows it."),
      }),
    )
    .describe("Only the knockout rules listed in the instructions, and only when a finding shows the rule applies. Usually empty."),
  fit_case: z
    .string()
    .describe("One sentence for the chosen goal: the strongest reason for and the strongest reason against. Do not say pursue, hold or skip."),
  suggested_angle: z.string().describe("One sentence: the angle a pitch should take for the chosen goal."),
};

const ScoreSchema = z.object(SCORE_FIELDS);

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
  ...SCORE_FIELDS,
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

function criteriaText(defs: readonly CriterionDef[]) {
  return defs
    .map((c) => {
      const a = c.anchors!;
      return `- ${c.key} (${c.label}): ${c.question}\n  0 = ${a[0]}; 5 = ${a[1]}; 10 = ${a[2]}; 15 = ${a[3]}; 20 = ${a[4]}.`;
    })
    .join("\n");
}

const KNOCKOUT_TEXT: Record<KnockoutRule, (icp: Icp | null) => string> = {
  competitor: (icp) =>
    `competitor: the company sells the same kind of service as the profile to the same buyers${icp?.competitors?.length ? `, or is one of: ${icp.competitors.join("; ")}` : ""}.`,
  exclusive_partner: () => "exclusive_partner: the company has an exclusive partner for what the profile offers.",
  excluded_geography: (icp) =>
    `excluded_geography: the company operates only or mainly in: ${icp?.excluded_geographies?.join("; ") ?? ""}.`,
  below_min_size: (icp) => `below_min_size: the company has fewer than ${icp?.min_employees ?? 0} employees.`,
};

// How to score, shared by the brief and the re-score prompts.
function scoringRules(icp: Icp | null) {
  return `Deal goal: choose the most promising kind of deal with this company for the profile (customer, partnership, referral or co_marketing). A company that would buy the profile's offer is a customer goal even when the ICP talks about partners.

Rate BOTH criteria sets below, whatever goal you choose, so the user can switch goals. Use only the anchored values 0, 5, 10, 15 or 20; pick the anchor that matches the evidence best. If there is no evidence for a criterion, set its rating to null (Unknown) and say what is missing. Never fill a gap with a guess; a null rating is better than an invented one.

Customer criteria (the company buys or pilots the profile's offer):
${criteriaText(CUSTOMER_CRITERIA)}

Partner criteria (partnership, referral or co-marketing):
${criteriaText(PARTNER_CRITERIA)}

Knockout checks: report a rule only when a finding shows it applies; no evidence means it does not apply.
${knockoutRulesFor(icp)
  .map((r) => `- ${KNOCKOUT_TEXT[r](icp)}`)
  .join("\n")}

Do not recommend pursue, hold or skip: Polaris decides that from the ratings. fit_case gives the strongest reason for and against.`;
}

function systemPrompt(icp: Icp | null) {
  return `You write intelligence briefs for Polaris, which helps businesses (often media and creative businesses, sometimes software or service companies) win partnerships, sponsorships, pilots and customers.

Research the company: read its website first, then search the web for recent, specific evidence, and open the pages you rely on rather than trusting search snippets. Then judge how well it fits the profile and its ideal customer profile (ICP).

Evidence rules:
- Existing findings are labelled E1, E2…; new findings you add are labelled N1, N2… in the order you list them.
- Every new finding needs the exact URL of a page you read or a search result you were shown, plus a short verbatim quote. Never construct, guess or shorten a URL.
- Every rating, knockout, timing signal, concept starter and sourced risk must cite finding labels. Do not use outside knowledge about the company.

${scoringRules(icp)}

Target roles are job titles or functions only, never named people.

Write plainly, without marketing superlatives. No URLs or markdown links inside text fields; links go only in source_url.`;
}

function rescoreSystem(icp: Icp | null) {
  return `You score companies for Polaris, which helps businesses win partnerships, sponsorships, pilots and customers. You do not search the web: you judge only from the findings given, each labelled E1, E2…

Every rating and knockout must cite finding labels. Do not use outside knowledge about the company.

${scoringRules(icp)}

Write plainly, without marketing superlatives. No URLs or markdown links inside text fields.`;
}

export type ExistingSignal = { id: string; type: string; summary: string; source_url: string; source_date: string | null };

export async function researchBrief(input: {
  profile: Profile;
  icp: Icp | null;
  company: { name: string; website: string | null };
  existing: ExistingSignal[];
  notes: string | null;
}) {
  const existing = existingText(input.existing);

  return researchProvider().run({
    task: "intelligence-brief",
    system: systemPrompt(input.icp),
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

function existingText(existing: ExistingSignal[]) {
  return existing
    .map(
      (s, i) =>
        `E${i + 1} [${s.type}${s.source_date ? `, ${s.source_date}` : ""}] ${plainText(s.summary)} (${s.source_url})`,
    )
    .join("\n");
}

// Re-scores from saved findings only: no web search, so it costs a fraction of a full brief.
export async function rescoreFromFindings(input: {
  profile: Profile;
  icp: Icp | null;
  company: { name: string; website: string | null };
  existing: ExistingSignal[];
  notes: string | null;
}) {
  return generateStructured({
    task: "intelligence-rescore",
    system: rescoreSystem(input.icp),
    prompt: `Score this company for the profile below, from these findings only.

Company: ${input.company.name}
${input.company.website ? `Website: ${input.company.website}` : ""}

Findings:
${existingText(input.existing) || "(none)"}

The profile we represent:
${profileSummary(input.profile)}

${icpSummary(input.icp)}
${input.notes ? `\nNotes from the user (leads, not facts):\n${input.notes}\n` : ""}`,
    schema: ScoreSchema,
    schemaName: "fit_score",
    effort: "medium",
    maxTokens: 6000,
  });
}

export type BriefOutput = z.infer<typeof BriefSchema>;
export type ScoreOutput = z.infer<typeof ScoreSchema>;
