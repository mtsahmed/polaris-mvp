import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anyProviderConfigured } from "@/lib/ai/generate";
import { handleAiError, logAttempts } from "@/lib/ai/log-attempts";
import { findContactsOnWeb } from "../web-finder";
import type { SourceContext, SourceResult } from "./types";

// Web-search step: published work emails, office lines, mobiles and WhatsApp numbers, each kept
// only if Polaris finds it on the downloaded source page. The AI cost is logged in Usage & cost.
export async function findWithWeb(supabase: SupabaseClient, ctx: SourceContext): Promise<SourceResult> {
  if (!anyProviderConfigured()) return { outcome: "skipped", contacts: [], note: "no AI provider configured" };
  try {
    const found = await findContactsOnWeb({ companyName: ctx.companyName, website: ctx.website, location: ctx.location, roles: ctx.roles });
    await logAttempts(supabase, ctx.orgId, "contacts-web", found.attempts);
    return {
      outcome: found.kept.length ? "found" : "none",
      contacts: found.kept,
      dropped: found.dropped,
      unconfirmed: found.unconfirmed,
      checks: found.checks,
      note: found.notes || undefined,
    };
  } catch (err) {
    return { outcome: "failed", contacts: [], note: await handleAiError(supabase, ctx.orgId, "contacts-web", err) };
  }
}
