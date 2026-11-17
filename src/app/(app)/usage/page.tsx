import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { MemberRole } from "@/lib/types";

export const metadata: Metadata = { title: "Usage & cost" };

type CallRow = {
  id: string;
  org_id: string;
  provider: string;
  endpoint: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_estimate_usd: number | null;
  ok: boolean;
  error: string | null;
  created_by: string | null;
  created_at: string;
};
// One row per workspace, person and provider, added up in the database (usage_summary).
type SummaryRow = {
  org_id: string;
  created_by: string | null;
  provider: string;
  calls: number | string;
  cost: number | string;
  credits: number | string;
  tokens: number | string;
};
type Person = { id: string; email: string | null; full_name: string | null; role?: MemberRole };
type Workspace = { org_id: string; name: string; members: number | string };
type Totals = { calls: number; cost: number; credits: number; tokens: number };
type Scope = "all" | "workspace" | "mine";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const num = new Intl.NumberFormat("en-US");
const ROLE_LABEL: Record<MemberRole, string> = { owner: "Owner", admin: "Admin", member: "Member" };
const UNKNOWN = "unknown";

const empty = (): Totals => ({ calls: 0, cost: 0, credits: 0, tokens: 0 });
function add(t: Totals, r: SummaryRow) {
  t.calls += Number(r.calls);
  t.cost += Number(r.cost);
  t.credits += Number(r.credits);
  t.tokens += Number(r.tokens);
}

