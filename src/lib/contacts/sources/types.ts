import type { VerificationStatus } from "@/lib/types";

// What any contact source hands back. Saving, de-duplication and stage changes happen in one
// place (jobs.ts), so a new source (Google Places, a CRM) only has to produce these.
export type FoundContact = {
  name: string;
  title: string | null;
  email: string | null;
  emailStatus: VerificationStatus;
  emailUnconfirmed?: boolean; // reported, but not found on the cited page
  phone: string | null; // office or main line
  mobile: string | null;
  whatsapp: string | null;
  source: string; // "Apollo", "Web: naturahq.com"
  sourceUrl: string | null;
  apolloId?: string | null;
  linkedinUrl?: string | null;
};

export type SourceContext = {
  orgId: string;
  companyName: string;
  domain: string | null;
  website: string | null;
  location: string | null;
  roles: string[]; // job titles to approach, best first
};

export type SourceResult = {
  outcome: "found" | "none" | "skipped" | "failed";
  contacts: FoundContact[];
  dropped?: number; // phone or WhatsApp numbers not found on their source page (not saved)
  unconfirmed?: number; // emails not found on their source page (saved as not confirmed)
  checks?: string[]; // why each of those was not confirmed
  note?: string; // shown on the Contacts page, e.g. "Apollo's Free plan has no API access"
};
