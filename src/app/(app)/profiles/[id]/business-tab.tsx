import { Building2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, NativeSelect } from "@/components/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PROFILE_TYPES, type Profile } from "@/lib/types";
import { updateBusinessInfo } from "../actions";

// Business info, the first tab (owner review, 18 Nov 2026): only the Basics card.
export function BusinessTab({ profile }: { profile: Profile }) {
  return (
    <ActionForm action={updateBusinessInfo.bind(null, profile.id)} className="space-y-6">
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
      <div className="flex justify-end">
        <SubmitButton variant="gradient-outline">Save business info</SubmitButton>
      </div>
    </ActionForm>
  );
}
