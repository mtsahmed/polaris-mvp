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
  effort?: Effort;
  maxTokens?: number;
};

// One call to one provider, successful or not. Every attempt is written to provider_calls.
export type ProviderAttempt = {
  provider: AiProvider;
  model: string;
  ok: boolean;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null; // null when no price is configured
  error?: string;
};

export type StructuredResult<T> = {
  data: T;
  provider: AiProvider;
  model: string;
  attempts: ProviderAttempt[];
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
