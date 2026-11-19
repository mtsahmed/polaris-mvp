import { PenLine, Target } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field } from "@/components/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { Profile } from "@/lib/types";
import { brand } from "@/config/brand";
import { updateProfileDetails } from "../actions";

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

// The Profile tab, fourth after Business info, Sources and Insights (owner review, 18 Nov 2026):
// positioning and writing samples, which "Apply to profile" on the Insights tab fills in.
export function ProfileDetailsTab({ profile }: { profile: Profile }) {
  return (
    <ActionForm action={updateProfileDetails.bind(null, profile.id)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle icon={Target}>Positioning</CardTitle>
          <CardDescription>
            Fill these in yourself, or generate a sourced draft on the Insights tab and apply it here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field id="positioning" label="Positioning">
            <Textarea
              id="positioning"
              name="positioning"
              rows={3}
              defaultValue={profile.positioning ?? ""}
              placeholder="e.g. An Austin video studio that turns product launches into short-form series for B2B brands."
            />
          </Field>
          <Field id="audience" label="Audience">
            <Textarea
              id="audience"
              name="audience"
              rows={2}
              defaultValue={profile.audience ?? ""}
              placeholder="e.g. Marketing leads at US SaaS companies with 50–500 staff"
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field id="services" label="Services" hint="One per line">
              <Textarea
                id="services"
                name="services"
                rows={6}
                defaultValue={profile.services.join("\n")}
                placeholder={"e.g.\nBrand films\nShort-form social series\nLaunch campaigns"}
              />
            </Field>
            <Field id="strengths" label="Strengths" hint="One per line">
              <Textarea
                id="strengths"
                name="strengths"
                rows={6}
                defaultValue={profile.strengths.join("\n")}
                placeholder={"e.g.\n10 years in B2B video\nIn-house editors\nFast turnaround"}
              />
            </Field>
            <Field id="objectives" label="Objectives" hint="One per line">
              <Textarea
                id="objectives"
                name="objectives"
                rows={6}
                defaultValue={profile.objectives.join("\n")}
                placeholder={"e.g.\nThree new retainer clients this year\nOne brand partnership a quarter"}
              />
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
        <SubmitButton variant="gradient-outline" requireChanges>Save profile</SubmitButton>
      </div>
    </ActionForm>
  );
}
