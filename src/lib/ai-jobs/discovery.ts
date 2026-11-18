import "server-only";
import { z } from "zod";
import { DEFAULT_DISCOVERY, discoverCompanies, MAX_DISCOVERY, planDiscoveryBatches, type DiscoveryOutput } from "@/lib/ai/discovery";
import { anyProviderConfigured } from "@/lib/ai/generate";
import { handleAiError, logAttempts } from "@/lib/ai/log-attempts";
import { resolveSegment, segmentOptions } from "@/lib/segments";
import { urlKey } from "@/lib/url-key";
import type { Icp, Profile } from "@/lib/types";
import { done, failed, NO_PROVIDER, revalidate, type AiJob } from "./types";

function domainOf(url: string): string | null {
  try {
    const u = new URL(/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`);
    if (!u.hostname.includes(".")) return null;
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function validDate(v: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return Number.isNaN(Date.parse(v)) ? null : v;
}

const DiscoveryInput = z.object({
  profile_id: z.string().uuid({ message: "Choose the profile to find companies for." }),
  focus: z.string().trim().max(500).optional().transform((v) => v || null),
  count: z.coerce.number().optional(),
});

const SEARCH_TIME_LIMIT_MS = 250_000;

export const discoveryJob: AiJob<typeof DiscoveryInput> = {
  input: DiscoveryInput,
  writing: "Writing up the companies found…",
  async run({ session, supabase, report }, input) {
    const profileId = input.profile_id;
    const focus = input.focus;
    const count = Math.max(1, Math.min(MAX_DISCOVERY, input.count || DEFAULT_DISCOVERY));
    if (!anyProviderConfigured()) return failed(NO_PROVIDER);

    const [{ data: profile }, { data: icps }, { data: existing }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", profileId).maybeSingle<Profile>(),
      supabase.from("icps").select("*").eq("profile_id", profileId).order("version", { ascending: false }).returns<Icp[]>(),
      supabase
        .from("prospects")
        .select("companies ( domain )")
        .eq("profile_id", profileId)
        .returns<{ companies: { domain: string | null } | null }[]>(),
    ]);
    if (!profile) return failed("Profile not found.");
    const icp = icps?.find((i) => i.approved) ?? icps?.[0] ?? null;

    // Companies already in this profile's pipeline (any status) and the profile's own site.
    const exclude = new Set((existing ?? []).map((r) => r.companies?.domain).filter((d): d is string => Boolean(d)));
    const ownDomain = profile.website ? domainOf(profile.website) : null;
    if (ownDomain) exclude.add(ownDomain);

    const segments = segmentOptions(icp?.industries);
    const batches = planDiscoveryBatches(count, segments);
    if (batches.length > 1) report(`Searching ${batches.length} parts of the ICP at the same time…`);

    // One time limit for all batches, leaving time to save the results before the 300-second cut-off.
    const signal = AbortSignal.timeout(SEARCH_TIME_LIMIT_MS);
    const settled = await Promise.allSettled(
      batches.map((b) =>
        discoverCompanies({ profile, icp, focus, count: b.ask, exclude: [...exclude], angle: b.angle, segments, signal }),
      ),
    );
    const results = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    const failures: string[] = [];
    for (const r of settled) {
      if (r.status === "rejected") failures.push(await handleAiError(supabase, session.org.id, "discovery", r.reason));
    }
    if (!results.length) return failed(failures[0] ?? "The search failed.");

    let added = 0;
    let dropped = 0;
    try {
      for (const r of results) await logAttempts(supabase, session.org.id, "discovery", r.attempts);
      report("Checking each finding's source and saving the suggestions…");
      const seen = new Set(results.flatMap((r) => r.seenUrls).map(urlKey).filter(Boolean));

      // Take the batches' companies in turn (each batch lists its best first) until the count is reached.
      const queue: { c: DiscoveryOutput["companies"][number]; provider: string; model: string }[] = [];
      const longest = Math.max(...results.map((r) => r.data.companies.length));
      for (let i = 0; i < longest; i++) {
        for (const r of results) {
          const c = r.data.companies[i];
          if (c) queue.push({ c, provider: r.provider === "anthropic" ? "claude web search" : "openai web search", model: r.model });
        }
      }

      for (const { c, provider, model } of queue) {
        if (added >= count) break;
        const domain = domainOf(c.website);
        // Only findings whose link the AI really read; a company with none is not suggested.
        const signals = c.signals.filter((s) => {
          const key = urlKey(s.source_url);
          return key !== null && seen.has(key) && s.summary.trim().length > 0;
        });
        if (!domain || exclude.has(domain) || !signals.length) {
          dropped++;
          continue;
        }
        exclude.add(domain);

        // Reuse the company if another profile already has it; never overwrite its research.
        const { data: found } = await supabase
          .from("companies")
          .select("id")
          .eq("org_id", session.org.id)
          .eq("domain", domain)
          .maybeSingle<{ id: string }>();
        let companyId = found?.id;
        // A known company only gets its size filled in when it has none yet.
        if (companyId && c.size.trim()) {
          await supabase.from("companies").update({ size: c.size.trim() }).eq("id", companyId).is("size", null);
        }
        if (!companyId) {
          const { data: company, error } = await supabase
            .from("companies")
            .insert({
              org_id: session.org.id,
              name: c.name.trim() || domain,
              domain,
              website: `https://${domain}`,
              industry: c.industry.trim() || null,
              location: c.location.trim() || null,
              size: c.size.trim() || null,
            })
            .select("id")
            .single<{ id: string }>();
          if (error) throw new Error(error.message);
          companyId = company.id;
        }

        // Add the findings, skipping any page already stored for this company.
        const { data: stored } = await supabase
          .from("signals")
          .select("id, source_url")
          .eq("company_id", companyId)
          .returns<{ id: string; source_url: string }[]>();
        const storedByKey = new Map((stored ?? []).map((s) => [urlKey(s.source_url), s.id]));
        for (const s of signals) {
          const key = urlKey(s.source_url);
          if (!storedByKey.has(key)) {
            const { data: row, error } = await supabase
              .from("signals")
              .insert({
                org_id: session.org.id,
                company_id: companyId,
                type: s.type,
                summary: s.summary.trim(),
                source_url: s.source_url.trim(),
                source_date: validDate(s.source_date),
                quote: s.quote.trim() || null,
                search_provider: provider,
              })
              .select("id")
              .single<{ id: string }>();
            if (error) throw new Error(error.message);
            storedByKey.set(key, row.id);
          }
        }

        const { error } = await supabase.from("prospects").insert({
          org_id: session.org.id,
          profile_id: profileId,
          company_id: companyId,
          stage: "new_lead",
          status: "suggested",
          fit_summary: c.fit_summary.trim() || null,
          discovered_at: new Date().toISOString(),
          discovery_model: model,
          discovery_focus: focus,
          segment: resolveSegment(c.segment, c.industry, segments),
        });
        if (error) throw new Error(error.message);
        added++;
      }
    } catch (err) {
      return failed(await handleAiError(supabase, session.org.id, "discovery", err));
    }

    revalidate("/discovery");
    if (!added) {
      return failed(
        dropped
          ? `No company could be suggested: ${dropped} had no website or no finding whose link the AI actually read. Try again or narrow the focus.`
          : "The AI found no matching companies. Try a different focus.",
      );
    }
    const partial = failures.length ? ` One of the parallel searches failed: ${failures[0]}` : "";
    return done(
      `${added} ${added === 1 ? "company" : "companies"} suggested.${partial}`,
      `/discovery?profile=${profileId}&found=${added}&dropped=${dropped}`,
    );
  },
};
