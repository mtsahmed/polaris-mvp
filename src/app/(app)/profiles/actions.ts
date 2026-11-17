"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, lines, ok, text, type ActionState } from "@/lib/action-state";
import { anyProviderConfigured } from "@/lib/ai/generate";
import { draftIcp } from "@/lib/ai/icp-draft";
import { extractProfileIntelligence, type IntelligenceSource } from "@/lib/ai/profile-intelligence";
import { handleAiError, logAttempts } from "@/lib/ai/log-attempts";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { QUESTIONNAIRE } from "@/lib/questionnaire";
import { PROFILE_TYPES, type Icp, type Profile, type ProfileSource } from "@/lib/types";

const UPLOAD_BUCKET = "profile-uploads";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const TEXT_TYPES = ["text/plain", "text/markdown"];
const TEXT_EXTENSIONS = [".txt", ".md"];

const profileTypeSchema = z.enum(PROFILE_TYPES.map((t) => t.value) as [string, ...string[]]);

const urlSchema = z
  .string()
  .trim()
  .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
  .pipe(z.url({ protocol: /^https?$/, message: "Enter a valid web address." }));

function profilePath(id: string) {
  return `/profiles/${id}`;
}



// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export async function createProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const name = text(formData.get("name"));
  if (!name) return fail("Enter a name.");
  const type = profileTypeSchema.safeParse(formData.get("type"));
  if (!type.success) return fail("Choose a profile type.");

  let website: string | null = null;
  const rawSite = text(formData.get("website"));
  if (rawSite) {
    const parsed = urlSchema.safeParse(rawSite);
    if (!parsed.success) return fail("Enter a valid website address.");
    website = parsed.data;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .insert({ org_id: session.org.id, name, type: type.data, website })
    .select("id")
    .single();
  if (error) return fail(error.message);

  // The website becomes the first research source automatically.
  if (website) {
    await supabase.from("profile_sources").insert({
      org_id: session.org.id,
      profile_id: data.id,
      kind: "url",
      location: website,
      title: "Website",
      status: "ready",
    });
  }

  revalidatePath("/profiles");
  redirect(`${profilePath(data.id)}?tab=sources`);
}

export async function updateProfile(
  profileId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();
  const name = text(formData.get("name"));
  if (!name) return fail("Name cannot be empty.");
  const type = profileTypeSchema.safeParse(formData.get("type"));
  if (!type.success) return fail("Choose a profile type.");

  let website: string | null = null;
  const rawSite = text(formData.get("website"));
  if (rawSite) {
    const parsed = urlSchema.safeParse(rawSite);
    if (!parsed.success) return fail("Enter a valid website address.");
    website = parsed.data;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      name,
      type: type.data,
      website,
      positioning: text(formData.get("positioning")),
      audience: text(formData.get("audience")),
      services: lines(formData.get("services")),
      strengths: lines(formData.get("strengths")),
      objectives: lines(formData.get("objectives")),
      voice_samples: (typeof formData.get("voice_samples") === "string"
        ? // Browsers submit textarea line breaks as \r\n, so accept both.
          (formData.get("voice_samples") as string).split(/\r?\n[ \t]*-{3,}[ \t]*\r?\n/)
        : []
      )
        .map((s) => s.trim())
        .filter(Boolean),
    })
    .eq("id", profileId);
  if (error) return fail(error.message);

  revalidatePath(profilePath(profileId));
  revalidatePath("/profiles");
  return ok("Profile saved.");
}