// Three views, each enforced by the database as well (row-level security):
// - Only me: the calls you started (everyone can see this).
// - This workspace: every member's calls in the active workspace (workspace owners and admins).
// - All of Polaris: every user in every workspace (Polaris app admins only).
export default async function UsagePage(props: PageProps<"/usage">) {
  const session = await requireSession();
  const supabase = await createClient();
  const isWorkspaceAdmin = session.role === "owner" || session.role === "admin";
  const { data: appAdminData } = await supabase.rpc("is_platform_admin");
  const isAppAdmin = appAdminData === true;

  const { view } = await props.searchParams;
  const requested = typeof view === "string" ? view : undefined;
  const scope: Scope =
    requested === "all" && isAppAdmin
      ? "all"
      : requested === "mine"
        ? "mine"
        : requested === "workspace" && isWorkspaceAdmin
          ? "workspace"
          : isAppAdmin
            ? "all"
            : isWorkspaceAdmin
              ? "workspace"
              : "mine";

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  let recentQuery = supabase
    .from("provider_calls")
    .select("id, org_id, provider, endpoint, input_tokens, output_tokens, cost_estimate_usd, ok, error, created_by, created_at");
  if (scope !== "all") recentQuery = recentQuery.eq("org_id", session.org.id);
  if (scope === "mine") recentQuery = recentQuery.eq("created_by", session.userId);

  const [{ data: recent }, { data: summaryData }, { data: peopleData }, { data: workspaceData }] = await Promise.all([
    recentQuery.order("created_at", { ascending: false }).limit(100).returns<CallRow[]>(),
    supabase.rpc("usage_summary", {
      since: monthStart.toISOString(),
      target_org: scope === "all" ? null : session.org.id,
      only_user: scope === "mine" ? session.userId : null,
    }),
    scope === "all"
      ? supabase.rpc("platform_users")
      : scope === "workspace"
        ? supabase.rpc("workspace_members", { target_org: session.org.id })
        : Promise.resolve({ data: null }),
    scope === "all" ? supabase.rpc("platform_workspaces") : Promise.resolve({ data: null }),
  ]);
  const summary = (summaryData ?? []) as SummaryRow[];
  const people: Person[] = ((peopleData ?? []) as { user_id: string; email: string | null; full_name: string | null; role?: MemberRole }[]).map(
    (p) => ({ id: p.user_id, email: p.email, full_name: p.full_name, role: p.role }),
  );
  const workspaces = (workspaceData ?? []) as Workspace[];

  // Month totals: overall, per provider, per person, per workspace.
  const overall = empty();
  const byProvider = new Map<string, Totals>();
  const byPerson = new Map<string, Totals>();
  const byWorkspace = new Map<string, Totals>();
  const personById = new Map(people.map((p) => [p.id, p]));
  const workspaceById = new Map(workspaces.map((w) => [w.org_id, w]));
  if (scope === "workspace") for (const p of people) byPerson.set(p.id, empty());
  for (const r of summary) {
    add(overall, r);
    const pv = byProvider.get(r.provider) ?? empty();
    add(pv, r);
    byProvider.set(r.provider, pv);
    const who = r.created_by && personById.has(r.created_by) ? r.created_by : UNKNOWN;
    const pp = byPerson.get(who) ?? empty();
    add(pp, r);
    byPerson.set(who, pp);
    const ws = byWorkspace.get(r.org_id) ?? empty();
    add(ws, r);
    byWorkspace.set(r.org_id, ws);
  }

  const nameOf = (id: string | null) => {
    const p = id ? personById.get(id) : undefined;
    if (!p) return scope === "all" ? "Deleted user or unknown" : "Former member or unknown";
    return p.full_name?.trim() || p.email || "Unnamed user";
  };
  const workspaceName = (id: string) => workspaceById.get(id)?.name ?? "Deleted workspace";
  const personRows = [...byPerson.entries()].sort((a, b) => b[1].cost - a[1].cost);
  const workspaceRows = [...byWorkspace.entries()].sort((a, b) => b[1].cost - a[1].cost);

  const tabs: { scope: Scope; label: string }[] = [
    ...(isAppAdmin ? [{ scope: "all" as const, label: "All of Polaris" }] : []),
    ...(isWorkspaceAdmin ? [{ scope: "workspace" as const, label: "This workspace" }] : []),
    { scope: "mine", label: "Only me" },
  ];
  const headline = { all: "All of Polaris", workspace: "This workspace", mine: "You" }[scope];
  const description = {
    all: "Every call Polaris made to an outside provider, for every user in every workspace, with its estimated cost at list prices.",
    workspace: "Every call Polaris made to an outside provider for this workspace, by everyone, with its estimated cost at list prices.",
    mine: "The calls Polaris made to outside providers for you, with their estimated cost at list prices.",
  }[scope];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow={scope === "all" ? "Polaris admin" : session.org.name} title="Usage & cost" description={description} />

      {tabs.length > 1 ? (
        <div className="mb-6 inline-flex rounded-full border bg-card p-1" role="tablist" aria-label="Whose usage">
          {tabs.map((t) => (
            <Link
              key={t.scope}
              href={`/usage?view=${t.scope}`}
              role="tab"
              aria-selected={t.scope === scope}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                t.scope === scope ? "bg-brand text-white dark:text-brand-ink" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
      ) : (
        <p className="mb-6 text-[13px] italic text-muted-foreground/75">
          Only your own usage is shown. Workspace owners and admins see the totals for everyone.
        </p>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-muted-foreground">{headline}, this month (UTC)</div>
            <div className="mt-2 font-heading text-4xl font-semibold tracking-tight tabular-nums">{usd.format(overall.cost)}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              estimated{overall.tokens ? ` · ${num.format(overall.tokens)} AI tokens` : ""}
            </div>
          </CardContent>
        </Card>
        {[...byProvider.entries()].map(([provider, t]) => (
          <Card key={provider}>
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-muted-foreground">{provider}</div>
              <div className="mt-2 font-heading text-4xl font-semibold tracking-tight tabular-nums">{usd.format(t.cost)}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {num.format(t.calls)} calls{t.credits ? ` · ${num.format(t.credits)} credits` : ""}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {scope === "all" && workspaceRows.length > 0 && (
        <TotalsTable
          title="By workspace, this month"
          first="Workspace"
          rows={workspaceRows.map(([id, t]) => ({
            key: id,
            name: workspaceName(id),
            detail: workspaceById.has(id) ? `${num.format(Number(workspaceById.get(id)!.members))} members` : undefined,
            totals: t,
          }))}
        />
      )}

      {scope !== "mine" && personRows.length > 0 && (
        <TotalsTable
          title="By person, this month"
          first="Person"
          second={scope === "workspace" ? "Role" : undefined}
          rows={personRows.map(([id, t]) => {
            const p = personById.get(id);
            return {
              key: id,
              name: `${id === UNKNOWN ? nameOf(null) : nameOf(id)}${id === session.userId ? " (you)" : ""}`,
              detail: p?.full_name && p.email ? p.email : undefined,
              second: p?.role ? ROLE_LABEL[p.role] : "—",
              totals: t,
            };
          })}
        />
      )}

      <Card>
        <CardContent className="pt-6">
          {!recent?.length ? (
            <p className="text-sm text-muted-foreground">
              {scope === "mine" ? "You have no provider calls yet." : "No provider calls yet."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    {scope !== "mine" && <TableHead>Who</TableHead>}
                    {scope === "all" && <TableHead>Workspace</TableHead>}
                    <TableHead>Provider</TableHead>
                    <TableHead>Call</TableHead>
                    <TableHead className="text-right">Tokens in / out</TableHead>
                    <TableHead className="text-right">Est. cost</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-sm">{new Date(r.created_at).toLocaleString("en-US")}</TableCell>
                      {scope !== "mine" && <TableCell className="whitespace-nowrap text-sm">{nameOf(r.created_by)}</TableCell>}
                      {scope === "all" && <TableCell className="whitespace-nowrap text-sm">{workspaceName(r.org_id)}</TableCell>}
                      <TableCell>{r.provider}</TableCell>
                      <TableCell className="font-mono text-sm">{r.endpoint}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {r.input_tokens != null ? `${num.format(r.input_tokens)} / ${num.format(r.output_tokens ?? 0)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.cost_estimate_usd != null ? usd.format(Number(r.cost_estimate_usd)) : "—"}
                      </TableCell>
                      <TableCell>
                        {r.ok ? (
                          <Badge variant="outline">OK</Badge>
                        ) : (
                          <Badge variant="destructive" title={r.error ?? undefined}>
                            Failed
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TotalsTable({
  title,
  first,
  second,
  rows,
}: {
  title: string;
  first: string;
  second?: string;
  rows: { key: string; name: string; detail?: string; second?: string; totals: Totals }[];
}) {
  return (
    <section className="mb-8 space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="overflow-x-auto rounded-2xl border border-border/60">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>{first}</TableHead>
              {second && <TableHead>{second}</TableHead>}
              <TableHead className="text-right">Calls</TableHead>
              <TableHead className="text-right">AI tokens</TableHead>
              <TableHead className="text-right">Est. cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key} className="border-border/40">
                <TableCell>
                  <div className="font-medium">{r.name}</div>
                  {r.detail && <div className="text-sm text-muted-foreground">{r.detail}</div>}
                </TableCell>
                {second && <TableCell className="text-sm">{r.second ?? "—"}</TableCell>}
                <TableCell className="text-right tabular-nums">{num.format(r.totals.calls)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.totals.tokens ? num.format(r.totals.tokens) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{usd.format(r.totals.cost)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
