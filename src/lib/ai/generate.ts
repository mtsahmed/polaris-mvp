import "server-only";
import type { z } from "zod";
import { modelDisplayName } from "./models";
import { anthropicConfigured, runAnthropic } from "./providers/anthropic";
import { OpenAIExhaustedError, openaiConfigured, runOpenAI } from "./providers/openai";
import { selectedModel } from "./selection";
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

// Runs one AI job.
// - A model picked in the sidebar runs on its own. If it is unavailable or fails, the job
//   fails with the reason; Polaris does not quietly switch to a model the user did not pick.
// - Auto (the default): Claude first (roadmap decision). OpenAI only takes over when Claude is
//   unavailable: missing or invalid key, no credit, rate limit, outage. A refusal or a bad
//   answer from Claude is reported, not re-sent to another vendor.
export async function generateStructured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<StructuredResult<z.infer<S>>> {
  const choice = await selectedModel();
  if (choice) return runChosen(req, choice.provider, choice.model.id);
  return runAuto(req);
}

async function runChosen<S extends z.ZodType>(
  req: StructuredRequest<S>,
  provider: "anthropic" | "openai",
  model: string,
): Promise<StructuredResult<z.infer<S>>> {
  const attempts: ProviderAttempt[] = [];
  const name = modelDisplayName(model);
  const hint = " Pick another model in the sidebar, or Auto.";

  if (provider === "anthropic") {
    if (!anthropicConfigured()) throw new AiError(`${name} needs ANTHROPIC_API_KEY in .env.local.${hint}`, attempts);
    try {
      const { data, attempt, seenUrls } = await runAnthropic(req, model);
      attempts.push(attempt);
      return { data, provider: "anthropic", model: attempt.model, attempts, seenUrls };
    } catch (err) {
      if (err instanceof ProviderUnavailableError || err instanceof ProviderFailedError) attempts.push(err.attempt);
      const message = err instanceof Error ? err.message : "Claude failed.";
      throw new AiError(`${name}: ${message}${hint}`, attempts);
    }
  }

  if (!openaiConfigured()) throw new AiError(`${name} needs OPENAI_API_KEY in .env.local.${hint}`, attempts);
  try {
    const result = await runOpenAI(req, [model]);
    attempts.push(...result.attempts);
    return { data: result.data, provider: "openai", model, attempts, seenUrls: result.seenUrls };
  } catch (err) {
    if (err instanceof OpenAIExhaustedError) attempts.push(...err.attempts);
    const message = err instanceof Error ? err.message : "OpenAI failed.";
    throw new AiError(`${name}: ${message}${hint}`, attempts);
  }
}

async function runAuto<S extends z.ZodType>(req: StructuredRequest<S>): Promise<StructuredResult<z.infer<S>>> {
  const attempts: ProviderAttempt[] = [];

  if (anthropicConfigured()) {
    try {
      const { data, attempt, seenUrls } = await runAnthropic(req);
      attempts.push(attempt);
      return { data, provider: "anthropic", model: attempt.model, attempts, seenUrls };
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
      return { data: result.data, provider: "openai", model: result.attempts.at(-1)!.model, attempts, seenUrls: result.seenUrls };
    } catch (err) {
      if (err instanceof OpenAIExhaustedError) attempts.push(...err.attempts);
      const claudeNote = attempts.find((a) => a.provider === "anthropic")?.error;
      const message = err instanceof Error ? err.message : "OpenAI failed.";
      throw new AiError(claudeNote ? `Claude: ${claudeNote} OpenAI fallback: ${message}` : message, attempts);
    }
  }

  throw new AiError("No AI provider is configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env.local.", attempts);
}
