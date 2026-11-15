"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, text, type ActionState } from "@/lib/action-state";
import { apolloConfigured, revealPerson, searchPeople } from "@/lib/contacts/apollo";
import type { ApolloCandidate } from "@/lib/contacts/apollo-map";
import { recheckUnconfirmed, startContactJob, startContactJobsForAll } from "@/lib/contacts/jobs";
import { loadPursued, promoteReady, titlesFor } from "@/lib/contacts/targets";
import { activeProfile } from "@/lib/profile-selection";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

function revalidate() {
  revalidatePath("/contacts");
  revalidatePath("/outreach");
  revalidatePath("/pipeline");
}

export type FindResult = { ok: true; candidates: ApolloCandidate[]; byTitle: boolean } | { ok: false; error: string };

// Free Apollo people search (no credits, no emails). If the role titles find no one, it searches
// the whole company once more so the user still sees who Apollo knows there.
export async function findPeople(prospectId: string): Promise<FindResult> {
  const session = await requireSession();
  if (!apolloConfigured()) return { ok: false, error: "Apollo is not connected. Add APOLLO_API_KEY to .env.local and restart the app." };
  const supabase = await createClient();
  const prospect = await loadPursued(supabase, prospectId);
  if (!prospect) return { ok: false, error: "Company not found." };
  if (prospect.decision !== "pursue") return { ok: false, error: "Mark this company as pursue in Intelligence first." };
  const domain = prospect.companies!.domain ?? prospect.companies!.website;
  if (!domain) return { ok: false, error: "This company has no website or domain to search Apollo with." };

  try {
    const titles = await titlesFor(supabase, prospectId, prospect.profile_id);
    let candidates = titles.length ? await searchPeople(supabase, session.org.id, domain, titles) : [];
    let byTitle = titles.length > 0;
    if (!candidates.length) {
      candidates = await searchPeople(supabase, session.org.id, domain, []);
      byTitle = false;
    }
    // Hide people already saved as contacts.
    const { data: saved } = await supabase
      .from("contacts")
      .select("apollo_id")
      .eq("company_id", prospect.company_id)
      .not("apollo_id", "is", null)
      .returns<{ apollo_id: string }[]>();
    const savedIds = new Set((saved ?? []).map((s) => s.apollo_id));
    revalidatePath("/usage");
    return { ok: true, candidates: candidates.filter((c) => !savedIds.has(c.apolloId)), byTitle };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Apollo search failed." };
  }
}

