import { toCsv } from "@/lib/contacts/csv";
import { STAGE_LABEL } from "@/lib/outreach/rules";
import { activeProfile } from "@/lib/profile-selection";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Company, Contact, Prospect } from "@/lib/types";

// Downloads the selected profile's contacts (companies marked pursue) as a CSV file. Reads go
// through the signed-in user's session, so row-level security applies.
export async function GET() {
  await requireSession();
  const { active } = await activeProfile();
  if (!active) return new Response("Create a profile first.", { status: 400 });
  const supabase = await createClient();

  const { data: prospects, error } = await supabase
    .from("prospects")
    .select("company_id, stage, companies ( name, domain )")
    .eq("profile_id", active.id)
    .eq("decision", "pursue")
    .neq("status", "rejected")
    .returns<(Pick<Prospect, "company_id" | "stage"> & { companies: Pick<Company, "name" | "domain"> | null })[]>();
  if (error) return new Response(error.message, { status: 500 });
  const byCompany = new Map((prospects ?? []).map((p) => [p.company_id, p]));
  const { data: contacts, error: cErr } = byCompany.size
    ? await supabase.from("contacts").select("*").in("company_id", [...byCompany.keys()]).order("created_at").returns<Contact[]>()
    : { data: [] as Contact[], error: null };
  if (cErr) return new Response(cErr.message, { status: 500 });

  const csv = toCsv(
    ["Company", "Domain", "Stage", "Name", "Title", "Email", "Email status", "Email confirmed on page", "Phone", "Mobile", "WhatsApp", "Source", "Source URL", "Found on"],
    (contacts ?? []).map((c) => {
      const p = byCompany.get(c.company_id);
      return [
        p?.companies?.name,
        p?.companies?.domain,
        p ? STAGE_LABEL[p.stage] : "",
        c.name,
        c.title,
        c.email,
        c.email_status,
        c.email ? (c.email_unconfirmed ? "no" : "yes") : "",
        c.phone,
        c.mobile,
        c.whatsapp,
        c.source,
        c.source_url,
        c.retrieved_at.slice(0, 10),
      ];
    }),
  );
  const file = `polaris-contacts-${active.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${file}"`,
      "cache-control": "no-store",
    },
  });
}
