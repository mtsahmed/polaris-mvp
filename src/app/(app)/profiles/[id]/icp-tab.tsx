import { Ban, CheckCircle2, History, Sparkles, UsersRound } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AiStreamForm } from "@/components/ai-stream-form";
import { Field } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListTextarea } from "@/components/list-textarea";
import { Textarea } from "@/components/ui/textarea";
import { brand } from "@/config/brand";
import type { Icp, Profile } from "@/lib/types";
import { approveIcp, saveIcp } from "../actions";

// Grey examples show while a box is empty and fade when it is clicked (owner review, 18 Nov 2026).
// They are placeholders only, so an example can never be saved by accident.
const LIST_FIELDS = [
  {
    key: "industries",
    label: "Industries",
    hint: "Required. The kinds of companies to approach; each line becomes a segment on the Dashboard.",
    example: "e.g.\nDirect-to-consumer beauty brands\nIndependent music labels\nB2B software for creative teams",
  },
  {
    key: "company_traits",
    label: "Company traits",
    hint: "Size, stage, budget signals",
    example: "e.g.\n20–200 employees\nRaised funding in the last two years\nRuns paid social campaigns",
  },
  { key: "geographies", label: "Geographies", hint: "Countries, states or cities", example: "e.g.\nUnited States\nCanada" },
  {
    key: "titles",
    label: "Decision-maker titles",
    hint: "Required. Who signs off on what you offer.",
    example: "e.g.\nHead of Marketing\nBrand Partnerships Manager\nFounder / CEO",
  },
  {
    key: "problems_addressed",
    label: "Problems addressed",
    hint: "What they struggle with that you solve",
    example: "e.g.\nCampaigns feel generic and underperform\nNo in-house video team\nLaunching in a new market",
  },
] as const;

const NOTES_EXAMPLE = "e.g.\nAssumes project budgets above $10k\nSkip agencies that compete with us";
const FADE =
  "placeholder:text-muted-foreground/55 placeholder:transition-opacity placeholder:duration-300 focus:placeholder:opacity-0";

// Equal, fixed-height boxes (scroll inside, drag the corner to enlarge) keep the ICP on about one screen.
const ICP_BOX = "field-sizing-fixed h-56 resize-y text-[0.9375rem] leading-6";

// Changes whenever the latest ICP's content changes, so a dropped connection can tell when the
// AI draft has been saved (an unapproved draft is updated in place, so its id stays the same).
function icpKey(icp: Icp) {
  return [icp.id, ...icp.industries, ...icp.company_traits, ...icp.geographies, ...icp.titles, ...icp.problems_addressed, icp.notes ?? ""].join("|");
}

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
          <AiStreamForm
            task="icp-draft"
            fields={{ profileId: profile.id }}
            resultKey={latest ? icpKey(latest) : ""}
            working="Polaris is drafting the ideal customer profile…"
            note="Up to a minute."
            panelClassName="max-w-xs"
          >
            <SubmitButton variant="gradient-outline" working pendingLabel="Drafting…">
              <Sparkles /> Draft with AI
            </SubmitButton>
          </AiStreamForm>
        </CardHeader>
        <CardContent className="space-y-6">
          <ActionForm action={saveIcp.bind(null, profile.id)} className="space-y-5" key={latest?.id ?? "new"}>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {LIST_FIELDS.map((f) => (
                <Field key={f.key} id={f.key} label={f.label} hint={f.hint}>
                  <ListTextarea
                    id={f.key}
                    name={f.key}
                    rows={5}
                    defaultValue={latest ? latest[f.key].join("\n") : f.key === "geographies" ? "United States" : ""}
                    placeholder={f.example}
                    className={ICP_BOX}
                  />
                </Field>
              ))}
              <Field id="notes" label="Notes and assumptions" hint="Anything the search should keep in mind">
                <Textarea
                  id="notes"
                  name="notes"
                  rows={5}
                  defaultValue={latest?.notes ?? ""}
                  placeholder={NOTES_EXAMPLE}
                  className={`${ICP_BOX} ${FADE}`}
                />
              </Field>
            </div>

            {/* Knockouts: hard "not a fit" rules for Intelligence briefs. */}
            <fieldset className="space-y-4 rounded-2xl border border-dashed p-5">
              <legend className="flex items-center gap-2 px-2 font-semibold">
                <Ban className="size-4 text-brand" aria-hidden="true" /> Not a fit if…
              </legend>
              <p className="text-sm text-muted-foreground">
                A company that matches one of these is marked &ldquo;Not a fit&rdquo; in Intelligence whatever its score, and
                only when a source shows it. Direct competitors are always checked. Leave a field empty to skip that check.
              </p>
              <div className="grid gap-5 md:grid-cols-3">
                <Field id="excluded_geographies" label="Excluded geographies" hint="One per line, e.g. Canada">
                  <Textarea
                    id="excluded_geographies"
                    name="excluded_geographies"
                    rows={3}
                    defaultValue={latest?.excluded_geographies?.join("\n") ?? ""}
                    placeholder={"e.g.\nCanada\nMexico"}
                    className={`field-sizing-fixed h-28 resize-y text-[0.9375rem] leading-6 ${FADE}`}
                  />
                </Field>
                <Field id="competitors" label="Competitors" hint="Company names, one per line">
                  <Textarea
                    id="competitors"
                    name="competitors"
                    rows={3}
                    defaultValue={latest?.competitors?.join("\n") ?? ""}
                    placeholder={"e.g.\nNorthlight Studio"}
                    className={`field-sizing-fixed h-28 resize-y text-[0.9375rem] leading-6 ${FADE}`}
                  />
                </Field>
                <Field id="min_employees" label="Minimum company size" hint="Employees. Smaller companies are not a fit.">
                  <Input
                    id="min_employees"
                    name="min_employees"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    defaultValue={latest?.min_employees ?? ""}
                    placeholder="e.g. 20"
                    className={FADE}
                  />
                </Field>
              </div>
            </fieldset>
            <SubmitButton variant="gradient-outline">Save draft</SubmitButton>
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
              <SubmitButton variant="gradient-outline" pendingLabel="Approving…" className="shrink-0">
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
