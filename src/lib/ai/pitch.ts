import "server-only";
import { z } from "zod";
import { DEAL_TYPES, type DealType, type Icp, type Profile } from "@/lib/types";
import { generateStructured } from "./generate";
import { plainText } from "@/lib/rich-text";
import { icpSummary, profileSummary } from "./profile-summary";

// ---------------------------------------------------------------------------
// 1. Company research: the company's own site plus a few web searches, every finding cited.
// ---------------------------------------------------------------------------

export const SIGNAL_TYPES = [
  "launch",
  "campaign",
  "partnership",
  "sponsorship",
  "event",
  "funding",
  "hiring",
  "leadership",
  "expansion",
  "content",
  "audience",
  "other",
] as const;

const ResearchSchema = z.object({
  company: z.object({
    name: z.string().describe("The company's name as it presents itself."),
    industry: z.string().describe("Industry in a few words. Empty if the sources do not say."),
    location: z.string().describe("Headquarters city and state or country. Empty if the sources do not say."),
    summary: z
      .string()
      .describe("Two or three sentences: what the company does and who it serves, from the sources only."),
  }),
  signals: z
    .array(
      z.object({
        type: z.enum(SIGNAL_TYPES),
        summary: z.string().describe("One sentence: what happened and why it matters for a partnership."),
        source_url: z.string().describe("Exact URL of the page you read or the search result this came from."),
        source_date: z
          .string()
          .describe("Publication date as YYYY-MM-DD if the source shows one; empty string if it does not."),
        quote: z.string().describe("A short verbatim excerpt from that source supporting the summary."),
      }),
    )
    .describe("Up to 8 recent, specific findings. Fewer is fine; never pad."),
  gaps: z.array(z.string()).describe("Things worth knowing for a pitch that the sources did not establish."),
});

export type ResearchOutput = z.infer<typeof ResearchSchema>;

const RESEARCH_SYSTEM = `You research companies for Polaris, which helps media and creative businesses win partnerships, sponsorships and commercial collaborations.

Read the company's website first, then use web search to find recent, specific evidence (the last 12 months where possible): product or content launches, marketing campaigns, brand partnerships and sponsorships, events, funding, expansion, marketing or partnerships hires and leadership changes, audience or content strategy.

Rules:
- Every signal needs the exact URL of a page you actually read or a search result you were shown, plus a short verbatim quote from it. Never construct, guess or shorten a URL.
- Leave source_date empty unless the source shows a date.
- Prefer primary sources (the company's own site, press releases) and reputable trade press. Skip directory listings and SEO filler.
- Do not use outside knowledge about the company. If something is unclear, put it in gaps.
- Do not put URLs or markdown links inside summary, gaps or any other text; a signal's link goes only in source_url.
- Wrap every person's full name in double asterisks wherever it appears in summary or gaps text, for example **Jane Doe**, so the app can highlight it. Do not mark company or product names.
- Plain, specific language. No marketing superlatives.`;

export async function researchCompany(input: { url: string; profile: Profile; icp: Icp | null; notes: string | null }) {
  return generateStructured({
    task: "pitch-research",
    system: RESEARCH_SYSTEM,
    prompt: `Research this company as a possible partner for the profile below.

Company website (W1): ${input.url}

The profile we represent (for judging what is relevant; do not research it):
${profileSummary(input.profile)}

${icpSummary(input.icp)}
${input.notes ? `\nNotes from the user about this company:\n${input.notes}\n` : ""}`,
    schema: ResearchSchema,
    schemaName: "company_research",
    urls: [{ label: "W1", url: input.url }],
    webSearch: { maxUses: 5 },
    effort: "high",
  });
}

export { urlKey } from "@/lib/url-key";

// ---------------------------------------------------------------------------
// 2. Partnership concepts built on that research.
// ---------------------------------------------------------------------------

export type LabelledSignal = { label: string; type: string; summary: string; source_url: string; source_date: string | null };

const ConceptsSchema = z.object({
  concepts: z
    .array(
      z.object({
        deal_type: z
          .enum(DEAL_TYPES)
          .describe(
            "The kind of deal: partnership (both contribute: content, sponsorship, event, co-product), customer (the company buys or pilots the profile's product or service), referral (they send each other clients), co_marketing (they promote something together, e.g. a joint case study or feature).",
          ),
        deal_angle: z
          .string()
          .describe("The specific angle in 2–4 words, e.g. 'Discounted pilot', 'Content series', 'Event sponsorship', 'Joint case study'."),
        title: z.string().describe("Short, concrete name for the idea (under 10 words)."),
        description: z
          .string()
          .describe("What is proposed (partnership, pilot, case study or referral arrangement), what each side does, and the format, in 2–4 sentences."),
        commercial_rationale: z
          .string()
          .describe("Why this company would pay for or invest in it now, tied to the cited signals."),
        signal_refs: z.array(z.string()).describe("Labels of the research signals this concept builds on, e.g. R2."),
      }),
    )
    .describe("Two or three distinct concepts."),
});