export async function deleteProfile(profileId: string) {
  await requireSession();
  const supabase = await createClient();
  const { data: files } = await supabase
    .from("profile_sources")
    .select("location")
    .eq("profile_id", profileId)
    .eq("kind", "file");
  if (files?.length) {
    await supabase.storage.from(UPLOAD_BUCKET).remove(files.map((f) => f.location));
  }
  await supabase.from("profiles").delete().eq("id", profileId);
  revalidatePath("/profiles");
  redirect("/profiles");
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export async function addUrlSource(
  profileId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  const parsed = urlSchema.safeParse(formData.get("url"));
  if (!parsed.success) return fail("Enter a valid web address.");

  const supabase = await createClient();
  const { error } = await supabase.from("profile_sources").insert({
    org_id: session.org.id,
    profile_id: profileId,
    kind: "url",
    location: parsed.data,
    title: text(formData.get("title")),
    status: "ready",
  });
  if (error) return fail(error.message);
  revalidatePath(profilePath(profileId));
  return ok("Link added.");
}

// Where the browser should upload a file for this profile. Storage RLS only accepts
// paths under the user's own organization id.
export async function prepareUpload(profileId: string, fileName: string, size: number, type: string) {
  const session = await requireSession();
  if (size > MAX_UPLOAD_BYTES) return { error: "Files must be 10 MB or smaller." };
  const lower = fileName.toLowerCase();
  const isPdf = type === "application/pdf" || lower.endsWith(".pdf");
  const isText = TEXT_TYPES.includes(type) || TEXT_EXTENSIONS.some((e) => lower.endsWith(e));
  if (!isPdf && !isText) return { error: "Upload a PDF, .txt or .md file. Word documents: save as PDF first." };

  const safeName = fileName.replace(/[^\w.\-]+/g, "_").slice(-80);
  return {
    path: `${session.org.id}/${profileId}/${crypto.randomUUID()}-${safeName}`,
    contentType: isPdf ? "application/pdf" : "text/plain",
  };
}

// Called after the browser upload succeeds: records the source and extracts text files.
export async function registerUploadedFile(profileId: string, path: string, fileName: string): Promise<ActionState> {
  const session = await requireSession();
  if (!path.startsWith(`${session.org.id}/${profileId}/`)) return fail("Upload path does not belong to this profile.");

  const supabase = await createClient();
  const { data: blob, error: readError } = await supabase.storage.from(UPLOAD_BUCKET).download(path);
  if (readError || !blob) return fail(`Upload not found: ${readError?.message ?? "unknown error"}`);

  const isPdf = blob.type === "application/pdf" || path.toLowerCase().endsWith(".pdf");
  const extracted = isPdf ? null : (await blob.text()).slice(0, 200_000);

  const { error } = await supabase.from("profile_sources").insert({
    org_id: session.org.id,
    profile_id: profileId,
    kind: "file",
    location: path,
    title: fileName,
    extracted_text: extracted,
    status: "ready",
  });
  if (error) {
    await supabase.storage.from(UPLOAD_BUCKET).remove([path]);
    return fail(error.message);
  }
  revalidatePath(profilePath(profileId));
  return ok(`${fileName} uploaded.`);
}

export async function saveQuestionnaire(
  profileId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  const answered = QUESTIONNAIRE.map((q) => ({ q, a: text(formData.get(q.key)) })).filter((x) => x.a);
  if (answered.length === 0) return fail("Answer at least one question.");

  const body = answered.map(({ q, a }) => `Q: ${q.label}\nA: ${a}`).join("\n\n");
  const supabase = await createClient();

  // One questionnaire per profile: replace the previous answers.
  await supabase.from("profile_sources").delete().eq("profile_id", profileId).eq("kind", "questionnaire");
  const { error } = await supabase.from("profile_sources").insert({
    org_id: session.org.id,
    profile_id: profileId,
    kind: "questionnaire",
    location: "questionnaire",
    title: "Owner questionnaire",
    extracted_text: body,
    status: "ready",
  });
  if (error) return fail(error.message);
  revalidatePath(profilePath(profileId));
  return ok("Answers saved.");
}

export async function deleteSource(profileId: string, sourceId: string) {
  await requireSession();
  const supabase = await createClient();
  const { data: source } = await supabase
    .from("profile_sources")
    .select("kind, location")
    .eq("id", sourceId)
    .maybeSingle();
  if (source?.kind === "file") {
    await supabase.storage.from(UPLOAD_BUCKET).remove([source.location]);
  }
  await supabase.from("profile_sources").delete().eq("id", sourceId);
  revalidatePath(profilePath(profileId));
}

// ---------------------------------------------------------------------------
// Profile insights (the AI summary of a profile from its sources; table column: intelligence)
// ---------------------------------------------------------------------------

export async function generateIntelligence(
  profileId: string,
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!anyProviderConfigured()) {
    return fail("Set ANTHROPIC_API_KEY (or OPENAI_API_KEY as a fallback) in .env.local to generate profile insights.");
  }

  const supabase = await createClient();
  const [{ data: profile }, { data: sources }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", profileId).single<Profile>(),
    supabase
      .from("profile_sources")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at")
      .returns<ProfileSource[]>(),
  ]);
  if (!profile) return fail("Profile not found.");
  if (!sources?.length) return fail("Add at least one link, file or questionnaire first.");

  const inputs: IntelligenceSource[] = [];
  for (const [i, s] of sources.entries()) {
    const base = { id: s.id, label: `S${i + 1}`, kind: s.kind, location: s.location, title: s.title };
    if (s.kind === "file" && !s.extracted_text) {
      const { data: blob, error } = await supabase.storage.from(UPLOAD_BUCKET).download(s.location);
      if (error || !blob) return fail(`Could not read ${s.title ?? "an uploaded file"}: ${error?.message}`);
      inputs.push({ ...base, pdfBase64: Buffer.from(await blob.arrayBuffer()).toString("base64") });
    } else {
      inputs.push({ ...base, text: s.extracted_text ?? undefined });
    }
  }

  try {
    const result = await extractProfileIntelligence({
      profileName: profile.name,
      profileType: profile.type,
      sources: inputs,
    });
    await logAttempts(supabase, session.org.id, "profile-intelligence", result.attempts);

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
        intelligence: {
          ...result.data,
          evidence,
          model: result.model,
          provider: result.provider,
          source_ids: inputs.map((s) => s.id),
        },
        intelligence_generated_at: new Date().toISOString(),
      })
      .eq("id", profileId);
    if (error) return fail(error.message);

    revalidatePath(profilePath(profileId));
    return ok(
      result.provider === "openai"
        ? "Draft ready (Claude was unavailable, so OpenAI wrote it). Review it, then apply it."
        : "Draft ready. Review it, then apply it to the profile.",
    );
  } catch (err) {
    return fail(await handleAiError(supabase, session.org.id, "profile-intelligence", err));
  }
}

