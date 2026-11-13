import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, NativeSelect } from "@/components/field";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PROFILE_TYPES } from "@/lib/types";
import { createProfile } from "../actions";

export const metadata: Metadata = { title: "New profile" };

export default function NewProfilePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Profiles"
        title="New profile"
        description="Start with the basics. Next you add sources, and Polaris drafts the rest."
      />
      <Card>
        <CardContent className="pt-6">
          <ActionForm action={createProfile} className="space-y-5">
            <Field id="name" label="Name">
              <Input id="name" name="name" required maxLength={160} placeholder="Northlight Studio" />
            </Field>
            <Field
              id="type"
              label="Profile type"
              hint="Version 1 is tuned for media and creative businesses. Other types are stored but not yet tuned."
            >
              <NativeSelect id="type" name="type" defaultValue="media_creative_business">
                {PROFILE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                    {t.tuned ? "" : " (not yet tuned)"}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="website" label="Website" hint="Optional. It becomes the first research source.">
              <Input id="website" name="website" inputMode="url" placeholder="northlight.studio" />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Link href="/profiles" className={buttonVariants({ variant: "ghost" })}>
                Cancel
              </Link>
              <SubmitButton pendingLabel="Creating…">Create profile</SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
