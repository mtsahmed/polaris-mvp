import "server-only";
import type { z } from "zod";
import { generateStructured } from "@/lib/ai/generate";
import type { StructuredRequest, StructuredResult } from "@/lib/ai/types";

// ResearchProvider adapter (roadmap section 4). Research jobs ask for cited, structured output
// and get back the data plus every URL the provider really read or was shown, so callers can
// drop any citation that was not seen. Today the one implementation is AI web search through
// generateStructured(): Claude web search + web fetch, or OpenAI web search, following the model
// picked in the sidebar. Apollo news and job postings can be added behind the same interface.

export type ResearchRequest<S extends z.ZodType> = Omit<StructuredRequest<S>, "webSearch"> & { maxSearches: number };

export interface ResearchProvider {
  readonly name: string;
  run<S extends z.ZodType>(req: ResearchRequest<S>): Promise<StructuredResult<z.infer<S>>>;
}

const aiWebSearch: ResearchProvider = {
  name: "AI web search",
  run(req) {
    const { maxSearches, ...rest } = req;
    return generateStructured({ ...rest, webSearch: { maxUses: maxSearches } });
  },
};

export function researchProvider(): ResearchProvider {
  return aiWebSearch;
}
