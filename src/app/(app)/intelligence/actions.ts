"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, ok, text, type ActionState } from "@/lib/action-state";
import { startContactJob } from "@/lib/contacts/jobs";
import { startBrief } from "@/lib/intelligence/run";
import type { Brief } from "@/lib/intelligence/types";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Prospect, ProspectDecision } from "@/lib/types";

function revalidate(prospectId: string) {
  revalidatePath("/intelligence");
  revalidatePath(`/intelligence/${prospectId}`);
}

// Research, refresh or retry: always started by the user, never on page load.
export async function researchProspect(prospectId: string, _prev: ActionState): Promise<ActionState> {
  const session = await requireSession();
  const supabase = await createClient();
  const started = await startBrief(supabase, session.org.id, prospectId);
  revalidate(prospectId);
  return started.ok ? ok("Research started. The brief appears here in a few minutes.") : fail(started.message);
}

const DECISIONS: ProspectDecision[] = ["pursue", "hold", "skip"];

// The user's decision, stored apart from Polaris's recommendation. The database stamps who
// decided and when. A reason is kept only when the user overrules the recommendation.
export async function decide(prospectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const decision = String(formData.get("decision") ?? "") as ProspectDecision;
  if (!DECISIONS.includes(decision)) return fail("Choose pursue, hold or skip.");
  const supabase = await createClient();

  const [{ data: prospect }, { data: brief }] = await Promise.all([
    supabase
      .from("prospects")
      .select("company_id, stage, decision")
      .eq("id", prospectId)
      .maybeSingle<Pick<Prospect, "company_id" | "stage" | "decision">>(),
    supabase
      .from("briefs")
      .select("recommendation")
      .eq("prospect_id", prospectId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle<Pick<Brief, "recommendation">>(),
  ]);
  if (!prospect) return fail("Company not found.");
  const overrides = Boolean(brief?.recommendation && brief.recommendation !== decision);

  // Pursue moves the prospect to "Ready to pitch" only once it also has a contact with an email
  // (spec 7.6); until then it stays "Researching".
  let stage = prospect.stage;
  if (decision === "pursue" && (stage === "new_lead" || stage === "researching")) {
    const { count } = await supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("company_id", prospect.company_id)
      .not("email", "is", null);
    stage = count ? "ready_to_pitch" : "researching";
  }

  const { error } = await supabase
    .from("prospects")
    .update({ decision, decision_reason: overrides ? text(formData.get("reason")) : null, stage })
    .eq("id", prospectId);
  if (error) return fail(error.message);

  // Changing to pursue starts contact finding in the background, unless the company already has
  // contacts or a search is running (startContactJob checks that).
  let finding = false;
  if (decision === "pursue" && prospect.decision !== "pursue") {
    const { count } = await supabase.from("contacts").select("id", { count: "exact", head: true }).eq("company_id", prospect.company_id);
    if (!count) finding = (await startContactJob(supabase, session.org.id, prospectId, "pursue")).ok;
  }
  revalidate(prospectId);
  revalidatePath("/pitch");
  revalidatePath("/contacts");
  return ok(finding ? "Marked pursue. Polaris is finding contacts on the Contacts page." : `Marked ${decision}.`);
}

// Hands the brief's concept starters to the pitch studio as editable concepts.
export async function pitchFromBrief(prospectId: string) {
  await requireSession();
  const supabase = await createClient();
  const [{ data: prospect }, { data: brief }, { data: concepts }] = await Promise.all([
    supabase.from("prospects").select("org_id").eq("id", prospectId).maybeSingle<{ org_id: string }>(),
    supabase
      .from("briefs")
      .select("concept_starters, model")
      .eq("prospect_id", prospectId)
      .in("status", ["ready", "insufficient_evidence"])
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle<Pick<Brief, "concept_starters" | "model">>(),
    supabase.from("concepts").select("title").eq("prospect_id", prospectId).returns<{ title: string }[]>(),
  ]);
  if (!prospect) throw new Error("Company not found.");
  const have = new Set((concepts ?? []).map((c) => c.title.trim().toLowerCase()));
  const starters = (brief?.concept_starters ?? []).filter((c) => !have.has(c.title.trim().toLowerCase()));
  if (starters.length) {
    const { error } = await supabase.from("concepts").insert(
      starters.map((c) => ({
        org_id: prospect.org_id,
        prospect_id: prospectId,
        title: c.title,
        description: c.description,
        signal_ids: c.signal_ids,
        model: brief?.model ?? null,
      })),
    );
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/pitch/${prospectId}`);
  redirect(`/pitch/${prospectId}`);
}
