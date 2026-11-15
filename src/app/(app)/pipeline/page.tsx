import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { STAGE_LABEL, STAGE_ORDER } from "@/lib/outreach/rules";
import { activeProfile } from "@/lib/profile-selection";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Company, Prospect, Task } from "@/lib/types";
import { setStage } from "../outreach/actions";

export const metadata: Metadata = { title: "Pipeline" };

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const day = (v: string) => dateFmt.format(new Date(`${v}T12:00:00`));

type Row = Pick<Prospect, "id" | "stage" | "decision" | "shortlisted_at"> & { companies: Pick<Company, "name" | "domain"> | null };

// Every shortlisted company for the selected profile, by pipeline stage (roadmap section 5), with
// the next task due. Stages move automatically from outreach events; Won and Lost are set here.
export default async function PipelinePage() {
  const { active } = await activeProfile();
  if (!active) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader eyebrow="Pipeline" title="Pipeline" />
        <p className="text-base text-muted-foreground">Create a profile first.</p>
      </div>
    );
  }
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("prospects")
    .select("id, stage, decision, shortlisted_at, companies ( name, domain )")
    .eq("profile_id", active.id)
    .eq("status", "saved")
    .order("updated_at", { ascending: false })
    .returns<Row[]>();
  if (error) throw new Error(error.message);
  const prospects = rows ?? [];
  const ids = prospects.map((p) => p.id);
  const { data: taskRows } = ids.length
    ? await supabase.from("tasks").select("*").in("prospect_id", ids).eq("done", false).order("due_date").returns<Task[]>()
    : { data: [] as Task[] };
  const nextTask = new Map<string, Task>();
  for (const t of taskRows ?? []) if (!nextTask.has(t.prospect_id)) nextTask.set(t.prospect_id, t);
  const today = new Date().toISOString().slice(0, 10);
  const due = (taskRows ?? []).filter((t) => t.due_date && t.due_date <= today).length;

  return (
    <div className="mx-auto max-w-[96rem]">
      <PageHeader
        eyebrow="Pipeline"
        title="Pipeline"
        description={`Every company shortlisted for ${active.name}, by stage. ${due ? `${due} follow-up${due === 1 ? "" : "s"} due today or overdue.` : "No follow-ups due today."}`}
      />
      <div className="overflow-x-auto pb-4">
        <div className="grid min-w-[72rem] grid-cols-8 gap-3">
          {STAGE_ORDER.map((stage) => {
            const cards = prospects.filter((p) => p.stage === stage);
            return (
              <section key={stage} aria-labelledby={`col-${stage}`} className="rounded-2xl bg-muted/50 p-2">
                <h2 id={`col-${stage}`} className="flex items-center justify-between px-2 py-1.5 text-sm font-semibold">
                  {STAGE_LABEL[stage]}
                  <span className="text-muted-foreground tabular-nums">{cards.length}</span>
                </h2>
                <ul className="space-y-2">
                  {cards.map((p) => {
                    const task = nextTask.get(p.id);
                    const overdue = task?.due_date ? task.due_date < today : false;
                    return (
                      <li key={p.id}>
                        <Card className="gap-0 py-0">
                          <CardContent className="space-y-2 p-3">
                            <div>
                              <div className="leading-snug font-semibold">{p.companies?.name ?? "Company"}</div>
                              {p.companies?.domain && <div className="text-[13px] text-muted-foreground">{p.companies.domain}</div>}
                            </div>
                            {p.decision !== "none" && (
                              <Badge variant="outline" className="capitalize">
                                {p.decision}
                              </Badge>
                            )}
                            {task && (
                              <p className={cn("flex items-start gap-1.5 text-[13px]", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                                <CalendarClock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                                <span>
                                  {overdue ? "Overdue" : "Due"} {task.due_date ? day(task.due_date) : ""}: {task.title}
                                </span>
                              </p>
                            )}
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] font-medium">
                              <Link href={`/intelligence/${p.id}`} className="text-brand hover:underline">
                                Brief
                              </Link>
                              <Link href={`/pitch/${p.id}`} className="text-brand hover:underline">
                                Pitch
                              </Link>
                              <Link href="/outreach" className="text-brand hover:underline">
                                Outreach
                              </Link>
                            </div>
                            <ActionForm action={setStage.bind(null, p.id)} className="space-y-1">
                              <label className="sr-only" htmlFor={`stage-${p.id}`}>
                                Move {p.companies?.name} to stage
                              </label>
                              <select
                                id={`stage-${p.id}`}
                                name="stage"
                                defaultValue={p.stage}
                                className="h-7 w-full rounded-lg border bg-transparent px-1.5 text-[13px]"
                              >
                                {STAGE_ORDER.map((s) => (
                                  <option key={s} value={s}>
                                    {STAGE_LABEL[s]}
                                  </option>
                                ))}
                              </select>
                              <SubmitButton variant="ghost" className="h-7 w-full px-2 text-[13px]" pendingLabel="Moving…">
                                Move
                              </SubmitButton>
                            </ActionForm>
                          </CardContent>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
