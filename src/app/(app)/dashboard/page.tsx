import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarClock } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { STAGE_LABEL, STAGE_ORDER } from "@/lib/outreach/rules";
import { activeProfile } from "@/lib/profile-selection";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Company, PipelineStage, Prospect, Task } from "@/lib/types";
import { setStage } from "../outreach/actions";

export const metadata: Metadata = { title: "Dashboard" };

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const day = (v: string) => dateFmt.format(new Date(`${v}T12:00:00`));

// Owner review (17 Nov 2026): two rows of four, the first four stages on top and the last four
// below; each block shows its total and the five most recently updated companies.
const TOP: PipelineStage[] = ["new_lead", "researching", "ready_to_pitch", "contacted"];
const BOTTOM: PipelineStage[] = ["replied", "meeting_booked", "won", "lost"];
const SHOWN = 5;

type Row = Pick<Prospect, "id" | "stage" | "decision" | "updated_at"> & { companies: Pick<Company, "name" | "domain"> | null };

// Every shortlisted company for the selected profile, by pipeline stage (roadmap section 5).
// Stages move automatically from outreach events; a stage can also be set on a stage's full list
// (?stage=), which is also where Won and Lost are set.
export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const { stage: rawStage } = await props.searchParams;
  const stage = STAGE_ORDER.find((s) => s === rawStage) ?? null;

  const { active } = await activeProfile();
  if (!active) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader eyebrow="Dashboard" title="Dashboard" />
        <p className="text-base text-muted-foreground">Create a profile first.</p>
      </div>
    );
  }
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("prospects")
    .select("id, stage, decision, updated_at, companies ( name, domain )")
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
  const inStage = (s: PipelineStage) => prospects.filter((p) => p.stage === s);

  if (stage) {
    return <StageList stage={stage} rows={inStage(stage)} nextTask={nextTask} today={today} profileName={active.name} />;
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Dashboard"
        title="Dashboard"
        description={`Every company shortlisted for ${active.name}, by stage.`}
      />
      <p className={cn("mb-5 flex items-center gap-2 text-sm", due ? "font-medium text-destructive" : "text-muted-foreground")}>
        <CalendarClock className="size-4" aria-hidden="true" />
        {prospects.length} {prospects.length === 1 ? "company" : "companies"} ·{" "}
        {due ? `${due} follow-up${due === 1 ? "" : "s"} due today or overdue` : "no follow-ups due today"}
      </p>
      <div className="space-y-4">
        {[TOP, BOTTOM].map((row, i) => (
          <div key={i} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {row.map((s) => (
              <StageBlock key={s} stage={s} rows={inStage(s)} nextTask={nextTask} today={today} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DueLine({ task, today }: { task: Task | undefined; today: string }) {
  if (!task?.due_date) return null;
  const overdue = task.due_date < today;
  return (
    <span className={cn("shrink-0 text-[13px] whitespace-nowrap", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
      {overdue ? "Overdue" : "Due"} {day(task.due_date)}
    </span>
  );
}

function StageBlock({
  stage,
  rows,
  nextTask,
  today,
}: {
  stage: PipelineStage;
  rows: Row[];
  nextTask: Map<string, Task>;
  today: string;
}) {
  return (
    <section
      aria-labelledby={`stage-${stage}`}
      className="flex flex-col rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <header className="flex items-baseline justify-between gap-2">
        <h2 id={`stage-${stage}`} className="text-sm font-semibold tracking-wide text-stage-blue uppercase">
          {STAGE_LABEL[stage]}
        </h2>
        <span className="font-heading text-3xl font-semibold tabular-nums">{rows.length}</span>
      </header>
      {/* Owner review (17 Nov 2026): a bold 5px blue rule (--stage-blue) under each block's heading. */}
      <div aria-hidden="true" className="mt-3 mb-1 h-[5px] rounded-full bg-stage-blue" />
      {rows.length ? (
        <ul className="flex-1 divide-y divide-border/50">
          {rows.slice(0, SHOWN).map((p) => (
            <li key={p.id} className="flex items-baseline justify-between gap-2 py-2">
              <Link href={`/intelligence/${p.id}`} className="truncate text-sm font-medium hover:text-brand hover:underline">
                {p.companies?.name ?? "Company"}
              </Link>
              <DueLine task={nextTask.get(p.id)} today={today} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex-1 py-3 text-[13px] text-muted-foreground/75 italic">None yet</p>
      )}
      {rows.length > 0 && (
        <Link
          href={`/dashboard?stage=${stage}`}
          className="mt-2 inline-flex items-center gap-1 self-start text-[13px] font-medium text-brand hover:underline"
        >
          {rows.length > SHOWN ? `View all (${rows.length})` : "View list"} <ArrowRight className="size-3.5" />
        </Link>
      )}
    </section>
  );
}

// One stage's full list, where a company can be moved to another stage (no drag and drop).
function StageList({
  stage,
  rows,
  nextTask,
  today,
  profileName,
}: {
  stage: PipelineStage;
  rows: Row[];
  nextTask: Map<string, Task>;
  today: string;
  profileName: string;
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 text-sm">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Dashboard
        </Link>
      </div>
      <PageHeader
        eyebrow="Dashboard"
        title={`${STAGE_LABEL[stage]} (${rows.length})`}
        description={`Companies shortlisted for ${profileName} at this stage, most recently updated first.`}
      />
      {rows.length === 0 ? (
        <p className="text-base text-muted-foreground">No companies at this stage.</p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-2xl border bg-card">
          {rows.map((p) => {
            const task = nextTask.get(p.id);
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-48 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{p.companies?.name ?? "Company"}</span>
                    {p.decision !== "none" && (
                      <Badge variant="outline" className="capitalize">
                        {p.decision}
                      </Badge>
                    )}
                  </div>
                  {task && (
                    <p className="text-[13px] text-muted-foreground">
                      {task.title} · <DueLine task={task} today={today} />
                    </p>
                  )}
                </div>
                <div className="flex gap-3 text-[13px] font-medium">
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
                <ActionForm action={setStage.bind(null, p.id)} className="flex items-center gap-1.5">
                  <label className="sr-only" htmlFor={`move-${p.id}`}>
                    Move {p.companies?.name} to stage
                  </label>
                  <select
                    id={`move-${p.id}`}
                    name="stage"
                    defaultValue={p.stage}
                    className="h-8 rounded-lg border bg-transparent px-2 text-[13px]"
                  >
                    {STAGE_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STAGE_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <SubmitButton variant="ghost" className="h-8 px-3 text-[13px]" pendingLabel="Moving…">
                    Move
                  </SubmitButton>
                </ActionForm>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
