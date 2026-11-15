import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContactJob, ContactJobStep } from "@/lib/types";
import { effectiveJobStatus, isActive } from "./job-status";
import { mergeFound, type ExistingContact } from "./merge";
import { findWithApollo } from "./sources/apollo";
import { findOnSite } from "./sources/site";
import type { FoundContact, SourceContext, SourceResult } from "./sources/types";
import { findWithWeb } from "./sources/web";
import { loadPursued, promoteReady, titlesFor } from "./targets";
import { emailOnPage, fetchPageText } from "./verify";

// Contact finding runs as jobs: one contact_jobs row per company run. Today the app runs each
// job right after the response is sent (Next.js after()), like Intelligence briefs; a scheduled
// worker can later pick up "queued" rows instead, without changing the pages.
//
// Sources run in order and later ones only fill gaps: Apollo first (skipped while the plan has
// no API access), then the company's own website (free), then public web search (AI, paid). Google Maps stays manual (Google's Places terms).

export type JobTrigger = ContactJob["trigger"];
export type StartResult = { ok: true } | { ok: false; message: string };

const SOURCES: { key: ContactJobStep["source"]; run: (s: SupabaseClient, c: SourceContext) => Promise<SourceResult> }[] = [
  { key: "apollo", run: findWithApollo },
  { key: "site", run: (_s, c) => findOnSite(c) },
  { key: "web", run: findWithWeb },
];

const BULK_CONCURRENCY = 2;

const CONTACT_FIELDS = "id, name, title, email, email_status, email_unconfirmed, phone, mobile, whatsapp, apollo_id, source_url";

async function latestJob(supabase: SupabaseClient, prospectId: string) {
  const { data } = await supabase
    .from("contact_jobs")
    .select("id, status, created_at")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Pick<ContactJob, "id" | "status" | "created_at">>();
  return data;
}

// A job left "running" by a restart is recorded as failed before a new one starts.
async function closeStale(supabase: SupabaseClient, job: Pick<ContactJob, "id" | "status" | "created_at"> | null) {
  if (job && (job.status === "queued" || job.status === "running") && effectiveJobStatus(job) === "failed") {
    await supabase
      .from("contact_jobs")
      .update({ status: "failed", error: "Contact finding did not finish in time.", finished_at: new Date().toISOString() })
      .eq("id", job.id);
  }
}

export async function startContactJob(supabase: SupabaseClient, orgId: string, prospectId: string, trigger: JobTrigger): Promise<StartResult> {
  const latest = await latestJob(supabase, prospectId);
  if (isActive(latest)) return { ok: false, message: "Polaris is already finding contacts for this company." };
  await closeStale(supabase, latest);
  const { data: job, error } = await supabase
    .from("contact_jobs")
    .insert({ org_id: orgId, prospect_id: prospectId, trigger, status: "queued" })
    .select("id")
    .single<{ id: string }>();
  if (error) return { ok: false, message: error.message };
  after(() => runContactJob(supabase, orgId, job.id, prospectId));
  return { ok: true };
}

// A profile's pursued companies that have no contacts yet and no job running.
export async function companiesWaiting(supabase: SupabaseClient, orgId: string, profileId: string) {
  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, company_id")
    .eq("org_id", orgId)
    .eq("profile_id", profileId)
    .eq("decision", "pursue")
    .neq("status", "rejected")
    .returns<{ id: string; company_id: string }[]>();
  const list = prospects ?? [];
  if (!list.length) return [];
  const [{ data: contacts }, { data: jobs }] = await Promise.all([
    supabase
      .from("contacts")
      .select("company_id")
      .in("company_id", list.map((p) => p.company_id))
      .returns<{ company_id: string }[]>(),
    supabase
      .from("contact_jobs")
      .select("id, prospect_id, status, created_at")
      .in("prospect_id", list.map((p) => p.id))
      .order("created_at", { ascending: false })
      .returns<(Pick<ContactJob, "id" | "status" | "created_at"> & { prospect_id: string })[]>(),
  ]);
  const withContacts = new Set((contacts ?? []).map((c) => c.company_id));
  const latest = new Map<string, Pick<ContactJob, "id" | "status" | "created_at">>();
  for (const j of jobs ?? []) if (!latest.has(j.prospect_id)) latest.set(j.prospect_id, j);
  return list.filter((p) => !withContacts.has(p.company_id) && !isActive(latest.get(p.id))).map((p) => ({ ...p, latestJob: latest.get(p.id) ?? null }));
}

export async function startContactJobsForAll(supabase: SupabaseClient, orgId: string, profileId: string): Promise<{ ok: true; queued: number } | { ok: false; message: string }> {
  const waiting = await companiesWaiting(supabase, orgId, profileId);
  if (!waiting.length) return { ok: true, queued: 0 };
  for (const w of waiting) await closeStale(supabase, w.latestJob);
  const { data: jobs, error } = await supabase
    .from("contact_jobs")
    .insert(waiting.map((w) => ({ org_id: orgId, prospect_id: w.id, trigger: "bulk", status: "queued" })))
    .select("id, prospect_id")
    .returns<{ id: string; prospect_id: string }[]>();
  if (error) return { ok: false, message: error.message };
  const queue = [...(jobs ?? [])];
  after(async () => {
    while (queue.length) {
      const batch = queue.splice(0, BULK_CONCURRENCY);
      await Promise.all(batch.map((j) => runContactJob(supabase, orgId, j.id, j.prospect_id)));
    }
  });
  return { ok: true, queued: queue.length };
}

