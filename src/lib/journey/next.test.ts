import { describe, expect, test } from "vitest";
import { computeJourney, type JourneyInput } from "./compute";
import { MILESTONES } from "./milestones";
import { nextAction } from "./next";

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

  test("the Outreach page's View pipeline links to the board", () => {
    expect(nextAction("outreach", computeJourney(base), "p1").href).toBe("/pipeline");
  });

  test("the Outreach page offers View pipeline", () => {
    const a = nextAction("outreach", computeJourney(base), "p1");
    expect(a.label.startsWith("View pipeline")).toBe(true);
  });

  test("an unbuilt milestone is never a link", () => {
    for (const m of MILESTONES.filter((x) => !x.built)) {
      const before = MILESTONES[MILESTONES.indexOf(m) - 1];
      if (!before) continue;
      expect(nextAction(before.key, computeJourney(base), "p1").href).toBeNull();
    }
  });
});
