import type { NextRequest } from "next/server";
import { clampInputs } from "@/lib/impact/model";
import { buildImpactReport, type ReportGoal } from "@/lib/impact/report-pdf";
import { createClient } from "@/lib/supabase/server";

// Downloads one impact report as a PDF. The id is a random UUID returned only to the visitor who
// submitted the form, so it works as their private download link.
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/impact-report/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return new Response("Report not found.", { status: 404 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("impact_report", { report_id: id });
  const row = (data as { name: string; company: string | null; goal: ReportGoal; inputs: Record<string, unknown>; created_at: string }[] | null)?.[0];
  if (error || !row) return new Response("Report not found.", { status: 404 });

  const pdf = await buildImpactReport({
    name: row.name,
    company: row.company,
    goal: row.goal,
    inputs: clampInputs(row.inputs),
    createdAt: new Date(row.created_at),
  });
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="polaris-pipeline-impact-scenario.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
