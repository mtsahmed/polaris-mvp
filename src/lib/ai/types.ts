import type { z } from "zod";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export type AiProvider = "anthropic" | "openai";

// Provider-neutral description of one "must answer in this JSON shape" job.
export type StructuredRequest<S extends z.ZodType> = {
  task: string; // short name for the usage log, e.g. "profile-intelligence"
  system: string;
  prompt: string;
  schema: S;
  schemaName: string; // OpenAI requires a name for the JSON schema
  urls?: { label: string; url: string }[]; // web pages the model must read
  pdfs?: { label: string; title: string; base64: string }[];
  // Let the model search the web (Claude web search / OpenAI web search), at most maxUses times.
  webSearch?: { maxUses: number };
  effort?: Effort;
  maxTokens?: number;
  // Stops the call when it fires (for example AbortSignal.timeout), so a job ends with a clear
  // message before the hosting time limit (300 s on Vercel) cuts it off silently.
  signal?: AbortSignal;
};

export const TIME_LIMIT_MESSAGE =
  "This took longer than the time limit allows, so Polaris stopped it. Try again, or ask for fewer results.";

// One call to one provider, successful or not. Every attempt is written to provider_calls.
export type ProviderAttempt = {
  provider: AiProvider;
  model: string;
  ok: boolean;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null; // null when no price is configured
  searches?: number; // web searches run during this attempt
  error?: string;
};

export type StructuredResult<T> = {
  data: T;
  provider: AiProvider;
  model: string;
  attempts: ProviderAttempt[];
  // Every web address the model actually read or got back from a search. Used to drop any
  // cited link the model did not really see.
  seenUrls: string[];
};

export class AiError extends Error {
  constructor(
    message: string,
    public attempts: ProviderAttempt[],
  ) {
    super(message);
  }
}

// Failure that the router may hand to the next provider (key, billing, rate limit, outage).
export class ProviderUnavailableError extends Error {
  constructor(
    message: string,
    public attempt: ProviderAttempt,
  ) {
    super(message);
  }
}

// Failure that must not be retried elsewhere (refusal, bad output, invalid request).
export class ProviderFailedError extends Error {
  constructor(
    message: string,
    public attempt: ProviderAttempt,
  ) {
    super(message);
  }
}
