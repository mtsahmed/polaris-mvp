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
  notes: string | null;
  approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
};
