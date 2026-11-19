import { describe, expect, it } from "vitest";
import { conceptsUpToDate, emailUpToDate, icpUpToDate, insightsUpToDate, rescoreUpToDate, researchUpToDate } from ".";

const T0 = "2026-11-19T10:00:00Z";
const T1 = "2026-11-19T11:00:00Z";

describe("insightsUpToDate", () => {
  const sources = [{ id: "a", created_at: T0 }];
  it("allows the first run", () => expect(insightsUpToDate(null, undefined, sources)).toBeNull());
  it("is up to date when the same sources were read", () => expect(insightsUpToDate(T1, ["a"], sources)).toMatch(/Up to date/));
  it("runs when a source was added", () => expect(insightsUpToDate(T1, ["a"], [...sources, { id: "b", created_at: T1 }])).toBeNull());
  it("runs when a source was removed", () => expect(insightsUpToDate(T1, ["a", "b"], sources)).toBeNull());
  it("runs when a source was saved again after the draft", () =>
    expect(insightsUpToDate(T0, ["a"], [{ id: "a", created_at: T1 }])).toBeNull());
});

describe("other steps", () => {
  it("ICP opens when the profile changed after it", () => {
    expect(icpUpToDate(T1, T0)).toBeNull();
    expect(icpUpToDate(T0, T1)).toMatch(/Up to date/);
    expect(icpUpToDate(T0, undefined)).toBeNull();
  });
  it("research opens after seven days", () => {
    const now = Date.parse(T0);
    expect(researchUpToDate(new Date(now - 2 * 86_400_000).toISOString(), now)).toMatch(/5 days/);
    expect(researchUpToDate(new Date(now - 8 * 86_400_000).toISOString(), now)).toBeNull();
    expect(researchUpToDate(null, now)).toBeNull();
  });
  it("concepts open when the prospect changed after them", () => {
    expect(conceptsUpToDate(T1, [{ created_at: T0 }])).toBeNull();
    expect(conceptsUpToDate(T0, [{ created_at: T1 }])).toMatch(/Up to date/);
    expect(conceptsUpToDate(T0, [])).toBeNull();
  });
  it("email opens when the concept or notes changed after it", () => {
    expect(emailUpToDate(T1, { prospectUpdatedAt: T0, conceptUpdatedAt: T0 })).toMatch(/Up to date/);
    expect(emailUpToDate(T0, { prospectUpdatedAt: T0, conceptUpdatedAt: T1 })).toBeNull();
    expect(emailUpToDate(T0, { prospectUpdatedAt: T1, conceptUpdatedAt: T0 })).toBeNull();
  });
  it("re-score opens when the ICP changed after the brief", () => {
    expect(rescoreUpToDate(T0, T1)).toBeNull();
    expect(rescoreUpToDate(T1, T0)).toMatch(/current ICP/);
  });
});
