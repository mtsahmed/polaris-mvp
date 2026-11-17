import { describe, expect, test } from "vitest";
import { clampInputs, computeImpact, DEFAULT_INPUTS, fromHash, toHash } from "./model";

describe("computeImpact", () => {
  test("the same hours buy more pitches at fewer hours per pitch", () => {
    const r = computeImpact(DEFAULT_INPUTS); // 40 h: 3 h by hand, 0.75 h with Polaris
    expect(r.without.pitches).toBe(13);
    expect(r.with.pitches).toBe(53);
    expect(r.extraPitches).toBe(40);
  });

  test("the funnel runs pitches to revenue with the visitor's own rates", () => {
    const r = computeImpact({ ...DEFAULT_INPUTS, hoursPerMonth: 30, manualHoursPerPitch: 3, polarisHoursPerPitch: 0.5 });
    // 60 pitches × 5% × 40% × 20% = 0.24 deals × $10,000
    expect(r.with.pitches).toBe(60);
    expect(r.with.deals).toBeCloseTo(0.24);
    expect(r.with.revenue).toBeCloseTo(2400);
  });

  test("volume only by default: no reply-rate uplift unless chosen", () => {
    const base = computeImpact(DEFAULT_INPUTS);
    expect(base.with.replies / base.with.pitches).toBeCloseTo(0.05);
    const up = computeImpact({ ...DEFAULT_INPUTS, replyUplift: 2 });
    expect(up.with.replies / up.with.pitches).toBeCloseTo(0.07);
    expect(up.without.replies).toBeCloseTo(base.without.replies);
  });

  test("revenue starts after the sales cycle", () => {
    const r = computeImpact({ ...DEFAULT_INPUTS, salesCycleMonths: 3 });
    expect(r.cumulative[2].with).toBe(0);
    expect(r.cumulative[3].with).toBeCloseTo(r.with.revenue);
    expect(r.extraRevenue12).toBeCloseTo((r.with.revenue - r.without.revenue) * 9);
  });

  test("hours saved if today's volume is kept", () => {
    const r = computeImpact(DEFAULT_INPUTS);
    expect(r.hoursSavedAtSameVolume).toBeCloseTo(13 * 2.25);
    expect(r.timeValueSaved).toBeCloseTo(13 * 2.25 * 75);
  });

  test("no return multiple when Polaris costs nothing", () => {
    expect(computeImpact({ ...DEFAULT_INPUTS, polarisMonthlyCost: 0 }).returnMultiple).toBeNull();
  });
});

describe("shareable link", () => {
  test("round-trips changed values only", () => {
    const i = { ...DEFAULT_INPUTS, dealValue: 25000, replyUplift: 1 };
    const hash = toHash(i);
    expect(hash).toBe("#impact?up=1&dv=25000");
    expect(fromHash(hash)).toEqual(i);
  });

  test("out-of-range or junk values are clamped or ignored", () => {
    expect(fromHash("#impact?rr=500&dv=abc")).toEqual({ ...DEFAULT_INPUTS, replyRate: 30 });
    expect(fromHash("#other")).toBeNull();
    expect(clampInputs({ hoursPerMonth: -3 }).hoursPerMonth).toBe(5);
  });
});
