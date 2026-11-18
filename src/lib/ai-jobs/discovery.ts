import "server-only";
import { z } from "zod";
import { discoverCompanies, MAX_DISCOVERY } from "@/lib/ai/discovery";
import { anyProviderConfigured } from "@/lib/ai/generate";
import { handleAiError, logAttempts } from "@/lib/ai/log-attempts";
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

export const discoveryJob: AiJob<typeof DiscoveryInput> = {
  input: DiscoveryInput,
  writing: "Writing up the companies found…",
  async run({ session, supabase, report }, input) {
    const profileId = input.profile_id;
    const focus = input.focus;
    const count = Math.max(1, Math.min(MAX_DISCOVERY, input.count || 5));
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

    let added = 0;
    let dropped = 0;
    try {
      const result = await discoverCompanies({ profile, icp, focus, count, exclude: [...exclude] });
      await logAttempts(supabase, session.org.id, "discovery", result.attempts);
      report("Checking each finding's source and saving the suggestions…");
      const seen = new Set(result.seenUrls.map(urlKey).filter(Boolean));
      const provider = result.provider === "anthropic" ? "claude web search" : "openai web search";

      for (const c of result.data.companies.slice(0, count)) {
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
          discovery_model: result.model,
          discovery_focus: focus,
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
    return done(
      `${added} ${added === 1 ? "company" : "companies"} suggested.`,
      `/discovery?profile=${profileId}&found=${added}&dropped=${dropped}`,
    );
  },
};
