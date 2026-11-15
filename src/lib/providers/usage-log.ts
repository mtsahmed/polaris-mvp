import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProviderCall = {
  orgId: string;
  provider: "anthropic" | "openai" | "apollo" | "instantly";
  endpoint: string;
  credits?: number; // provider credits, or web searches for AI research calls
  inputTokens?: number;
  outputTokens?: number;
  searches?: number;
  costEstimateUsd?: number;
  ok: boolean;
  error?: string;
};

// Every provider call is logged with its cost (roadmap rule 8.4). A logging failure
// must not hide the real result, so it is reported to the server log instead of thrown.
export async function logProviderCall(supabase: SupabaseClient, call: ProviderCall) {
  const { error } = await supabase.from("provider_calls").insert({
    org_id: call.orgId,
    provider: call.provider,
    endpoint: call.endpoint,
    credits: call.credits ?? null,
    input_tokens: call.inputTokens ?? null,
    output_tokens: call.outputTokens ?? null,
    ...(call.searches ? { searches: call.searches } : {}),
    cost_estimate_usd: call.costEstimateUsd ?? null,
    ok: call.ok,
    error: call.error ?? null,
  });
  if (error) console.error("[usage-log] failed to record provider call", error.message, call);
}
