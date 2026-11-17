import { z } from "zod";
import { clampInputs } from "@/lib/impact/model";
import { createClient } from "@/lib/supabase/server";

// Landing-page lead magnet: saves the visitor's name, email and calculator scenario, then returns
// the link to their one-page PDF (GET /api/impact-report/<id>). Visitors are signed out; the
// database function submit_impact_lead() does the insert (migration 20261125000000_impact_leads.sql).

const Body = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120, "That name is too long."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  company: z.string().trim().max(160).optional().default(""),
  goal: z.enum(["partnerships", "customers"]),
  inputs: z.record(z.string(), z.unknown()).default({}),
  elapsedMs: z.number().optional(), // ms between the form appearing and being sent
});

export async function POST(request: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch (e) {
    const message = e instanceof z.ZodError ? (e.issues[0]?.message ?? "Check the form.") : "Check the form.";
    return Response.json({ error: message }, { status: 400 });
  }
  // People take longer than 2 seconds to fill in the form; scripts usually do not.
  if (!body.elapsedMs || body.elapsedMs < 2000) return Response.json({ error: "Could not create the report." }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_impact_lead", {
    lead_name: body.name,
    lead_email: body.email,
    lead_company: body.company,
    lead_goal: body.goal,
    lead_inputs: clampInputs(body.inputs),
  });
  if (error) {
    // PGRST202: the function does not exist yet (migration not run).
    const message =
      error.code === "PGRST202"
        ? "Reports are not set up yet. Run supabase/migrations/20261125000000_impact_leads.sql."
        : error.message.startsWith("Too many reports")
          ? error.message
          : "Could not create the report. Try again in a moment.";
    return Response.json({ error: message }, { status: error.code === "PGRST202" ? 503 : 400 });
  }
  const id = data as string;
  return Response.json({ id, url: `/api/impact-report/${id}` });
}
