import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Why a shortlisted company cannot go back to Suggestions, or null if it can. Once it is marked
// Pursue, has contacts or has a sent email, moving it back would hide that outreach history.
export async function unshortlistBlocker(
  supabase: SupabaseClient,
  prospect: { id: string; company_id: string; decision: string },
): Promise<string | null> {
  if (prospect.decision === "pursue") return "Marked Pursue in Intelligence, so it stays shortlisted.";
  const [{ count: contacts }, { count: sent }] = await Promise.all([
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("company_id", prospect.company_id),
    supabase.from("pitches").select("id", { count: "exact", head: true }).eq("prospect_id", prospect.id).eq("status", "sent"),
  ]);
  if (sent) return "An email has been sent to this company, so it stays shortlisted.";
  if (contacts) return "It has saved contacts, so it stays shortlisted.";
  return null;
}
