"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, ok, text, type ActionState } from "@/lib/action-state";
import { addBusinessDays, FOLLOW_UP_BUSINESS_DAYS, stageAfter, STAGE_ORDER } from "@/lib/outreach/rules";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Contact, OutreachEventType, Pitch, PipelineStage, Prospect } from "@/lib/types";

function revalidate(prospectId?: string) {
  revalidatePath("/outreach");
  revalidatePath("/dashboard");
  revalidatePath("/contacts");
  if (prospectId) revalidatePath(`/pitch/${prospectId}`);
}

async function moveStage(supabase: SupabaseClient, prospectId: string, event: OutreachEventType) {
  const { data } = await supabase.from("prospects").select("stage").eq("id", prospectId).maybeSingle<Pick<Prospect, "stage">>();
  if (!data) return;
  const next = stageAfter(data.stage, event);
  if (next !== data.stage) await supabase.from("prospects").update({ stage: next }).eq("id", prospectId);
}

// The user sends the approved email from their own mail app, then records it here. The database
// refuses unless the pitch is approved, and stamps who marked it sent and when.
export async function markSent(prospectId: string, pitchId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const contactId = text(formData.get("contact_id"));
  if (!contactId) return fail("Choose who you sent it to.");
  const supabase = await createClient();

  const [{ data: pitch }, { data: contact }] = await Promise.all([
    supabase.from("pitches").select("*").eq("id", pitchId).eq("prospect_id", prospectId).maybeSingle<Pitch>(),
    supabase.from("contacts").select("id, name, email").eq("id", contactId).maybeSingle<Pick<Contact, "id" | "name" | "email">>(),
  ]);
  if (!pitch) return fail("Email not found.");
  if (pitch.status !== "approved") return fail("Only an approved email can be marked as sent. Approve it in the pitch studio first.");
  if (!contact?.email) return fail("This contact has no email address.");

  const { error } = await supabase.from("pitches").update({ status: "sent", contact_id: contact.id }).eq("id", pitch.id);
  if (error) return fail(error.message);

  await supabase.from("outreach_events").insert({
    org_id: session.org.id,
    prospect_id: prospectId,
    pitch_id: pitch.id,
    contact_id: contact.id,
    channel: "email",
    type: "sent",
    outcome: pitch.kind === "follow_up" ? "follow-up" : "first email",
  });

  if (pitch.kind === "first_contact") {
    // Follow-up reminder, linked to the follow-up draft when there is one.
    const { data: followUp } = await supabase
      .from("pitches")
      .select("id")
      .eq("prospect_id", prospectId)
      .eq("kind", "follow_up")
      .in("status", ["draft", "approved"])
      .limit(1)
      .maybeSingle<{ id: string }>();
    await supabase.from("tasks").insert({
      org_id: session.org.id,
      prospect_id: prospectId,
      pitch_id: followUp?.id ?? null,
      title: `Send the follow-up to ${contact.name} if there is no reply`,
      due_date: addBusinessDays(new Date(), FOLLOW_UP_BUSINESS_DAYS).toISOString().slice(0, 10),
    });
  } else {
    await supabase
      .from("tasks")
      .update({ done: true, done_at: new Date().toISOString() })
      .eq("prospect_id", prospectId)
      .eq("done", false)
      .eq("pitch_id", pitch.id);
  }
  await moveStage(supabase, prospectId, "sent");
  revalidate(prospectId);
  return ok(`Marked as sent to ${contact.name}.`);
}

const LOGGABLE: { type: OutreachEventType; channel: "email" | "call" | "whatsapp" }[] = [
  { type: "reply", channel: "email" },
  { type: "call", channel: "call" },
  { type: "message", channel: "whatsapp" },
  { type: "meeting", channel: "email" },
  { type: "bounce", channel: "email" },
  { type: "note", channel: "email" },
];

// Replies, calls, messages, meetings, bounces and notes, recorded by the user.
export async function logEvent(prospectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const type = String(formData.get("type") ?? "") as OutreachEventType;
  const entry = LOGGABLE.find((l) => l.type === type);
  if (!entry) return fail("Choose what happened.");
  const note = text(formData.get("note"));
  if (type === "note" && !note) return fail("Write the note first.");
  const date = text(formData.get("date"));
  const occurred = date ? new Date(`${date}T12:00:00`) : new Date();
  if (Number.isNaN(occurred.getTime())) return fail("That date does not look right.");
  const contactId = text(formData.get("contact_id"));

  const supabase = await createClient();
  const { error } = await supabase.from("outreach_events").insert({
    org_id: session.org.id,
    prospect_id: prospectId,
    contact_id: contactId,
    channel: entry.channel,
    type,
    note,
    occurred_at: occurred.toISOString(),
  });
  if (error) return fail(error.message);

  // A reply or meeting means the follow-up reminder is no longer needed.
  if (type === "reply" || type === "meeting") {
    await supabase
      .from("tasks")
      .update({ done: true, done_at: new Date().toISOString() })
      .eq("prospect_id", prospectId)
      .eq("done", false);
  }
  if (type === "bounce" && contactId) {
    await supabase.from("contacts").update({ email_status: "unverified" }).eq("id", contactId);
  }
  await moveStage(supabase, prospectId, type);
  revalidate(prospectId);
  return ok("Logged.");
}

export async function completeTask(taskId: string) {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ done: true, done_at: new Date().toISOString() }).eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidate();
}

// Moving a company on the Dashboard stage list, including Won and Lost. A manual move may go backward.
export async function setStage(prospectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const stage = String(formData.get("stage") ?? "") as PipelineStage;
  if (!STAGE_ORDER.includes(stage)) return fail("Choose a stage.");
  const supabase = await createClient();
  const { error } = await supabase.from("prospects").update({ stage }).eq("id", prospectId);
  if (error) return fail(error.message);
  revalidate(prospectId);
  return ok("Stage updated.");
}
