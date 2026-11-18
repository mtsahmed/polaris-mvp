"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { startBrief } from "@/lib/intelligence/run";
import { unshortlistBlocker } from "@/lib/discovery/unshortlist";

// Find companies runs through POST /api/ai/discovery, which streams its progress:
// src/lib/ai-jobs/discovery.ts.

// Shortlisting puts the company in the pipeline and starts its intelligence brief in the
// background (spec 7.3). Research runs only here and on a user-triggered refresh.
export async function shortlistSuggestion(prospectId: string, _prev: ActionState): Promise<ActionState> {
  const session = await requireSession();
  const supabase = await createClient();
  const { error } = await supabase
    .from("prospects")
    .update({ status: "saved", shortlisted_at: new Date().toISOString() })
    .eq("id", prospectId)
    .eq("status", "suggested");
  if (error) return fail(error.message);
  // Shortlisted before and moved back: reuse the brief it already has instead of paying for new research.
  const { data: earlier } = await supabase
    .from("briefs")
    .select("id")
    .eq("prospect_id", prospectId)
    .in("status", ["ready", "insufficient_evidence"])
    .limit(1)
    .maybeSingle();
  if (earlier) {
    revalidatePath("/discovery");
    revalidatePath("/intelligence");
    revalidatePath("/pitch");
    return ok("Shortlisted again. Its earlier intelligence brief is back in Intelligence.");
  }
  const started = await startBrief(supabase, session.org.id, prospectId);
  revalidatePath("/discovery");
  revalidatePath("/intelligence");
  revalidatePath("/pitch");
  return started.ok
    ? ok("Shortlisted. Its intelligence brief is being researched; it takes a few minutes.")
    : fail(`Shortlisted, but research could not start: ${started.message}`);
}

export async function dismissSuggestion(prospectId: string) {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.from("prospects").update({ status: "rejected" }).eq("id", prospectId);
  if (error) throw new Error(error.message);
  revalidatePath("/discovery");
}

// Moves a shortlisted company back to Suggestions. Its research is kept; shortlisting it again
// reuses that brief.
export async function unshortlistProspect(prospectId: string) {
  await requireSession();
  const supabase = await createClient();
  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, company_id, decision")
    .eq("id", prospectId)
    .eq("status", "saved")
    .maybeSingle<{ id: string; company_id: string; decision: string }>();
  if (!prospect) throw new Error("That company is not on the shortlist.");
  const blocker = await unshortlistBlocker(supabase, prospect);
  if (blocker) throw new Error(blocker);
  const { error } = await supabase
    .from("prospects")
    .update({ status: "suggested", shortlisted_at: null, stage: "new_lead", decision: "none" })
    .eq("id", prospectId);
  if (error) throw new Error(error.message);
  revalidatePath("/discovery");
  revalidatePath("/intelligence");
  revalidatePath("/pitch");
  revalidatePath("/dashboard");
}
