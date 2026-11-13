import "server-only";
import type { z } from "zod";
import { anthropicConfigured, runAnthropic } from "./providers/anthropic";
import { OpenAIExhaustedError, openaiConfigured, runOpenAI } from "./providers/openai";
import {
  AiError,
  ProviderFailedError,
  ProviderUnavailableError,
  type ProviderAttempt,
  type StructuredRequest,
  type StructuredResult,
} from "./types";

export function anyProviderConfigured() {
  return anthropicConfigured() || openaiConfigured();
}

// Claude first (roadmap decision). OpenAI only takes over when Claude is unavailable:
// missing or invalid key, no credit, rate limit, outage. A refusal or a bad answer from
// Claude is reported, not re-sent to another vendor.
export async function generateStructured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<StructuredResult<z.infer<S>>> {
  const attempts: ProviderAttempt[] = [];

  if (anthropicConfigured()) {
    try {
      const { data, attempt } = await runAnthropic(req);
      attempts.push(attempt);
      return { data, provider: "anthropic", model: attempt.model, attempts };
    } catch (err) {
      if (err instanceof ProviderUnavailableError || err instanceof ProviderFailedError) attempts.push(err.attempt);
      if (!(err instanceof ProviderUnavailableError)) {
        throw new AiError(err instanceof Error ? err.message : "Claude failed.", attempts);
      }
      if (!openaiConfigured()) throw new AiError(`${err.message} No fallback provider is configured.`, attempts);
    }
  }

  if (openaiConfigured()) {
    try {
      const result = await runOpenAI(req);
      attempts.push(...result.attempts);
      return { data: result.data, provider: "openai", model: result.attempts.at(-1)!.model, attempts };
    } catch (err) {
      if (err instanceof OpenAIExhaustedError) attempts.push(...err.attempts);
      const claudeNote = attempts.find((a) => a.provider === "anthropic")?.error;
      const message = err instanceof Error ? err.message : "OpenAI failed.";
      throw new AiError(claudeNote ? `Claude: ${claudeNote} OpenAI fallback: ${message}` : message, attempts);
    }
  }

  throw new AiError("No AI provider is configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env.local.", attempts);
}
