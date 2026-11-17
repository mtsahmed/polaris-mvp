// Row types for the tables used so far. Replace with `supabase gen types` output once the project is linked.

export type MemberRole = "owner" | "admin" | "member";

export const PROFILE_TYPES = [
  { value: "media_creative_business", label: "Media / creative business", tuned: true },
  { value: "creator", label: "Creator", tuned: false },
  { value: "athlete", label: "Athlete", tuned: false },
  { value: "agency", label: "Agency", tuned: false },
  { value: "real_estate", label: "Real estate", tuned: false },
  { value: "legal", label: "Legal", tuned: false },
  { value: "other", label: "Other", tuned: false },
] as const;

export type ProfileType = (typeof PROFILE_TYPES)[number]["value"];

export type Organization = { id: string; name: string };

export type Evidence = { claim: string; source: string; quote?: string };

export type ProfileIntelligence = {
  positioning: string;
  services: string[];
  audience: string;
  strengths: string[];
  objectives: string[];
  evidence: Evidence[];
  gaps: string[];
  model: string;
  provider?: "anthropic" | "openai";
  source_ids: string[];
};

export type Profile = {
  id: string;
  org_id: string;
  type: ProfileType;
  name: string;
  website: string | null;
  positioning: string | null;
  services: string[];
  audience: string | null;
  strengths: string[];
  objectives: string[];
  voice_samples: string[];
  intelligence: ProfileIntelligence | null;
  intelligence_generated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SourceKind = "url" | "file" | "questionnaire";
export type SourceStatus = "pending" | "processing" | "ready" | "failed";

export type ProfileSource = {
  id: string;
  org_id: string;
  profile_id: string;
  kind: SourceKind;
  location: string;
  title: string | null;
  extracted_text: string | null;
  status: SourceStatus;
  error: string | null;
  created_at: string;
};

export type Icp = {
  id: string;
  org_id: string;
  profile_id: string;
  version: number;
  industries: string[];
  company_traits: string[];
  geographies: string[];
  titles: string[];
  problems_addressed: string[];
  // Knockouts: a company that matches one is "Not a fit" whatever its score.
  excluded_geographies: string[];
  competitors: string[];
  min_employees: number | null;
  notes: string | null;
  approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Pitch studio
// ---------------------------------------------------------------------------

export type Company = {
  id: string;
  org_id: string;
  name: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  location: string | null;
  summary: string | null;
  created_at: string;
};

export type Signal = {
  id: string;
  company_id: string;
  type: string;
  summary: string;
  source_url: string;
  source_date: string | null;
  quote: string | null;
  retrieved_at: string;
  search_provider: string;
};

export type PipelineStage =
  | "new_lead"
  | "researching"
  | "ready_to_pitch"
  | "contacted"
  | "replied"
  | "meeting_booked"
  | "won"
  | "lost";

export type ProspectStatus = "suggested" | "saved" | "rejected";

export type ProspectDecision = "none" | "pursue" | "hold" | "skip";

export type Prospect = {
  id: string;
  org_id: string;
  profile_id: string;
  company_id: string;
  stage: PipelineStage;
  status: ProspectStatus;
  notes: string | null;
  research_gaps: string[];
  researched_at: string | null;
  research_model: string | null;
  fit_summary: string | null;
  discovered_at: string | null;
  discovery_model: string | null;
  discovery_focus: string | null;
  shortlisted_at: string | null;
  decision: ProspectDecision;
  decided_by: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  created_at: string;
  updated_at: string;
};

export const DEAL_TYPES = ["partnership", "customer", "referral", "co_marketing"] as const;
export type DealType = (typeof DEAL_TYPES)[number];

export type Concept = {
  id: string;
  prospect_id: string;
  title: string;
  description: string;
  commercial_rationale: string | null;
  deal_type: DealType | null;
  deal_angle: string | null;
  signal_ids: string[];
  selected: boolean;
  model: string | null;
  created_at: string;
};

export type PitchKind = "first_contact" | "follow_up" | "call_talking_points";
export type PitchStatus = "draft" | "approved" | "sent" | "done";

export type Pitch = {
  id: string;
  prospect_id: string;
  concept_id: string | null;
  channel: "email" | "call" | "text" | "whatsapp";
  kind: PitchKind;
  subject: string | null;
  body: string;
  status: PitchStatus;
  approved_by: string | null;
  approved_at: string | null;
  sent_at: string | null;
  sent_by: string | null;
  contact_id: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Contacts and outreach
// ---------------------------------------------------------------------------

export type VerificationStatus = "verified" | "unverified" | "missing";
export type OutreachChannel = "email" | "call" | "text" | "whatsapp";

export type Contact = {
  id: string;
  org_id: string;
  company_id: string;
  name: string;
  title: string | null;
  email: string | null;
  email_status: VerificationStatus;
  // true when the AI search reported the email but Polaris did not find it on the cited page
  // (it may be guessed): shown as "Not confirmed" and never picked as the default recipient.
  email_unconfirmed: boolean;
  phone: string | null;
  whatsapp: string | null;
  mobile: string | null;
  mobile_status: VerificationStatus;
  outreach_method: OutreachChannel;
  consent_to_message: "yes" | "no" | "unknown";
  source: string;
  retrieved_at: string;
  apollo_id: string | null;
  linkedin_url: string | null;
  source_url: string | null;
  notes: string | null;
  created_at: string;
};

export type ContactJobStatus = "queued" | "running" | "done" | "failed";

// One source's part of a contact-finding run, shown on the Contacts page.
export type ContactJobStep = {
  source: "recheck" | "apollo" | "site" | "web";
  outcome: "found" | "none" | "skipped" | "failed";
  saved: number;
  dropped?: number; // phone or WhatsApp numbers not found on their page (not saved)
  unconfirmed?: number; // emails not found on their page (saved, marked "Not confirmed")
  checks?: string[]; // one line per unconfirmed or dropped detail, with the reason
  note?: string;
};

export type ContactJob = {
  id: string;
  org_id: string;
  prospect_id: string;
  status: ContactJobStatus;
  trigger: "pursue" | "bulk" | "retry";
  summary: ContactJobStep[];
  saved_count: number;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export const OUTREACH_EVENT_TYPES = ["sent", "reply", "call", "message", "meeting", "bounce", "note"] as const;
export type OutreachEventType = (typeof OUTREACH_EVENT_TYPES)[number];

export type OutreachEvent = {
  id: string;
  org_id: string;
  prospect_id: string | null;
  pitch_id: string | null;
  contact_id: string | null;
  channel: OutreachChannel;
  type: OutreachEventType;
  outcome: string | null;
  note: string | null;
  occurred_at: string;
};

export type Task = {
  id: string;
  org_id: string;
  prospect_id: string;
  pitch_id: string | null;
  title: string;
  due_date: string | null;
  done: boolean;
  done_at: string | null;
  created_at: string;
};
