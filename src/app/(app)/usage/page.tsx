import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Usage & cost" };

type CallRow = {
  id: string;
  provider: string;
  endpoint: string;
  credits: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_estimate_usd: number | null;
  ok: boolean;
  error: string | null;
  created_at: string;
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const num = new Intl.NumberFormat("en-US");

export default async function UsagePage() {
  const session = await requireSession();
  const supabase = await createClient();

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [{ data: recent }, { data: month }] = await Promise.all([
    supabase
      .from("provider_calls")
      .select("id, provider, endpoint, credits, input_tokens, output_tokens, cost_estimate_usd, ok, error, created_at")
      .eq("org_id", session.org.id)
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<CallRow[]>(),
    supabase
      .from("provider_calls")
      .select("provider, cost_estimate_usd, credits")
      .eq("org_id", session.org.id)
      .gte("created_at", monthStart.toISOString())
      .returns<Pick<CallRow, "provider" | "cost_estimate_usd" | "credits">[]>(),
  ]);

  const totals = new Map<string, { calls: number; cost: number; credits: number }>();
  for (const r of month ?? []) {
    const t = totals.get(r.provider) ?? { calls: 0, cost: 0, credits: 0 };
    t.calls += 1;
    t.cost += Number(r.cost_estimate_usd ?? 0);
    t.credits += Number(r.credits ?? 0);
    totals.set(r.provider, t);
  }
  const monthCost = [...totals.values()].reduce((s, t) => s + t.cost, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow={session.org.name}
        title="Usage & cost"
        description="Every call Polaris makes to an outside provider, with its estimated cost at list prices."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">This month (UTC)</div>
            <div className="mt-1 font-heading text-4xl tabular-nums">{usd.format(monthCost)}</div>
            <div className="text-xs text-muted-foreground">estimated</div>
          </CardContent>
        </Card>
        {[...totals.entries()].map(([provider, t]) => (
          <Card key={provider}>
            <CardContent className="pt-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{provider}</div>
              <div className="mt-1 font-heading text-4xl tabular-nums">{usd.format(t.cost)}</div>
              <div className="text-xs text-muted-foreground">
                {num.format(t.calls)} calls{t.credits ? ` · ${num.format(t.credits)} credits` : ""}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          {!recent?.length ? (
            <p className="text-sm text-muted-foreground">No provider calls yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
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
                      <TableCell className="whitespace-nowrap text-xs">{new Date(r.created_at).toLocaleString("en-US")}</TableCell>
                      <TableCell>{r.provider}</TableCell>
                      <TableCell className="font-mono text-xs">{r.endpoint}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
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
