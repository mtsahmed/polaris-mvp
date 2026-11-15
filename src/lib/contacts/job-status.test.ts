import { describe, expect, it } from "vitest";
import { effectiveJobStatus, isActive, isPlanBlocked, stepLine } from "./job-status";

const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

describe("effectiveJobStatus", () => {
  it("keeps a fresh running job running", () => {
    expect(effectiveJobStatus({ status: "running", created_at: at(2) })).toBe("running");
    expect(isActive({ status: "queued", created_at: at(1) })).toBe(true);
  });
  it("treats a job stuck for over 10 minutes as failed", () => {
    expect(effectiveJobStatus({ status: "running", created_at: at(11) })).toBe("failed");
    expect(isActive({ status: "running", created_at: at(11) })).toBe(false);
  });
  it("leaves finished jobs alone", () => {
    expect(effectiveJobStatus({ status: "done", created_at: at(60) })).toBe("done");
    expect(isActive(null)).toBe(false);
  });
});

describe("isPlanBlocked", () => {
  it("recognises the Free-plan error", () => {
    expect(isPlanBlocked("Your Apollo plan does not include API access (Free plan has none).")).toBe(true);
    expect(isPlanBlocked("The hourly limit was reached.")).toBe(false);
    expect(isPlanBlocked(null)).toBe(false);
  });
});

describe("stepLine", () => {
  it("describes each outcome", () => {
    expect(stepLine({ source: "apollo", outcome: "skipped", saved: 0, note: "Free plan" })).toBe("Apollo skipped: Free plan");
    expect(stepLine({ source: "web", outcome: "found", saved: 3, unconfirmed: 1, dropped: 2 })).toBe(
      "Web search: 3 saved, 1 email not confirmed, 2 numbers dropped (not on the cited page)",
    );
    expect(stepLine({ source: "site", outcome: "none", saved: 0 })).toBe("Website: nothing found");
    expect(stepLine({ source: "recheck", outcome: "found", saved: 2 })).toBe("Recheck: 2 of 2 unconfirmed emails now confirmed");
    expect(stepLine({ source: "recheck", outcome: "none", saved: 0, unconfirmed: 1 })).toBe("Recheck: 0 of 1 unconfirmed email now confirmed");
  });
});