// Copies the reviewed draft into the editable profile fields.
export async function applyIntelligence(profileId: string) {
  await requireSession();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("intelligence")
    .eq("id", profileId)
    .single<Pick<Profile, "intelligence">>();
  const intel = profile?.intelligence;
  if (!intel) return;
  await supabase
    .from("profiles")
    .update({
      positioning: intel.positioning || null,
      audience: intel.audience || null,
      services: intel.services,
      strengths: intel.strengths,
      objectives: intel.objectives,
    })
    .eq("id", profileId);
  revalidatePath(profilePath(profileId));
  redirect(`${profilePath(profileId)}?tab=overview`);
}

// ---------------------------------------------------------------------------
// ICP (versioned; approval records who and when)
// ---------------------------------------------------------------------------

async function latestIcp(supabase: Awaited<ReturnType<typeof createClient>>, profileId: string) {
  const { data } = await supabase
    .from("icps")
    .select("*")
    .eq("profile_id", profileId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle<Icp>();
  return data;
}

type IcpFields = Pick<Icp, "industries" | "company_traits" | "geographies" | "titles" | "problems_addressed" | "notes"> &
  Partial<Pick<Icp, "excluded_geographies" | "competitors" | "min_employees">>;

// Edits the current draft, or starts a new version if the latest one is already approved. A new
// version keeps the previous knockouts unless the fields say otherwise (the AI draft never sets them).
async function writeIcp(profileId: string, orgId: string, fields: IcpFields) {
  const supabase = await createClient();
  const latest = await latestIcp(supabase, profileId);
  if (latest && !latest.approved) {
    return supabase.from("icps").update(fields).eq("id", latest.id);
  }
  return supabase.from("icps").insert({
    excluded_geographies: latest?.excluded_geographies ?? [],
    competitors: latest?.competitors ?? [],
    min_employees: latest?.min_employees ?? null,
    ...fields,
    org_id: orgId,
    profile_id: profileId,
    version: (latest?.version ?? 0) + 1,
  });
}

export async function draftIcpWithClaude(
  profileId: string,
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!anyProviderConfigured()) {
    return fail("Set ANTHROPIC_API_KEY (or OPENAI_API_KEY as a fallback) in .env.local to draft an ICP.");
  }
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", profileId).single<Profile>();
  if (!profile) return fail("Profile not found.");
  if (!profile.positioning && profile.services.length === 0) {
    return fail("Fill in at least the positioning or services on the profile first.");
  }

  try {
    const result = await draftIcp(profile);
    await logAttempts(supabase, session.org.id, "icp-draft", result.attempts);
    const { error } = await writeIcp(profileId, session.org.id, result.data);
    if (error) return fail(error.message);
    revalidatePath(profilePath(profileId));
    return ok(
      result.provider === "openai"
        ? "ICP drafted by OpenAI (Claude was unavailable). Edit it, then approve it."
        : "ICP drafted. Edit it, then approve it.",
    );
  } catch (err) {
    return fail(await handleAiError(supabase, session.org.id, "icp-draft", err));
  }
}

export async function saveIcp(profileId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const fields: IcpFields = {
    industries: lines(formData.get("industries")),
    company_traits: lines(formData.get("company_traits")),
    geographies: lines(formData.get("geographies")),
    titles: lines(formData.get("titles")),
    problems_addressed: lines(formData.get("problems_addressed")),
    excluded_geographies: lines(formData.get("excluded_geographies")),
    competitors: lines(formData.get("competitors")),
    min_employees: null,
    notes: text(formData.get("notes")),
  };
  if (fields.industries.length === 0 || fields.titles.length === 0) {
    return fail("An ICP needs at least one industry and one job title.");
  }
  const minEmployees = text(formData.get("min_employees"));
  if (minEmployees) {
    const n = Number(minEmployees);
    if (!Number.isInteger(n) || n < 1) return fail("Minimum company size must be a whole number of employees, 1 or more.");
    fields.min_employees = n;
  }
  const { error } = await writeIcp(profileId, session.org.id, fields);
  if (error) return fail(error.message);
  revalidatePath(profilePath(profileId));
  return ok("ICP saved as a draft.");
}

export async function approveIcp(profileId: string, icpId: string) {
  const session = await requireSession();
  const supabase = await createClient();
  await supabase
    .from("icps")
    .update({ approved: true, approved_by: session.userId, approved_at: new Date().toISOString() })
    .eq("id", icpId)
    .eq("approved", false);
  revalidatePath(profilePath(profileId));
}
