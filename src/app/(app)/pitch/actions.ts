"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, ok, text, type ActionState } from "@/lib/action-state";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { DEAL_TYPES, type DealType } from "@/lib/types";

// The AI steps (research, concepts, email) run through POST /api/ai/[task], which streams their
// progress: src/lib/ai-jobs/pitch.ts.

function pitchPath(prospectId: string) {
  return `/pitch/${prospectId}`;
}

export async function saveNotes(prospectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.from("prospects").update({ notes: text(formData.get("notes")) }).eq("id", prospectId);
  if (error) return fail(error.message);
  revalidatePath(pitchPath(prospectId));
  return ok("Notes saved.");
}

export async function deletePitchWorkspace(prospectId: string) {
  await requireSession();
  const supabase = await createClient();
  // Concepts and pitches go with the prospect; the company and its research stay for other profiles.
  const { error } = await supabase.from("prospects").delete().eq("id", prospectId);
  if (error) throw new Error(error.message);
  revalidatePath("/pitch");
  redirect("/pitch");
}

// Concepts

export async function saveConcept(
  prospectId: string,
  conceptId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();
  const title = text(formData.get("title"));
  const description = text(formData.get("description"));
  if (!title || !description) return fail("A concept needs a title and a description.");
  const rawType = text(formData.get("deal_type"));
  const deal_type = (DEAL_TYPES as readonly string[]).includes(rawType ?? "") ? (rawType as DealType) : null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("concepts")
    .update({
      title,
      description,
      commercial_rationale: text(formData.get("commercial_rationale")),
      deal_type,
      deal_angle: text(formData.get("deal_angle")),
    })
    .eq("id", conceptId)
    .eq("prospect_id", prospectId);
  if (error) return fail(error.message);
  revalidatePath(pitchPath(prospectId));
  return ok("Concept saved.");
}

export async function chooseConcept(prospectId: string, conceptId: string) {
  await requireSession();
  const supabase = await createClient();
  await supabase.from("concepts").update({ selected: false }).eq("prospect_id", prospectId);
  const { error } = await supabase.from("concepts").update({ selected: true }).eq("id", conceptId).eq("prospect_id", prospectId);
  if (error) throw new Error(error.message);
  revalidatePath(pitchPath(prospectId));
}

// Pitch: email and follow-up (drafts until a person approves them)

export async function savePitch(
  prospectId: string,
  pitchId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();
  const body = text(formData.get("body"));
  if (!body) return fail("The email body cannot be empty.");
  const supabase = await createClient();
  // Editing an approved pitch sends it back to draft (database trigger), so approval always
  // covers the exact text.
  const { error } = await supabase
    .from("pitches")
    .update({ subject: text(formData.get("subject")), body })
    .eq("id", pitchId)
    .eq("prospect_id", prospectId)
    .in("status", ["draft", "approved"]);
  if (error) return fail(error.message);
  revalidatePath(pitchPath(prospectId));
  return ok("Saved as draft.");
}

export async function approvePitch(prospectId: string, pitchId: string) {
  await requireSession();
  const supabase = await createClient();
  // The database stamps the approver as the signed-in user and the time.
  // Approving does not move the pipeline stage: "Ready to pitch" needs a pursue decision and a
  // contact (journey spec 7.6).
  const { error } = await supabase
    .from("pitches")
    .update({ status: "approved" })
    .eq("id", pitchId)
    .eq("prospect_id", prospectId)
    .eq("status", "draft");
  if (error) throw new Error(error.message);
  revalidatePath(pitchPath(prospectId));
  revalidatePath("/pitch");
}
