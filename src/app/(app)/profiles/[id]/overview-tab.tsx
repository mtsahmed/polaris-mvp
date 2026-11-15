import { Building2, PenLine, Target } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, NativeSelect } from "@/components/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PROFILE_TYPES, type Profile } from "@/lib/types";
import { brand } from "@/config/brand";
import { updateProfile } from "../actions";

// Shown as a placeholder only, so the made-up example can never be saved as the person's writing.
const WRITING_SAMPLES_EXAMPLE = [
  "Hi Sarah, saw your team just announced the spring campaign...",
  "(rest of first email)",
  "---",
  "Quick thought after watching your launch video...",
  "(rest of second sample)",
  "---",
  "(third sample)",
].join("\n");

export function OverviewTab({ profile }: { profile: Profile }) {
  return (
    <ActionForm action={updateProfile.bind(null, profile.id)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle icon={Building2}>Basics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field id="name" label="Name">
            <Input id="name" name="name" defaultValue={profile.name} required maxLength={160} />
          </Field>
          <Field id="type" label="Profile type">
            <NativeSelect id="type" name="type" defaultValue={profile.type}>
              {PROFILE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                  {t.tuned ? "" : " (not yet tuned)"}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="sm:col-span-2">
            <Field id="website" label="Website">
              <Input id="website" name="website" defaultValue={profile.website ?? ""} inputMode="url" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon={Target}>Positioning</CardTitle>
          <CardDescription>
            Fill these in yourself, or generate a sourced draft on the Intelligence tab and apply it here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field id="positioning" label="Positioning">
            <Textarea id="positioning" name="positioning" rows={3} defaultValue={profile.positioning ?? ""} />
          </Field>
          <Field id="audience" label="Audience">
            <Textarea id="audience" name="audience" rows={2} defaultValue={profile.audience ?? ""} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field id="services" label="Services" hint="One per line">
              <Textarea id="services" name="services" rows={6} defaultValue={profile.services.join("\n")} />
            </Field>
            <Field id="strengths" label="Strengths" hint="One per line">
              <Textarea id="strengths" name="strengths" rows={6} defaultValue={profile.strengths.join("\n")} />
            </Field>
            <Field id="objectives" label="Objectives" hint="One per line">
              <Textarea id="objectives" name="objectives" rows={6} defaultValue={profile.objectives.join("\n")} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon={PenLine}>Writing samples</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            Paste two or three emails or posts this person wrote themselves (a sales pitch, for example);
            100 to 300 words is enough. {brand.productName} uses them to match their writing style in
            pitches. Put a line with only <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">---</code>{" "}
            between samples.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div id="writing-samples-help" className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
            <p className="font-semibold text-foreground">What to paste</p>
            <p>
              Two or three real pieces the profile owner wrote themselves, such as outreach emails, LinkedIn
              posts or client messages.
            </p>
            <p>
              Pieces close to the job at hand work best. A past pitch or introduction email teaches more than a
              long blog article.
            </p>
          </div>
          <Textarea
            id="voice_samples"
            name="voice_samples"
            rows={10}
            defaultValue={profile.voice_samples.join("\n---\n")}
            placeholder={WRITING_SAMPLES_EXAMPLE}
            aria-label="Writing samples"
            aria-describedby="writing-samples-help"
            className="min-h-56 bg-muted/30 font-mono text-[0.9375rem] leading-7 placeholder:text-muted-foreground/60"
          />
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <SubmitButton variant="gradient-outline">Save profile</SubmitButton>
      </div>
    </ActionForm>
  );
}
