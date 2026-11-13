import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODEL = "claude-opus-5-5";

// List prices (USD per million tokens) for cost estimates in the usage log.
// Check https://platform.claude.com/docs/en/about-claude/pricing when they change.
const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
};
const WEB_SEARCH_USD_PER_REQUEST = 10 / 1000; // web fetch has no per-use fee, only tokens

let client: Anthropic | null = null;

// Credentials resolve from ANTHROPIC_API_KEY (or another SDK-supported source).
export function claude() {
  client ??= new Anthropic();
  return client;
}

export type UsageTotals = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  webSearches: number;
  webFetches: number;
};

export function emptyUsage(): UsageTotals {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 0, webFetches: 0 };
}

type UsageLike = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null; web_fetch_requests?: number | null } | null;
};

export function addUsage(totals: UsageTotals, usage: UsageLike) {
  totals.inputTokens += usage.input_tokens ?? 0;
  totals.outputTokens += usage.output_tokens ?? 0;
  totals.cacheReadTokens += usage.cache_read_input_tokens ?? 0;
  totals.cacheWriteTokens += usage.cache_creation_input_tokens ?? 0;
  totals.webSearches += usage.server_tool_use?.web_search_requests ?? 0;
  totals.webFetches += usage.server_tool_use?.web_fetch_requests ?? 0;
}

export function estimateCostUsd(model: string, u: UsageTotals) {
  const p = PRICING[model] ?? PRICING[CLAUDE_MODEL];
  return (
    (u.inputTokens * p.input +
      u.outputTokens * p.output +
      u.cacheReadTokens * p.cacheRead +
      u.cacheWriteTokens * p.cacheWrite) /
      1_000_000 +
    u.webSearches * WEB_SEARCH_USD_PER_REQUEST
  );
}
