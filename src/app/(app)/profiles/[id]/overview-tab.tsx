import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, NativeSelect } from "@/components/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PROFILE_TYPES, type Profile } from "@/lib/types";
import { updateProfile } from "../actions";

export function OverviewTab({ profile }: { profile: Profile }) {
  return (
    <ActionForm action={updateProfile.bind(null, profile.id)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
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
          <CardTitle>Positioning</CardTitle>
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
          <CardTitle>Voice samples</CardTitle>
          <CardDescription>
            Paste two or three emails or posts the owner actually wrote. Pitches are written to match this
            voice. Separate samples with a line containing only <code>---</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            id="voice_samples"
            name="voice_samples"
            rows={10}
            defaultValue={profile.voice_samples.join("\n---\n")}
            aria-label="Voice samples"
          />
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <SubmitButton className="shadow-lg">Save profile</SubmitButton>
      </div>
    </ActionForm>
  );
}
