import "server-only";
import { z } from "zod";
import { generateStructured } from "./generate";

export type IntelligenceSource = {
  id: string;
  label: string; // "S1", "S2", … used in citations
  kind: "url" | "file" | "questionnaire";
  location: string;
  title: string | null;
  text?: string;
  pdfBase64?: string;
};

const IntelligenceSchema = z.object({
  positioning: z.string().describe("One or two sentences: who they are and what makes them distinct. Empty if unsupported."),
  services: z.array(z.string()).describe("Services or offerings, each a short phrase."),
  audience: z.string().describe("Who they reach or serve. Empty if unsupported."),
  strengths: z.array(z.string()).describe("Concrete strengths a partner would care about."),
  objectives: z.array(z.string()).describe("Business or partnership objectives stated or clearly implied."),
  evidence: z
    .array(
      z.object({
        claim: z.string().describe("The statement from the fields above that this evidence supports."),
        source: z.string().describe("The source label, e.g. S1."),
        quote: z.string().describe("A short verbatim excerpt from that source."),
      }),
    )
    .describe("At least one entry for every non-empty field above."),
  gaps: z.array(z.string()).describe("Important things the sources do not establish, phrased as questions for the owner."),
});

export type IntelligenceOutput = z.infer<typeof IntelligenceSchema>;

const SYSTEM = `You build business profiles for Polaris, a tool that finds and pitches partnership opportunities for media and creative businesses.

Work only from the numbered sources you are given, and read every one of them. Do not use outside knowledge about the business, and do not guess.

Rules:
- Every statement you put in positioning, services, audience, strengths or objectives must be backed by an evidence entry citing a source label and a short verbatim quote from that source.
- If the sources do not support a field, leave it empty (empty string or empty list) and add a question to gaps instead.
- If a web page cannot be read, say so in gaps and continue with the other sources.
- Write in plain, specific language a partnerships lead would use. No marketing superlatives.`;

export async function extractProfileIntelligence(input: {
  profileName: string;
  profileType: string;
  sources: IntelligenceSource[];
}) {
  const listing = input.sources
    .map((s) => {
      if (s.kind === "url") return `${s.label} (web page): ${s.location}`;
      if (s.pdfBase64) return `${s.label} (uploaded PDF, attached): ${s.title ?? s.location}`;
      return `${s.label} (${s.kind === "file" ? "uploaded file" : "owner questionnaire"}: ${s.title ?? s.location})\n<source label="${s.label}">\n${s.text ?? ""}\n</source>`;
    })
    .join("\n\n");

  return generateStructured({
    task: "profile-intelligence",
    system: SYSTEM,
    prompt: `Build the profile for "${input.profileName}" (profile type: ${input.profileType}).\n\nSources:\n\n${listing}`,
    schema: IntelligenceSchema,
    schemaName: "profile_intelligence",
    urls: input.sources.filter((s) => s.kind === "url").map((s) => ({ label: s.label, url: s.location })),
    pdfs: input.sources
      .filter((s) => s.pdfBase64)
      .map((s) => ({ label: s.label, title: s.title ?? s.location, base64: s.pdfBase64! })),
    effort: "high",
  });
}
