import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import type { z } from "zod";
import { fetchPage } from "../fetch-page";
import { ProviderFailedError, ProviderUnavailableError, type ProviderAttempt, type StructuredRequest } from "../types";

// OpenAI is the fallback provider. Models are tried in this order; a model is skipped
// only when it is unavailable (key, quota, rate limit, outage, model not enabled).
// Override the order with OPENAI_MODELS in .env.local, e.g. "gpt-6.1-sol,gpt-5.5".
const DEFAULT_MODELS = ["gpt-6.1-sol", "gpt-5.5"];

// List prices in USD per million tokens, supplied by the owner from openai.com/api/pricing
// on 13 November 2026. cacheWrite is the 30-minute cache-write price where one exists.
const PRICING: Record<string, { input: number; cachedInput: number; output: number; cacheWrite?: number }> = {
  "gpt-6.1-sol": { input: 2.0, cachedInput: 0.1, output: 10.0, cacheWrite: 2.5 },
  "gpt-5.5": { input: 5.0, cachedInput: 0.5, output: 30.0 },
};

export function openaiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function openaiModels(): string[] {
  const fromEnv = (process.env.OPENAI_MODELS ?? process.env.OPENAI_MODEL ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_MODELS;
}

function costUsd(model: string, u: { input: number; cached: number; cacheWrite: number; output: number }): number | null {
  const p = PRICING[model];
  if (!p) return null; // unknown model: logged without a cost rather than with a guessed one
  const uncached = Math.max(0, u.input - u.cached - u.cacheWrite);
  return (uncached * p.input + u.cached * p.cachedInput + u.cacheWrite * (p.cacheWrite ?? p.input) + u.output * p.output) / 1_000_000;
}

let client: OpenAI | null = null;
function openai() {
  client ??= new OpenAI();
  return client;
}

// Unavailable = this model cannot be used right now; the next model or nothing takes over.
function isUnavailable(err: unknown) {
  return (
    err instanceof OpenAI.AuthenticationError ||
    err instanceof OpenAI.PermissionDeniedError ||
    err instanceof OpenAI.NotFoundError || // model not enabled for this key
    err instanceof OpenAI.RateLimitError || // includes "insufficient_quota"
    err instanceof OpenAI.InternalServerError ||
    err instanceof OpenAI.APIConnectionError
  );
}

function describe(err: unknown, model: string): string {
  if (err instanceof OpenAI.AuthenticationError) return "OpenAI API key is missing, invalid or expired.";
  if (err instanceof OpenAI.RateLimitError) return /quota/i.test(err.message) ? "OpenAI account has no remaining quota." : "OpenAI rate limit reached.";
  if (err instanceof OpenAI.NotFoundError) return `OpenAI model "${model}" is not available to this key.`;
  if (err instanceof OpenAI.APIConnectionError) return "Could not reach the OpenAI API.";
  if (err instanceof OpenAI.APIError) return `OpenAI API error ${err.status}: ${err.message}`;
  return err instanceof Error ? err.message : "Unknown error calling OpenAI.";
}

async function buildContent<S extends z.ZodType>(req: StructuredRequest<S>): Promise<ResponseInputContent[]> {
  // OpenAI has no "read this URL" tool, so Polaris downloads each source page itself.
  const fetchNotes: string[] = [];
  const content: ResponseInputContent[] = [];
  const pageBlocks: string[] = [];
  for (const u of req.urls ?? []) {
    const page = await fetchPage(u.url);
    if (!page.ok) {
      fetchNotes.push(`${u.label} (${u.url}) could not be read: ${page.error}`);
    } else if (page.isPdf) {
      content.push({ type: "input_file", filename: `${u.label}.pdf`, file_data: `data:application/pdf;base64,${page.base64}` });
      pageBlocks.push(`${u.label} (web PDF, attached): ${u.url}`);
    } else {
      pageBlocks.push(`<source label="${u.label}" url="${page.url}" title="${page.title ?? ""}">\n${page.text}\n</source>`);
    }
  }
  for (const pdf of req.pdfs ?? []) {
    content.push({ type: "input_file", filename: `${pdf.label} - ${pdf.title}`.slice(0, 120), file_data: `data:application/pdf;base64,${pdf.base64}` });
  }
  const pageSection = pageBlocks.length ? `\n\nWeb page sources (already downloaded for you):\n\n${pageBlocks.join("\n\n")}` : "";
  const failSection = fetchNotes.length ? `\n\nThese sources could not be downloaded; list them in gaps:\n${fetchNotes.join("\n")}` : "";
  content.push({ type: "input_text", text: req.prompt + pageSection + failSection });
  return content;
}

async function runOneModel<S extends z.ZodType>(
  model: string,
  req: StructuredRequest<S>,
  content: ResponseInputContent[],
): Promise<{ data: z.infer<S>; attempt: ProviderAttempt }> {
  const u = { input: 0, cached: 0, cacheWrite: 0, output: 0 };
  const attempt = (ok: boolean, error?: string): ProviderAttempt => ({
    provider: "openai",
    model,
    ok,
    inputTokens: u.input,
    outputTokens: u.output,
    costUsd: costUsd(model, u),
    error,
  });

  try {
    const response = await openai().responses.parse({
      model,
      instructions: req.system,
      input: [{ role: "user", content }],
      text: { format: zodTextFormat(req.schema, req.schemaName) },
      reasoning: { effort: req.effort === "max" ? "high" : (req.effort ?? "high") },
      max_output_tokens: req.maxTokens ?? 16000,
    });
    u.input = response.usage?.input_tokens ?? 0;
    u.cached = response.usage?.input_tokens_details?.cached_tokens ?? 0;
    u.cacheWrite = response.usage?.input_tokens_details?.cache_write_tokens ?? 0;
    u.output = response.usage?.output_tokens ?? 0;

    if (response.status === "incomplete") {
      throw new ProviderFailedError(`OpenAI stopped early (${response.incomplete_details?.reason ?? "incomplete"}).`, attempt(false, "incomplete"));
    }
    if (!response.output_parsed) {
      throw new ProviderFailedError("OpenAI's answer did not match the expected format (or it declined).", attempt(false, "parse"));
    }
    return { data: response.output_parsed as z.infer<S>, attempt: attempt(true) };
  } catch (err) {
    if (err instanceof ProviderFailedError) throw err;
    const message = describe(err, model);
    if (isUnavailable(err)) throw new ProviderUnavailableError(message, attempt(false, message));
    throw new ProviderFailedError(message, attempt(false, message));
  }
}

export class OpenAIExhaustedError extends Error {
  constructor(
    message: string,
    public attempts: ProviderAttempt[],
  ) {
    super(message);
  }
}

// Tries each configured model in order. Returns every attempt so all of them are logged.
export async function runOpenAI<S extends z.ZodType>(
  req: StructuredRequest<S>,
): Promise<{ data: z.infer<S>; attempts: ProviderAttempt[] }> {
  const content = await buildContent(req);
  const attempts: ProviderAttempt[] = [];
  for (const model of openaiModels()) {
    try {
      const { data, attempt } = await runOneModel(model, req, content);
      attempts.push(attempt);
      return { data, attempts };
    } catch (err) {
      if (err instanceof ProviderUnavailableError) {
        attempts.push(err.attempt);
        continue; // try the next model
      }
      if (err instanceof ProviderFailedError) {
        attempts.push(err.attempt);
        throw new OpenAIExhaustedError(err.message, attempts);
      }
      throw err;
    }
  }
  throw new OpenAIExhaustedError(attempts.at(-1)?.error ?? "No OpenAI model was available.", attempts);
}
