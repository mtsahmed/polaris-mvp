import { CheckCircle2, Sparkles } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { Icp, Profile } from "@/lib/types";
import { approveIcp, draftIcpWithClaude, saveIcp } from "../actions";

const LIST_FIELDS = [
  { key: "industries", label: "Industries", hint: "Required" },
  { key: "company_traits", label: "Company traits", hint: "Size, stage, budget signals" },
  { key: "geographies", label: "Geographies" },
  { key: "titles", label: "Decision-maker titles", hint: "Required" },
  { key: "problems_addressed", label: "Problems addressed" },
] as const;

export function IcpTab({ profile, icps }: { profile: Profile; icps: Icp[] }) {
  const latest = icps[0];
  const approved = icps.find((i) => i.approved);
  const editingNewVersion = latest?.approved;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader className="sm:flex sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              Ideal customer profile
              {latest && (
                <Badge variant={latest.approved ? "default" : "secondary"}>
                  v{latest.version} {latest.approved ? "approved" : "draft"}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              The companies and people Polaris looks for in discovery. One item per line.
              {editingNewVersion && " Saving changes creates a new draft version; the approved one stays in force until you approve the new one."}
            </CardDescription>
          </div>
          <ActionForm action={draftIcpWithClaude.bind(null, profile.id)}>
            <SubmitButton variant="outline" pendingLabel="Drafting…">
              <Sparkles /> Draft with AI
            </SubmitButton>
          </ActionForm>
        </CardHeader>
        <CardContent>
          <ActionForm action={saveIcp.bind(null, profile.id)} className="space-y-5" key={latest?.id ?? "new"}>
            <div className="grid gap-5 sm:grid-cols-2">
              {LIST_FIELDS.map((f) => (
                <Field key={f.key} id={f.key} label={f.label} hint={"hint" in f ? f.hint : undefined}>
                  <Textarea id={f.key} name={f.key} rows={5} defaultValue={latest ? latest[f.key].join("\n") : f.key === "geographies" ? "United States" : ""} />
                </Field>
              ))}
            </div>
            <Field id="notes" label="Notes and assumptions">
              <Textarea id="notes" name="notes" rows={3} defaultValue={latest?.notes ?? ""} />
            </Field>
            <SubmitButton>Save draft</SubmitButton>
          </ActionForm>

          {latest && !latest.approved && (
            <form action={approveIcp.bind(null, profile.id, latest.id)} className="mt-6 rounded-lg border border-gold/40 bg-accent/40 p-4">
              <p className="mb-3 text-sm">
                Approving v{latest.version} records you as the approver and makes it the ICP used for discovery. Approved
                versions cannot be edited.
              </p>
              <SubmitButton pendingLabel="Approving…">
                <CheckCircle2 /> Approve v{latest.version}
              </SubmitButton>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="self-start">
        <CardHeader>
          <CardTitle>Version history</CardTitle>
          <CardDescription>
            {approved ? `In force: v${approved.version}, approved ${new Date(approved.approved_at!).toLocaleDateString("en-US")}` : "No version approved yet."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {icps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ICP yet. Draft one with Claude or fill it in.</p>
          ) : (
            <ol className="space-y-3">
              {icps.map((i) => (
                <li key={i.id} className="flex items-center justify-between text-sm">
                  <span>
                    v{i.version} · {i.industries.slice(0, 2).join(", ") || "No industries"}
                    {i.industries.length > 2 ? "…" : ""}
                  </span>
                  {i.approved ? (
                    <Badge className="bg-success/15 text-success">Approved</Badge>
                  ) : (
                    <Badge variant="secondary">Draft</Badge>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