const CONCEPTS_SYSTEM = `You design pitch concepts for Polaris. A business (the profile) wants to pitch a company. The profile is often a media or creative business, but it can be any business, including a software or service company.

First decide what kind of relationship fits, from the profile's services and the user's notes (the notes take priority when they state a goal):
- Partnership: a branded content series, an event or activation, a sponsorship, a co-produced product.
- Customer: the company buys or pilots the profile's product or service. Concepts are then a paid or discounted pilot, a case study the two publish together, or a specific use of the product on the company's own problem.
- Referral or co-marketing: the two serve overlapping customers and send each other business or market together.
Do not force a media-style partnership onto a profile that sells software or services to the company.

Rules:
- Tag every concept with its deal_type and a short deal_angle. Concepts may use different deal types when more than one fits.
- Propose two or three genuinely different concepts, each one something the profile can actually deliver given its services and strengths.
- Anchor every concept in at least one research signal and cite it by label. Do not invent facts about the company beyond the research. Things the user's notes say about the company are leads, not facts: a concept may build on them, but say they need checking.
- If the research shows a mismatch between the profile's usual customers and this company (for example residential versus commercial), address it head on in the rationale instead of ignoring it.
- Be commercially specific: what the company gets (customers, reputation, content, audience, saved time, launch support, hiring brand) and why now.
- Plain language the company's decision-maker would use. No superlatives, no buzzwords.`;

export async function generateConcepts(input: {
  profile: Profile;
  icp: Icp | null;
  companyName: string;
  companySummary: string | null;
  signals: LabelledSignal[];
  notes: string | null;
}) {
  return generateStructured({
    task: "pitch-concepts",
    system: CONCEPTS_SYSTEM,
    prompt: `Profile (the business we represent):
${profileSummary(input.profile)}

${icpSummary(input.icp)}

Company: ${input.companyName}
${plainText(input.companySummary ?? "")}

Research signals:
${formatSignals(input.signals)}
${input.notes ? `\nNotes from the user:\n${input.notes}\n` : ""}
Write the concepts.`,
    schema: ConceptsSchema,
    schemaName: "partnership_concepts",
    effort: "high",
    maxTokens: 8000,
  });
}

function formatSignals(signals: LabelledSignal[]) {
  if (!signals.length) return "(none found)";
  return signals
    .map((s) => `${s.label} [${s.type}${s.source_date ? `, ${s.source_date}` : ""}] ${plainText(s.summary)} (${s.source_url})`)
    .join("\n");
}

// ---------------------------------------------------------------------------
// 3. First email, subject line and follow-up for the chosen concept.
// ---------------------------------------------------------------------------

const PitchSchema = z.object({
  email: z.object({
    subject: z.string().describe("Under 8 words, specific to the company, no clickbait."),
    body: z.string().describe("The first email, plain text."),
  }),
  follow_up: z.object({
    subject: z.string().describe("Usually 'Re: ' plus the first subject."),
    body: z.string().describe("The follow-up, plain text, sent 3–5 business days later if there is no reply."),
  }),
  signal_refs: z.array(z.string()).describe("Labels of the research signals the emails mention."),
});

export type PitchOutput = z.infer<typeof PitchSchema>;

const PITCH_SYSTEM = `You write cold pitch emails for Polaris on behalf of a business (often a media or creative business; it can also be a software or service company pitching a pilot or a sale). A person reviews, edits and approves every email before anything is sent.

The first email:
- 70 to 130 words. Short paragraphs. Plain text, no bullet lists, no links unless one is given.
- Open with one specific, verifiable observation about the company taken from the research signals. Never invent a fact or flatter. Claims that appear only in the user's notes are not verified: do not state them as fact in the email.
- Say in one or two sentences what the profile proposes (the chosen concept) and why it fits now.
- One proof point about the profile, taken from its profile text only.
- End with one low-friction ask (for example a 15-minute call next week).
- Greeting: "Hi [First name]," exactly, because the contact is not chosen yet. Sign off with "[Your name]" and the profile's name.

The follow-up:
- 40 to 80 words, adds one new angle or detail rather than repeating the first email, same greeting and sign-off.

Voice:
- Match the writing samples if any are given: their sentence length, warmth and vocabulary. Do not copy their content.
- No superlatives, no "I hope this finds you well", no "synergy", no "game-changer", no exclamation marks.`;

export async function writePitch(input: {
  profile: Profile;
  companyName: string;
  companySummary: string | null;
  concept: {
    title: string;
    description: string;
    commercial_rationale: string | null;
    deal_type: DealType | null;
    deal_angle: string | null;
  };
  signals: LabelledSignal[];
  notes: string | null;
}) {
  const samples = input.profile.voice_samples.slice(0, 5);
  return generateStructured({
    task: "pitch-email",
    system: PITCH_SYSTEM,
    prompt: `Profile (the sender):
${profileSummary(input.profile)}

Writing samples from the profile:
${samples.length ? samples.map((s, i) => `<sample ${i + 1}>\n${s}\n</sample>`).join("\n") : "(none; write in a plain, warm, direct voice)"}

Company: ${input.companyName}
${plainText(input.companySummary ?? "")}

Chosen concept: ${input.concept.title}
${input.concept.deal_type ? `Deal type: ${input.concept.deal_type.replace("_", "-")}${input.concept.deal_angle ? ` (${input.concept.deal_angle})` : ""}. Frame the ask to match it.\n` : ""}${input.concept.description}
${input.concept.commercial_rationale ? `Why now: ${input.concept.commercial_rationale}` : ""}

Research signals:
${formatSignals(input.signals)}
${input.notes ? `\nNotes from the user:\n${input.notes}\n` : ""}
Write the email, subject line and follow-up.`,
    schema: PitchSchema,
    schemaName: "pitch_email",
    effort: "high",
    maxTokens: 8000,
  });
}
