import { describe, expect, test } from "vitest";
import { computeJourney, type JourneyInput } from "./compute";
import { MILESTONES } from "./milestones";
import { nextAction, profileTabAction } from "./next";

const base: JourneyInput = {
  profile: { positioning: "x", services: ["x"], audience: "x", objectives: ["x"], voiceSampleCount: 0, sourceCount: 0 },
  icps: [],
  prospects: [],
  briefs: [],
  contacts: [],
  concepts: [],
  pitches: [],
  outreach: { sent: 0, replied: 0, followUpsDue: 0 },
};

describe("nextAction", () => {
  test("shows what is missing when the stage minimum is not met", () => {
    const a = nextAction("icp", computeJourney({ ...base, icps: [{ version: 1, approved: false }] }), "p1");
    expect(a.label).toBe("Next action (Discover)");
    expect(a.href).toBe("/discovery?profile=p1");
    expect(a.missing).toBe("Approve the ideal customer profile first.");
  });

  test("no missing message once the minimum is met", () => {
    const a = nextAction("icp", computeJourney({ ...base, icps: [{ version: 1, approved: true }] }), "p1");
    expect(a.missing).toBeNull();
  });

  test("links to the next built stage", () => {
    const a = nextAction("pitch", computeJourney(base), "p1");
    expect(a.label).toBe("Next action (Outreach)");
    expect(a.href).toBe("/outreach");
  });

  test("the Outreach page's View dashboard links to the Dashboard", () => {
    expect(nextAction("outreach", computeJourney(base), "p1").href).toBe("/dashboard");
  });

  test("the Outreach page offers View dashboard", () => {
    const a = nextAction("outreach", computeJourney(base), "p1");
    expect(a.label.startsWith("View dashboard")).toBe(true);
  });

  test("an unbuilt milestone is never a link", () => {
    for (const m of MILESTONES.filter((x) => !x.built)) {
      const before = MILESTONES[MILESTONES.indexOf(m) - 1];
      if (!before) continue;
      expect(nextAction(before.key, computeJourney(base), "p1").href).toBeNull();
    }
  });
});

describe("profileTabAction", () => {
  const incomplete = computeJourney({ ...base, profile: { ...base.profile, positioning: "" } });

  test("steps through the profile tabs in order", () => {
    expect(profileTabAction("business", incomplete, "p1")).toMatchObject({
      label: "Next action (Sources)",
      href: "/profiles/p1?tab=sources",
      missing: null,
      stageLabel: "Business info",
    });
    expect(profileTabAction("sources", incomplete, "p1")).toMatchObject({
      label: "Next action (Insights)",
      href: "/profiles/p1?tab=insights",
      missing: null,
    });
    expect(profileTabAction("insights", incomplete, "p1")).toMatchObject({
      label: "Next action (Profile)",
      href: "/profiles/p1?tab=profile",
      missing: null,
    });
  });

  test("the Profile tab leads to the ideal customer and needs the required fields", () => {
    const a = profileTabAction("profile", incomplete, "p1");
    expect(a.label).toBe("Next action (Ideal customer)");
    expect(a.href).toBe("/profiles/p1?tab=icp");
    expect(a.missing).toMatch(/Positioning/i);
  });

  test("the ICP tab leads to Discover", () => {
    expect(profileTabAction("icp", computeJourney(base), "p1").label).toBe("Next action (Discover)");
  });
});
