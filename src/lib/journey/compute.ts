// Journey status for one profile, computed only from database records (spec sections 3 and 4).
// Pure function: the loader in status.ts reads the rows, this turns them into states and status
// lines. Nothing here is stored.

import type { BriefStatus } from "@/lib/intelligence/types";
import type { PipelineStage, ProspectDecision, ProspectStatus } from "@/lib/types";
import { MILESTONES, type MilestoneKey } from "./milestones";

export type MilestoneState = "complete" | "in_progress" | "not_started" | "attention";

export type Subtask = { label: string; done: boolean; detail?: string };

export type MilestoneStatus = {
  key: MilestoneKey;
  label: string;
  built: boolean;
  state: MilestoneState;
  status: string;
  subtasks: Subtask[];
  // The "minimum before moving on" from spec section 3, and what to say when it is not met.
  minimumMet: boolean;
  missing: string | null;
};

export type JourneyInput = {
  profile: {
    positioning: string | null;
    services: string[];
    audience: string | null;
    objectives: string[];
    voiceSampleCount: number;
    sourceCount: number;
  };
  icps: { version: number; approved: boolean }[];
  prospects: {
    id: string;
    company_id: string;
    status: ProspectStatus;
    stage: PipelineStage;
    discovered_at: string | null;
    shortlisted_at: string | null;
    decision: ProspectDecision;
  }[];
  // Latest brief per prospect.
  briefs: { prospect_id: string; status: BriefStatus; target_role_count: number }[];
  contacts: { company_id: string; has_email: boolean; email_verified: boolean }[];
  concepts: { prospect_id: string; selected: boolean }[];
  pitches: { prospect_id: string; kind: string; status: string }[];
  outreach: { sent: number; replied: number; followUpsDue: number };
};

// Profile fields that must be filled before moving on.
export const REQUIRED_PROFILE_FIELDS = [
  { key: "positioning", label: "positioning" },
  { key: "services", label: "services" },
  { key: "audience", label: "audience" },
  { key: "objectives", label: "objectives" },
] as const;

