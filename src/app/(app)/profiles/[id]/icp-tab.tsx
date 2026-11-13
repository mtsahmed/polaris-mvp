import { CheckCircle2, History, Sparkles, UsersRound } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { brand } from "@/config/brand";
import type { Icp, Profile } from "@/lib/types";
import { approveIcp, draftIcpWithClaude, saveIcp } from "../actions";

const LIST_FIELDS = [
  { key: "industries", label: "Industries", hint: "Required" },
  { key: "company_traits", label: "Company traits", hint: "Size, stage, budget signals" },
  { key: "geographies", label: "Geographies" },
  { key: "titles", label: "Decision-maker titles", hint: "Required" },
  { key: "problems_addressed", label: "Problems addressed" },
] as const;

// Equal, fixed-height boxes (scroll inside, drag the corner to enlarge) keep the ICP on about one screen.
const ICP_BOX = "field-sizing-fixed h-56 resize-y text-[0.9375rem] leading-6";

export function IcpTab({ profile, icps }: { profile: Profile; icps: Icp[] }) {
  const latest = icps[0];
  const approved = icps.find((i) => i.approved);
  const editingNewVersion = latest?.approved;

  return (
    <div className="space-y-6">
      {/* Ideal customer profile: full width, fields in three columns so most of it fits on one screen. */}
      <Card>
        <CardHeader className="sm:flex sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <CardTitle icon={UsersRound}>Ideal customer profile</CardTitle>
              {latest && (
                <Badge variant={latest.approved ? "default" : "secondary"}>
                  v{latest.version} {latest.approved ? "approved" : "draft"}
                </Badge>
              )}
            </div>
            <CardDescription className="max-w-3xl text-base leading-relaxed">
              The companies and people {brand.productName} looks for in discovery. One item per line.
              {editingNewVersion &&
                " Saving changes creates a new draft version; the approved one stays in force until you approve the new one."}
            </CardDescription>
          </div>
          <ActionForm action={draftIcpWithClaude.bind(null, profile.id)}>
            <SubmitButton pendingLabel="Drafting…">
              <Sparkles /> Draft with AI
            </SubmitButton>
          </ActionForm>
        </CardHeader>
        <CardContent className="space-y-6">
          <ActionForm action={saveIcp.bind(null, profile.id)} className="space-y-5" key={latest?.id ?? "new"}>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {LIST_FIELDS.map((f) => (
                <Field key={f.key} id={f.key} label={f.label} hint={"hint" in f ? f.hint : undefined}>
                  <Textarea
                    id={f.key}
                    name={f.key}
                    rows={5}
                    defaultValue={latest ? latest[f.key].join("\n") : f.key === "geographies" ? "United States" : ""}
                    className={ICP_BOX}
                  />
                </Field>
              ))}
              <Field id="notes" label="Notes and assumptions">
                <Textarea id="notes" name="notes" rows={5} defaultValue={latest?.notes ?? ""} className={ICP_BOX} />
              </Field>
            </div>
            <SubmitButton>Save draft</SubmitButton>
          </ActionForm>

          {latest && !latest.approved && (
            <form
              action={approveIcp.bind(null, profile.id, latest.id)}
              className="flex flex-col gap-4 rounded-2xl border border-gold/50 bg-gold/10 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="max-w-3xl text-base">
                Approving v{latest.version} records you as the approver and makes it the ICP used for discovery.
                Approved versions cannot be edited.
              </p>
              <SubmitButton pendingLabel="Approving…" className="shrink-0">
                <CheckCircle2 /> Approve v{latest.version}
              </SubmitButton>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Version history: last, as a compact grid. */}
      <Card>
        <CardHeader>
          <CardTitle icon={History}>Version history</CardTitle>
          <CardDescription className="text-base">
            {approved
              ? `In force: v${approved.version}, approved ${new Date(approved.approved_at!).toLocaleDateString("en-US")}`
              : "No version approved yet."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {icps.length === 0 ? (
            <p className="text-base text-muted-foreground">No ICP yet. Draft one with AI or fill it in.</p>
          ) : (
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {icps.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-base">
                  <span className="min-w-0 truncate">
                    <span className="font-semibold">v{i.version}</span> ·{" "}
                    {i.industries.slice(0, 2).join(", ") || "No industries"}
                    {i.industries.length > 2 ? "…" : ""}
                  </span>
                  {i.approved ? (
                    <Badge className="shrink-0 bg-success/15 text-success">Approved</Badge>
                  ) : (
                    <Badge variant="secondary" className="shrink-0">
                      Draft
                    </Badge>
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
