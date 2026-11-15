import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logProviderCall } from "@/lib/providers/usage-log";
import { AiError, type ProviderAttempt } from "./types";

// Every provider attempt, including a failed Claude call before an OpenAI fallback, is logged.
export async function logAttempts(supabase: SupabaseClient, orgId: string, task: string, attempts: ProviderAttempt[]) {
  for (const a of attempts) {
    await logProviderCall(supabase, {
      orgId,
      provider: a.provider,
      endpoint: `${a.model}:${task}`,
      inputTokens: a.inputTokens,
      outputTokens: a.outputTokens,
      searches: a.searches,
      costEstimateUsd: a.costUsd ?? undefined,
      ok: a.ok,
      error: a.error,
    });
  }
}

// Logs the attempts behind a failed AI job and returns a message for the user.
export async function handleAiError(supabase: SupabaseClient, orgId: string, task: string, err: unknown): Promise<string> {
  if (err instanceof AiError) {
    await logAttempts(supabase, orgId, task, err.attempts);
    return err.message;
  }
  console.error(`[${task}]`, err);
  return err instanceof Error ? err.message : "The AI request failed.";
}