function filled(v: string | string[] | null) {
  return Array.isArray(v) ? v.length > 0 : Boolean(v && v.trim());
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function computeJourney(input: JourneyInput): MilestoneStatus[] {
  const out = {} as Record<MilestoneKey, Omit<MilestoneStatus, "key" | "label" | "built">>;

  // 1. Profile
  const missingFields = REQUIRED_PROFILE_FIELDS.filter((f) => !filled(input.profile[f.key]));
  out.profile = {
    state: missingFields.length === 0 ? "complete" : missingFields.length < REQUIRED_PROFILE_FIELDS.length ? "in_progress" : "not_started",
    status: missingFields.length === 0 ? "Complete" : `${plural(missingFields.length, "field")} missing`,
    subtasks: [
      { label: "Business details", done: missingFields.length === 0, detail: missingFields.length ? `Missing: ${missingFields.map((f) => f.label).join(", ")}` : undefined },
      { label: "Sources added", done: input.profile.sourceCount > 0, detail: plural(input.profile.sourceCount, "source") },
      { label: "Writing samples added", done: input.profile.voiceSampleCount > 0, detail: plural(input.profile.voiceSampleCount, "sample") },
    ],
    minimumMet: missingFields.length === 0,
    missing: missingFields.length ? `Fill in the profile's ${missingFields.map((f) => f.label).join(", ")} first.` : null,
  };

  // Shared counts
  const live = input.prospects.filter((p) => p.status !== "rejected");
  const shortlisted = live.filter((p) => p.shortlisted_at);
  const waiting = input.prospects.filter((p) => p.status === "suggested");
  const searchRun = input.prospects.some((p) => p.discovered_at);
  const briefOf = new Map(input.briefs.map((b) => [b.prospect_id, b]));
  const toReview = shortlisted.filter((p) => p.decision === "none");
  const pursue = shortlisted.filter((p) => p.decision === "pursue");

  // 2. Ideal customer
  const latest = [...input.icps].sort((a, b) => b.version - a.version)[0];
  const anyApproved = input.icps.some((i) => i.approved);
  const laterWork = shortlisted.length > 0;
  out.icp = !latest
    ? {
        state: "not_started",
        status: "Not started",
        subtasks: [
          { label: "Draft generated", done: false },
          { label: "Reviewed", done: false },
          { label: "Approved", done: false },
        ],
        minimumMet: false,
        missing: "Draft and approve the ideal customer profile first.",
      }
    : {
        // A newer draft after an approved version, with companies already shortlisted, needs attention.
        state: latest.approved ? "complete" : anyApproved && laterWork ? "attention" : "in_progress",
        status: latest.approved ? "Approved" : anyApproved && laterWork ? "Draft: re-approve" : "Draft",
        subtasks: [
          { label: "Draft generated", done: true, detail: `Version ${latest.version}` },
          { label: "Reviewed", done: latest.approved },
          { label: "Approved", done: latest.approved },
        ],
        minimumMet: anyApproved,
        missing: anyApproved ? null : "Approve the ideal customer profile first.",
      };

  // 3. Discover
  out.discover = {
    state:
      shortlisted.length > 0 && waiting.length === 0
        ? "complete"
        : shortlisted.length > 0 || searchRun
          ? "in_progress"
          : "not_started",
    status: shortlisted.length || searchRun ? `${shortlisted.length} shortlisted` : "Not started",
    subtasks: [
      { label: "Search run", done: searchRun },
      { label: "Candidates reviewed", done: searchRun && waiting.length === 0, detail: waiting.length ? `${waiting.length} waiting` : undefined },
      { label: "Companies shortlisted", done: shortlisted.length > 0, detail: plural(shortlisted.length, "company", "companies") },
    ],
    minimumMet: shortlisted.length > 0,
    missing: shortlisted.length ? null : "Shortlist at least one company first.",
  };

  // 4. Intelligence
  const researched = shortlisted.filter((p) => {
    const b = briefOf.get(p.id);
    return b && (b.status === "ready" || b.status === "insufficient_evidence");
  });
  const failed = shortlisted.filter((p) => briefOf.get(p.id)?.status === "failed");
  out.intelligence = {
    state: !shortlisted.length
      ? "not_started"
      : failed.length
        ? "attention"
        : pursue.length && !toReview.length
          ? "complete"
          : "in_progress",
    status: !shortlisted.length
      ? "Not started"
      : failed.length
        ? `${plural(failed.length, "brief")} failed`
        : toReview.length
          ? `${toReview.length} to review`
          : `${pursue.length} to pursue`,
    subtasks: [
      { label: "Research complete", done: shortlisted.length > 0 && researched.length === shortlisted.length, detail: `${researched.length} of ${shortlisted.length}` },
      { label: "Briefs reviewed", done: shortlisted.length > 0 && !toReview.length, detail: `${shortlisted.length - toReview.length} of ${shortlisted.length} decided` },
      { label: "Decisions made", done: pursue.length > 0, detail: `${pursue.length} to pursue` },
    ],
    minimumMet: pursue.length > 0,
    missing: pursue.length ? null : "Mark at least one company as pursue first.",
  };

  // 5. Contacts (only companies marked pursue count)
  const pursueCompanies = new Set(pursue.map((p) => p.company_id));
  const contacts = input.contacts.filter((c) => pursueCompanies.has(c.company_id));
  const withEmail = contacts.filter((c) => c.has_email);
  const rolesIdentified = pursue.filter((p) => (briefOf.get(p.id)?.target_role_count ?? 0) > 0);
  out.contacts = {
    state: withEmail.length ? "complete" : contacts.length ? "in_progress" : "not_started",
    status: contacts.length ? plural(contacts.length, "contact") : "Not started",
    subtasks: [
      { label: "Role identified", done: pursue.length > 0 && rolesIdentified.length === pursue.length, detail: `${rolesIdentified.length} of ${pursue.length}` },
      { label: "Contacts found", done: contacts.length > 0, detail: plural(contacts.length, "contact") },
      { label: "Emails verified", done: contacts.some((c) => c.email_verified), detail: `${contacts.filter((c) => c.email_verified).length} verified` },
    ],
    minimumMet: withEmail.length > 0,
    missing: withEmail.length ? null : "Add at least one contact with an email first.",
  };

  // 6. Pitch (first emails)
  const emails = input.pitches.filter((p) => p.kind === "first_contact");
  const drafts = emails.filter((p) => p.status === "draft");
  const approved = emails.filter((p) => p.status !== "draft");
  const chosen = input.concepts.filter((c) => c.selected);
  out.pitch = {
    state: !emails.length && !chosen.length ? "not_started" : approved.length && !drafts.length ? "complete" : "in_progress",
    status: drafts.length ? `${drafts.length} to approve` : emails.length ? `${approved.length} approved` : chosen.length ? "Concept chosen" : "Not started",
    subtasks: [
      { label: "Concept chosen", done: chosen.length > 0, detail: plural(chosen.length, "concept") },
      { label: "Pitch drafted", done: emails.length > 0, detail: plural(emails.length, "email") },
      { label: "Pitch approved", done: approved.length > 0, detail: `${approved.length} approved` },
    ],
    minimumMet: approved.length > 0,
    missing: approved.length ? null : "Approve at least one pitch first.",
  };

  // 7. Outreach
  const { sent, replied, followUpsDue } = input.outreach;
  out.outreach = {
    state: sent ? "in_progress" : "not_started",
    status: sent ? `${sent} sent, ${replied} replied` : "Not started",
    subtasks: [
      { label: "Sent", done: sent > 0, detail: `${sent} sent` },
      { label: "Follow-ups due", done: sent > 0 && followUpsDue === 0, detail: `${followUpsDue} due` },
      { label: "Replies logged", done: replied > 0, detail: `${replied} replied` },
    ],
    minimumMet: true,
    missing: null,
  };

  return MILESTONES.map((m) => ({ key: m.key, label: m.label, built: m.built, ...out[m.key] }));
}
