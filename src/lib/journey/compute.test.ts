import { describe, expect, test } from "vitest";
import { computeJourney, type JourneyInput } from "./compute";
import { MILESTONES } from "./milestones";

const emptyProfile: JourneyInput["profile"] = {
  positioning: null,
  services: [],
  audience: null,
  objectives: [],
  voiceSampleCount: 0,
  sourceCount: 0,
};
const fullProfile: JourneyInput["profile"] = {
  positioning: "Studio",
  services: ["Video"],
  audience: "Brands",
  objectives: ["Grow"],
  voiceSampleCount: 1,
  sourceCount: 2,
};

function input(over: Partial<JourneyInput> = {}): JourneyInput {
  return {
    profile: emptyProfile,
    icps: [],
    prospects: [],
    briefs: [],
    contacts: [],
    concepts: [],
    pitches: [],
    outreach: { sent: 0, replied: 0, followUpsDue: 0 },
    ...over,
  };
}

function prospect(id: string, over: Partial<JourneyInput["prospects"][number]> = {}): JourneyInput["prospects"][number] {
  return {
    id,
    company_id: `c-${id}`,
    status: "saved",
    stage: "new_lead",
    discovered_at: "2026-11-14T00:00:00Z",
    shortlisted_at: "2026-11-14T00:00:00Z",
    decision: "none",
    ...over,
  };
}

const byKey = (input: JourneyInput) => Object.fromEntries(computeJourney(input).map((m) => [m.key, m]));

describe("computeJourney", () => {
  test("a new empty profile has nothing started", () => {
    const j = byKey(input());
    expect(j.profile.state).toBe("not_started");
    expect(j.profile.status).toBe("4 fields missing");
    expect(j.icp.status).toBe("Not started");
    expect(j.discover.status).toBe("Not started");
    expect(j.discover.minimumMet).toBe(false);
    expect(j.intelligence.status).toBe("Not started");
    expect(j.pitch.status).toBe("Not started");
    expect(j.outreach.status).toBe("Not started");
  });

  test("approved ideal customer and no companies", () => {
    const j = byKey(input({ profile: fullProfile, icps: [{ version: 1, approved: true }] }));
    expect(j.profile.status).toBe("Complete");
    expect(j.icp.state).toBe("complete");
    expect(j.icp.status).toBe("Approved");
    expect(j.discover.state).toBe("not_started");
    expect(j.discover.missing).toBe("Shortlist at least one company first.");
  });

  test("prospects spread across several stages", () => {
    const j = byKey(
      input({
        profile: fullProfile,
        icps: [{ version: 1, approved: true }],
        prospects: [
          prospect("a", { decision: "pursue" }),
          prospect("b"),
          prospect("c", { status: "suggested", shortlisted_at: null }),
          prospect("d", { status: "rejected", shortlisted_at: null }),
        ],
        briefs: [
          { prospect_id: "a", status: "ready", target_role_count: 2 },
          { prospect_id: "b", status: "researching", target_role_count: 0 },
        ],
        contacts: [{ company_id: "c-a", has_email: true, email_verified: false }],
        concepts: [{ prospect_id: "a", selected: true }],
        pitches: [
          { prospect_id: "a", kind: "first_contact", status: "draft" },
          { prospect_id: "a", kind: "follow_up", status: "draft" },
        ],
      }),
    );
    expect(j.discover.status).toBe("2 shortlisted");
    expect(j.discover.state).toBe("in_progress"); // one suggestion still waiting
    expect(j.intelligence.status).toBe("1 to review");
    expect(j.intelligence.minimumMet).toBe(true);
    expect(j.contacts.status).toBe("1 contact");
    expect(j.contacts.minimumMet).toBe(true);
    expect(j.pitch.status).toBe("1 to approve");
    expect(j.pitch.minimumMet).toBe(false);
  });

  test("a failed brief needs attention", () => {
    const j = byKey(input({ prospects: [prospect("a")], briefs: [{ prospect_id: "a", status: "failed", target_role_count: 0 }] }));
    expect(j.intelligence.state).toBe("attention");
    expect(j.intelligence.status).toBe("1 brief failed");
  });

  test("an ideal customer returned to draft after work started needs attention", () => {
    const j = byKey(
      input({
        icps: [
          { version: 1, approved: true },
          { version: 2, approved: false },
        ],
        prospects: [prospect("a")],
      }),
    );
    expect(j.icp.state).toBe("attention");
    expect(j.icp.minimumMet).toBe(true);
  });

  test("contacts only count at companies marked pursue", () => {
    const j = byKey(
      input({
        prospects: [prospect("a", { decision: "hold" })],
        contacts: [{ company_id: "c-a", has_email: true, email_verified: true }],
      }),
    );
    expect(j.contacts.status).toBe("Not started");
    expect(j.contacts.minimumMet).toBe(false);
  });

  test("switching profile gives that profile's data only", () => {
    const a = byKey(input({ profile: fullProfile, icps: [{ version: 1, approved: true }] }));
    const b = byKey(input());
    expect(a.icp.status).toBe("Approved");
    expect(b.icp.status).toBe("Not started");
  });

  test("statuses follow the shared milestone order", () => {
    expect(computeJourney(input()).map((m) => m.key)).toEqual(MILESTONES.map((m) => m.key));
  });
});

describe("milestone config", () => {
  test("all seven milestones are built", () => {
    expect(MILESTONES.filter((m) => !m.built)).toEqual([]);
  });
});