function insertRow(orgId: string, companyId: string, c: FoundContact) {
  return {
    org_id: orgId,
    company_id: companyId,
    name: c.name,
    title: c.title,
    email: c.email,
    email_status: c.email ? c.emailStatus : "missing",
    email_unconfirmed: Boolean(c.email && c.emailUnconfirmed),
    phone: c.phone,
    mobile: c.mobile,
    mobile_status: c.mobile ? "unverified" : "missing",
    whatsapp: c.whatsapp,
    apollo_id: c.apolloId ?? null,
    linkedin_url: c.linkedinUrl ?? null,
    source: c.source,
    source_url: c.sourceUrl,
    retrieved_at: new Date().toISOString(),
  };
}

// Saves one source's contacts: new people are inserted, known people only get their empty
// fields filled. Returns how many contacts were added or completed.
async function save(supabase: SupabaseClient, orgId: string, companyId: string, found: FoundContact[]) {
  const { data: existing, error: loadError } = await supabase
    .from("contacts")
    .select(CONTACT_FIELDS)
    .eq("company_id", companyId)
    .returns<ExistingContact[]>();
  if (loadError) throw new Error(loadError.message);
  const { inserts, updates } = mergeFound(existing ?? [], found);
  if (inserts.length) {
    const { error } = await supabase.from("contacts").insert(inserts.map((c) => insertRow(orgId, companyId, c)));
    if (error) throw new Error(error.message);
  }
  for (const u of updates) {
    const patch = { ...u.patch, ...(u.patch.mobile ? { mobile_status: "unverified" } : {}) };
    const { error } = await supabase.from("contacts").update(patch).eq("id", u.id);
    if (error) throw new Error(error.message);
  }
  return inserts.length + updates.length;
}

// Free first step of every run: re-opens the saved source page of each "Not confirmed" email
// and clears the mark when the address is there (for example a PDF that could not be read
// before). No AI and no cost. Returns null when there was nothing to recheck.
export async function recheckUnconfirmed(supabase: SupabaseClient, companyId: string): Promise<ContactJobStep | null> {
  const { data } = await supabase
    .from("contacts")
    .select("id, name, email, source_url")
    .eq("company_id", companyId)
    .eq("email_unconfirmed", true)
    .not("email", "is", null)
    .returns<{ id: string; name: string; email: string; source_url: string | null }[]>();
  const rows = data ?? [];
  if (!rows.length) return null;
  let confirmed = 0;
  const checks: string[] = [];
  for (const c of rows) {
    const text = c.source_url ? await fetchPageText(c.source_url) : null;
    if (text && emailOnPage(c.email, text)) {
      const { error } = await supabase.from("contacts").update({ email_unconfirmed: false }).eq("id", c.id);
      if (!error) {
        confirmed += 1;
        continue;
      }
    }
    checks.push(
      `Email ${c.email} (${c.name}): ${!c.source_url ? "no source page saved" : text === null ? "source page could not be read" : "still not on its source page"}. Still marked not confirmed.`,
    );
  }
  return { source: "recheck", outcome: confirmed ? "found" : "none", saved: confirmed, unconfirmed: rows.length - confirmed || undefined, checks: checks.length ? checks : undefined };
}

export async function runContactJob(supabase: SupabaseClient, orgId: string, jobId: string, prospectId: string) {
  const finish = (fields: Partial<Pick<ContactJob, "status" | "summary" | "saved_count" | "error">>) =>
    supabase.from("contact_jobs").update({ ...fields, finished_at: new Date().toISOString() }).eq("id", jobId);
  try {
    await supabase.from("contact_jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", jobId);
    const prospect = await loadPursued(supabase, prospectId);
    if (!prospect?.companies) throw new Error("The company is no longer in the pipeline.");
    if (prospect.decision !== "pursue") throw new Error("The company is no longer marked pursue.");
    const company = prospect.companies;
    const ctx: SourceContext = {
      orgId,
      companyName: company.name,
      domain: company.domain,
      website: company.website ?? (company.domain ? `https://${company.domain}` : null),
      location: company.location,
      roles: await titlesFor(supabase, prospectId, prospect.profile_id),
    };

    const summary: ContactJobStep[] = [];
    let savedTotal = 0;
    let anyEmail = false;
    const recheck = await recheckUnconfirmed(supabase, company.id);
    if (recheck) {
      summary.push(recheck);
      savedTotal += recheck.saved;
      anyEmail ||= recheck.saved > 0;
      await supabase.from("contact_jobs").update({ summary }).eq("id", jobId);
    }
    for (const source of SOURCES) {
      const result = await source.run(supabase, ctx);
      const saved = result.contacts.length ? await save(supabase, orgId, company.id, result.contacts) : 0;
      savedTotal += saved;
      anyEmail ||= result.contacts.some((c) => c.email && !c.emailUnconfirmed);
      summary.push({
        source: source.key,
        outcome: result.outcome,
        saved,
        dropped: result.dropped || undefined,
        unconfirmed: result.unconfirmed || undefined,
        checks: result.checks?.length ? result.checks : undefined,
        note: result.note,
      });
      await supabase.from("contact_jobs").update({ summary }).eq("id", jobId);
    }
    if (anyEmail) await promoteReady(supabase, company.id);

    const ran = summary.filter((s) => s.source !== "recheck" && s.outcome !== "skipped");
    const failed = ran.every((s) => s.outcome === "failed"); // also true when every source was skipped
    await finish({
      status: failed ? "failed" : "done",
      summary,
      saved_count: savedTotal,
      error: !failed ? null : ran.length ? ran.map((s) => s.note).filter(Boolean).join(" ") || "Every source failed." : "No contact source is available.",
    });
  } catch (err) {
    console.error("[contact-job]", err);
    await finish({ status: "failed", error: err instanceof Error ? err.message : "Contact finding failed." });
  }
}
