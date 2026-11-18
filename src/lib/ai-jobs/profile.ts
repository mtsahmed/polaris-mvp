import "server-only";
import { z } from "zod";
import { anyProviderConfigured } from "@/lib/ai/generate";
import { draftIcp } from "@/lib/ai/icp-draft";
import { handleAiError, logAttempts } from "@/lib/ai/log-attempts";
import { extractProfileIntelligence, type IntelligenceSource } from "@/lib/ai/profile-intelligence";
import { writeIcp } from "@/lib/icp/write";
import type { Profile, ProfileSource } from "@/lib/types";
import { done, failed, revalidate, type AiJob } from "./types";

const UPLOAD_BUCKET = "profile-uploads";

function profilePath(id: string) {
  return `/profiles/${id}`;
}

const ProfileInput = z.object({ profileId: z.string().uuid() });

// Profile insights: the AI summary of a profile from its sources (table column: intelligence).
export const profileIntelligenceJob: AiJob<typeof ProfileInput> = {
  input: ProfileInput,
  writing: "Writing the profile draft…",
  async run({ session, supabase, report }, { profileId }) {
    if (!anyProviderConfigured()) {
      return failed("Set ANTHROPIC_API_KEY (or OPENAI_API_KEY as a fallback) in .env.local to generate profile insights.");
    }
    const [{ data: profile }, { data: sources }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", profileId).single<Profile>(),
      supabase.from("profile_sources").select("*").eq("profile_id", profileId).order("created_at").returns<ProfileSource[]>(),
    ]);
    if (!profile) return failed("Profile not found.");
    if (!sources?.length) return failed("Add at least one link, file or questionnaire first.");

    report("Collecting your sources…");
    const inputs: IntelligenceSource[] = [];
    for (const [i, s] of sources.entries()) {
      const base = { id: s.id, label: `S${i + 1}`, kind: s.kind, location: s.location, title: s.title };
      if (s.kind === "file" && !s.extracted_text) {
        const { data: blob, error } = await supabase.storage.from(UPLOAD_BUCKET).download(s.location);
        if (error || !blob) return failed(`Could not read ${s.title ?? "an uploaded file"}: ${error?.message}`);
        inputs.push({ ...base, pdfBase64: Buffer.from(await blob.arrayBuffer()).toString("base64") });
      } else {
        inputs.push({ ...base, text: s.extracted_text ?? undefined });
      }
    }

    try {
      const result = await extractProfileIntelligence({ profileName: profile.name, profileType: profile.type, sources: inputs });
      await logAttempts(supabase, session.org.id, "profile-intelligence", result.attempts);
      report("Saving the draft…");

      // Map citation labels back to stored sources so the UI can link them.
      const labelToSource = new Map(inputs.map((s) => [s.label, s]));
      const evidence = result.data.evidence.map((e) => {
        const src = labelToSource.get(e.source.trim());
        return {
          claim: e.claim,
          quote: e.quote,
          source: src ? (src.kind === "url" ? src.location : (src.title ?? src.label)) : `${e.source} (unmatched)`,
        };
      });

      const { error } = await supabase
        .from("profiles")
        .update({
          intelligence: { ...result.data, evidence, model: result.model, provider: result.provider, source_ids: inputs.map((s) => s.id) },
          intelligence_generated_at: new Date().toISOString(),
        })
        .eq("id", profileId);
      if (error) return failed(error.message);

      revalidate(profilePath(profileId));
      return done(
        result.provider === "openai"
          ? "Draft ready (Claude was unavailable, so OpenAI wrote it). Review it, then apply it."
          : "Draft ready. Review it, then apply it to the profile.",
      );
    } catch (err) {
      return failed(await handleAiError(supabase, session.org.id, "profile-intelligence", err));
    }
  },
};

export const icpDraftJob: AiJob<typeof ProfileInput> = {
  input: ProfileInput,
  writing: "Writing the ideal customer profile…",
  async run({ session, supabase, report }, { profileId }) {
    if (!anyProviderConfigured()) {
      return failed("Set ANTHROPIC_API_KEY (or OPENAI_API_KEY as a fallback) in .env.local to draft an ICP.");
    }
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", profileId).single<Profile>();
    if (!profile) return failed("Profile not found.");
    if (!profile.positioning && profile.services.length === 0) {
      return failed("Fill in at least the positioning or services on the profile first.");
    }

    try {
      const result = await draftIcp(profile);
      await logAttempts(supabase, session.org.id, "icp-draft", result.attempts);
      report("Saving the draft…");
      const { error } = await writeIcp(supabase, profileId, session.org.id, result.data);
      if (error) return failed(error.message);
      revalidate(profilePath(profileId));
      return done(
        result.provider === "openai"
          ? "ICP drafted by OpenAI (Claude was unavailable). Edit it, then approve it."
          : "ICP drafted. Edit it, then approve it.",
      );
    } catch (err) {
      return failed(await handleAiError(supabase, session.org.id, "icp-draft", err));
    }
  },
};
