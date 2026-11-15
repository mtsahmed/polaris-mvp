import "server-only";
import { z } from "zod";
import type { Profile } from "@/lib/types";
import { generateStructured } from "./generate";
import { profileSummary } from "./profile-summary";

const IcpSchema = z.object({
  industries: z.array(z.string()).describe("Industries or verticals of companies to approach."),
  company_traits: z.array(z.string()).describe("Size, stage, budget signals or behaviours that make a company a fit."),
  geographies: z.array(z.string()).describe("Markets to target. The first segment is the US market."),
  titles: z.array(z.string()).describe("Decision-maker job titles to contact."),
  problems_addressed: z.array(z.string()).describe("Problems this profile solves for those companies."),
  notes: z.string().describe("Two or three sentences explaining the reasoning, including assumptions the owner should check."),
});

export type IcpDraft = z.infer<typeof IcpSchema>;

const SYSTEM = `You draft an ideal customer profile (ICP) for Polaris: the kinds of companies a business should approach for creative partnerships, sponsorships or commercial collaborations, and who to contact there.

Base the ICP only on the profile you are given. Be specific enough that a researcher could search for matching companies. Where the profile is thin, keep the ICP narrow and name the assumption in notes rather than inventing detail. The owner edits and approves this draft before it is used.`;

export async function draftIcp(profile: Profile) {
  const summary = profileSummary(profile);

  return generateStructured({
    task: "icp-draft",
    system: SYSTEM,
    prompt: `Profile:\n${summary}\n\nDraft the ICP. Target market: United States.`,
    schema: IcpSchema,
    schemaName: "icp_draft",
    effort: "medium",
    maxTokens: 8000,
  });
}
