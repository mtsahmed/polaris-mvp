import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { addUsage, claude, CLAUDE_MODEL, emptyUsage, estimateCostUsd } from "../claude";
import { ProviderFailedError, ProviderUnavailableError, type ProviderAttempt, type StructuredRequest } from "../types";

const MAX_CONTINUATIONS = 4;

// Server-side refusal fallbacks exist only on these models; Haiku 5.5 and Sonnet 5 have none.
const SUPPORTS_FALLBACKS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);
// The newer web fetch tool (dynamic filtering) is not available on Haiku 5.5.
const BASIC_WEB_FETCH = new Set(["claude-haiku-5-5"]);

export function anthropicConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

// Errors that mean "Claude is not usable right now", so another provider may take the job.
function isUnavailable(err: unknown) {
  if (err instanceof Anthropic.AuthenticationError) return true;
  if (err instanceof Anthropic.PermissionDeniedError) return true;
  if (err instanceof Anthropic.RateLimitError) return true;
  if (err instanceof Anthropic.InternalServerError) return true;
  if (err instanceof Anthropic.APIConnectionError) return true; // includes timeouts
  if (err instanceof Anthropic.BadRequestError && /credit balance|billing/i.test(err.message)) return true;
  return false;
}

function describe(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "Claude API key is missing or invalid.";
  if (err instanceof Anthropic.RateLimitError) return "Claude API rate limit reached.";
  if (err instanceof Anthropic.BadRequestError && /credit balance/i.test(err.message)) return "Claude account has no credit.";
  if (err instanceof Anthropic.APIConnectionError) return "Could not reach the Claude API.";
  if (err instanceof Anthropic.APIError) return `Claude API error ${err.status}: ${err.message}`;
  return err instanceof Error ? err.message : "Unknown error calling Claude.";
}

export async function runAnthropic<S extends z.ZodType>(
  req: StructuredRequest<S>,
  requestedModel: string = CLAUDE_MODEL,
): Promise<{ data: z.infer<S>; attempt: ProviderAttempt; seenUrls: string[] }> {
  const usage = emptyUsage();
  const seen = new Set<string>();
  const attempt = (ok: boolean, model = requestedModel, error?: string): ProviderAttempt => ({
    provider: "anthropic",
    model,
    ok,
    inputTokens: usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens,
    outputTokens: usage.outputTokens,
    costUsd: estimateCostUsd(model, usage),
    searches: usage.webSearches,
    error,
  });

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const pdf of req.pdfs ?? []) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: pdf.base64 },
      title: `${pdf.label}: ${pdf.title}`,
    });
  }
  const urlNote = req.urls?.length
    ? `\n\nUse the web_fetch tool to read each of these web page sources:\n${req.urls.map((u) => `${u.label}: ${u.url}`).join("\n")}`
    : "";
  content.push({ type: "text", text: req.prompt + urlNote });

  const basic = BASIC_WEB_FETCH.has(requestedModel);
  const tools: Anthropic.Beta.BetaToolUnion[] = [];
  if (req.urls?.length || req.webSearch) {
    // With web search on, Claude may also open pages it found, so allow a few more fetches.
    const maxUses = Math.min((req.urls?.length ?? 0) + 2 + (req.webSearch ? req.webSearch.maxUses : 0), 12);
    tools.push(
      basic
        ? { type: "web_fetch_20250910", name: "web_fetch", max_uses: maxUses, max_content_tokens: 40000 }
        : { type: "web_fetch_20260209", name: "web_fetch", max_uses: maxUses, max_content_tokens: 40000 },
    );
  }
  if (req.webSearch) {
    const maxUses = req.webSearch.maxUses;
    tools.push(
      basic
        ? { type: "web_search_20250305", name: "web_search", max_uses: maxUses }
        : { type: "web_search_20260209", name: "web_search", max_uses: maxUses },
    );
  }
  const fallbackParams = SUPPORTS_FALLBACKS.has(requestedModel)
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : {};

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content }];

  try {
    for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
      const response = await claude().beta.messages.parse({
        model: requestedModel,
        max_tokens: req.maxTokens ?? 16000,
        system: req.system,
        messages,
        tools: tools.length ? tools : undefined,
        // Opus 5.5 and Haiku 5.5 default to medium effort; set it explicitly per task.
        output_config: { effort: req.effort ?? "high", format: betaZodOutputFormat(req.schema) },
        // On a safety decline the API retries on a fallback Claude model inside the same call
        // (only on models that support it).
        ...fallbackParams,
      });
      addUsage(usage, response.usage);
      collectUrls(response.content, seen);

      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }
      if (response.stop_reason === "refusal") {
        throw new ProviderFailedError("Claude declined this request.", attempt(false, response.model, "refusal"));
      }
      if (response.stop_reason === "max_tokens") {
        throw new ProviderFailedError("Claude ran out of output space.", attempt(false, response.model, "max_tokens"));
      }
      if (!response.parsed_output) {
        throw new ProviderFailedError("Claude's answer did not match the expected format.", attempt(false, response.model, "parse"));
      }
      return {
        data: response.parsed_output as z.infer<S>,
        attempt: attempt(true, response.model),
        seenUrls: [...seen],
      };
    }
    throw new ProviderFailedError("Claude did not finish after several continuations.", attempt(false, requestedModel, "continuations"));
  } catch (err) {
    if (err instanceof ProviderFailedError) throw err;
    const message = describe(err);
    if (isUnavailable(err)) throw new ProviderUnavailableError(message, attempt(false, requestedModel, message));
    throw new ProviderFailedError(message, attempt(false, requestedModel, message));
  }
}

// Records every page Claude fetched and every search result it was shown.
function collectUrls(content: Anthropic.Beta.BetaContentBlock[], seen: Set<string>) {
  for (const block of content) {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const r of block.content) if (r.type === "web_search_result") seen.add(r.url);
    } else if (block.type === "web_fetch_tool_result" && block.content.type === "web_fetch_result") {
      seen.add(block.content.url);
    }
  }
}