// Reveals one person's email (1 Apollo credit) and saves them as a contact. Started only by the
// user clicking "Get email", one person at a time.
export async function revealContact(prospectId: string, apolloId: string): Promise<ActionState> {
  const session = await requireSession();
  const supabase = await createClient();
  const prospect = await loadPursued(supabase, prospectId);
  if (!prospect) return fail("Company not found.");
  if (prospect.decision !== "pursue") return fail("Mark this company as pursue in Intelligence first.");

  const { data: existing } = await supabase
    .from("contacts")
    .select("id")
    .eq("apollo_id", apolloId)
    .maybeSingle<{ id: string }>();
  if (existing) return ok("Already saved.");

  try {
    const person = await revealPerson(supabase, session.org.id, apolloId);
    if (!person) return fail("Apollo found no details for this person. No credit was used.");
    const { error } = await supabase.from("contacts").insert({
      org_id: session.org.id,
      company_id: prospect.company_id,
      name: person.name,
      title: person.title,
      email: person.email,
      email_status: person.emailStatus,
      apollo_id: person.apolloId,
      linkedin_url: person.linkedinUrl,
      source: "Apollo",
      retrieved_at: new Date().toISOString(),
    });
    if (error) return fail(error.message);
    if (person.email) await promoteReady(supabase, prospect.company_id);
    revalidate();
    revalidatePath("/usage");
    return ok(person.email ? `Saved ${person.name}.` : `Saved ${person.name}. Apollo had no email for them.`);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Apollo lookup failed.");
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A contact the user found themselves (Google Maps stays manual). Labelled with where it came
// from and never shown as verified: Polaris has not checked the details.
export async function addContact(prospectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const name = text(formData.get("name"));
  const picked = text(formData.get("found_at"));
  const foundAt = picked === "Other" ? text(formData.get("found_at_other")) : picked;
  const email = text(formData.get("email"));
  const phone = text(formData.get("phone"));
  const mobile = text(formData.get("mobile"));
  const whatsapp = text(formData.get("whatsapp"));
  const sourceUrl = text(formData.get("source_url"));
  if (!name) return fail(`Enter the person's name, or "Main office" for a company line.`);
  if (!foundAt) return fail("Say where you found these details.");
  if (email && !EMAIL.test(email)) return fail("That email address does not look right.");
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) return fail("The page link should start with https://");

  const supabase = await createClient();
  const prospect = await loadPursued(supabase, prospectId);
  if (!prospect) return fail("Company not found.");

  const { error } = await supabase.from("contacts").insert({
    org_id: session.org.id,
    company_id: prospect.company_id,
    name,
    title: text(formData.get("title")),
    email,
    email_status: email ? "unverified" : "missing",
    phone,
    mobile,
    mobile_status: mobile ? "unverified" : "missing",
    whatsapp,
    source: `Added by hand: ${foundAt}`,
    source_url: sourceUrl,
    retrieved_at: new Date().toISOString(),
  });
  if (error) return fail(error.message);
  if (email) await promoteReady(supabase, prospect.company_id);
  revalidate();
  return ok(`Saved ${name}.`);
}

// Mobile numbers are added by hand (Apollo's mobile reveal needs a public webhook).
export async function saveMobile(contactId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const mobile = text(formData.get("mobile"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({ mobile, mobile_status: mobile ? "unverified" : "missing" })
    .eq("id", contactId);
  if (error) return fail(error.message);
  revalidate();
  return ok(mobile ? "Mobile number saved." : "Mobile number removed.");
}

export async function deleteContact(contactId: string) {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", contactId);
  if (error) throw new Error(error.message);
  revalidate();
}

// "Find contacts for all": queues every pursued company that has no contacts and no job running.
// Each job runs Apollo (when the plan allows) then web search; the AI cost is logged per job.
export async function findAllContacts(_prev: ActionState): Promise<ActionState> {
  const session = await requireSession();
  const { active } = await activeProfile();
  if (!active) return fail("Create a profile first.");
  const supabase = await createClient();
  const result = await startContactJobsForAll(supabase, session.org.id, active.id);
  if (!result.ok) return fail(result.message);
  revalidatePath("/contacts");
  return result.queued
    ? ok(`Finding contacts for ${result.queued} compan${result.queued === 1 ? "y" : "ies"}. This page updates by itself.`)
    : ok("Every pursued company already has contacts or a search running.");
}

// "Search again" for one company: a new job; known people only get their gaps filled.
export async function searchAgain(prospectId: string, _prev: ActionState): Promise<ActionState> {
  const session = await requireSession();
  const supabase = await createClient();
  const prospect = await loadPursued(supabase, prospectId);
  if (!prospect) return fail("Company not found.");
  if (prospect.decision !== "pursue") return fail("Mark this company as pursue in Intelligence first.");
  const result = await startContactJob(supabase, session.org.id, prospectId, "retry");
  if (!result.ok) return fail(result.message);
  revalidatePath("/contacts");
  return ok("Searching again. This page updates by itself.");
}

// "Recheck emails": free, no AI. Re-opens the saved source page of each "Not confirmed" email
// (PDFs included) and clears the mark when the address is there. Runs only this check.
export async function recheckEmails(prospectId: string, _prev: ActionState): Promise<ActionState> {
  await requireSession();
  const supabase = await createClient();
  const prospect = await loadPursued(supabase, prospectId);
  if (!prospect) return fail("Company not found.");
  const step = await recheckUnconfirmed(supabase, prospect.company_id);
  if (!step) return ok("No unconfirmed emails to recheck.");
  if (step.saved) await promoteReady(supabase, prospect.company_id);
  revalidate();
  const total = step.saved + (step.unconfirmed ?? 0);
  return step.saved
    ? ok(`${step.saved} of ${total} email${total === 1 ? "" : "s"} confirmed on their source page.`)
    : fail(step.checks?.join(" ") ?? "No email could be confirmed.");
}
