// The seven milestones of the Polaris journey (spec section 3). This list is the only place the
// order, labels, routes and "built" flags are defined; the journey bar and the Next action button
// both read it. Pure data, safe on server and client.

export const MILESTONE_KEYS = ["profile", "icp", "discover", "intelligence", "contacts", "pitch", "outreach"] as const;
export type MilestoneKey = (typeof MILESTONE_KEYS)[number];

export type Milestone = {
  key: MilestoneKey;
  label: string;
  // Marked true only once the stage works end to end with real data.
  built: boolean;
  route: (profileId: string) => string;
  // Shown above the Next action button on the stage before this one.
  intro: string;
  subtasks: string[];
};

export const MILESTONES: Milestone[] = [
  {
    key: "profile",
    label: "Profile",
    built: true,
    route: (id) => `/profiles/${id}`,
    intro: "Describe the business or talent, add sources and writing samples.",
    subtasks: ["Business details", "Sources added", "Writing samples added"],
  },
  {
    key: "icp",
    label: "Ideal customer",
    built: true,
    route: (id) => `/profiles/${id}?tab=icp`,
    intro: "Review who Polaris thinks your best-fit customers are.",
    subtasks: ["Draft generated", "Reviewed", "Approved"],
  },
  {
    key: "discover",
    label: "Discover",
    built: true,
    route: (id) => `/discovery?profile=${id}`,
    intro: "Find companies that match and shortlist the relevant ones.",
    subtasks: ["Search run", "Candidates reviewed", "Companies shortlisted"],
  },
  {
    key: "intelligence",
    label: "Intelligence",
    built: true,
    route: () => "/intelligence",
    intro: "See how well each shortlisted company fits, and why.",
    subtasks: ["Research complete", "Briefs reviewed", "Decisions made"],
  },
  {
    key: "contacts",
    label: "Contacts",
    built: true,
    route: () => "/contacts",
    intro: "Find the right people at the companies you chose to pursue.",
    subtasks: ["Role identified", "Contacts found", "Emails verified"],
  },
  {
    key: "pitch",
    label: "Pitch",
    built: true,
    route: () => "/pitch",
    intro: "Choose a concept and shape the pitch.",
    subtasks: ["Concept chosen", "Pitch drafted", "Pitch approved"],
  },
  {
    key: "outreach",
    label: "Outreach",
    built: true,
    route: () => "/outreach",
    intro: "Send what you approved and track replies.",
    subtasks: ["Sent", "Follow-ups due", "Replies logged"],
  },
];

// The pipeline view the Outreach page's button leads to (spec section 5).
export const PIPELINE = { label: "View pipeline", built: true, route: "/pipeline", intro: "See every prospect and what is due next." };

export function milestone(key: MilestoneKey): Milestone {
  return MILESTONES.find((m) => m.key === key)!;
}

export function nextMilestone(key: MilestoneKey): Milestone | null {
  const i = MILESTONES.findIndex((m) => m.key === key);
  return MILESTONES[i + 1] ?? null;
}

// Which milestone a page belongs to, from its path (and the profile page's tab).
export function milestoneForPath(pathname: string, tab: string | null): MilestoneKey | null {
  if (/^\/profiles\/[^/]+$/.test(pathname)) return tab === "icp" ? "icp" : "profile";
  if (pathname.startsWith("/discovery")) return "discover";
  if (pathname.startsWith("/intelligence")) return "intelligence";
  if (pathname.startsWith("/contacts")) return "contacts";
  if (pathname.startsWith("/pitch")) return "pitch";
  if (pathname.startsWith("/outreach")) return "outreach";
  return null;
}
