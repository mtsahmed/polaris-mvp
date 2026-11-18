"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

// Notes typed in the Dashboard's table view. They are the same notes as "What you already know"
// in the pitch studio (prospects.notes), so a note written in either place shows in both.
export async function saveCompanyNotes(prospectId: string, notes: string): Promise<{ ok: boolean; message?: string }> {
  await requireSession();
  const clean = notes.trim().slice(0, 4000) || null;
  const supabase = await createClient();
  const { error } = await supabase.from("prospects").update({ notes: clean }).eq("id", prospectId);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/pitch/${prospectId}`);
  return { ok: true };
}
