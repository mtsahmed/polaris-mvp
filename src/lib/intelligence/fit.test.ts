import { describe, expect, test } from "vitest";
import { bandFor, computeFit, CRITERIA, type CriterionRating } from "./fit";

const known = (rating: number): Omit<CriterionRating, "key"> => ({ rating, reason: "r", signal_ids: ["s1"] });
const unknown: Omit<CriterionRating, "key"> = { rating: null, reason: "No evidence found", signal_ids: [] };

function criteria(values: Omit<CriterionRating, "key">[]): CriterionRating[] {
  return CRITERIA.map((c, i) => ({ key: c.key, ...values[i] }));
}

describe("computeFit", () => {
  test("total matches the criteria", () => {
    const r = computeFit(criteria([known(20), known(15), known(10), known(5), known(0)]));
    expect(r).toEqual({ kind: "scored", score: 50, band: "possible", unknown: 0 });
  });

  test("an unknown criterion contributes 0 and is counted", () => {
    const r = computeFit(criteria([known(20), known(20), known(20), known(20), unknown]));
    expect(r).toEqual({ kind: "scored", score: 80, band: "strong", unknown: 1 });
  });

  test("a rating without a source counts as unknown", () => {
    const r = computeFit(criteria([known(20), known(20), known(20), known(20), { rating: 20, reason: "x", signal_ids: [] }]));
    expect(r.kind === "scored" && r.unknown).toBe(1);
  });

  test("three unknown criteria give insufficient evidence and no score", () => {
    const r = computeFit(criteria([known(20), known(20), unknown, unknown, unknown]));
    expect(r).toEqual({ kind: "insufficient", unknown: 3 });
  });

  test("missing criteria count as unknown", () => {
    expect(computeFit([])).toEqual({ kind: "insufficient", unknown: 5 });
  });

  test("ratings are clamped to 0–20", () => {
    const r = computeFit(criteria([known(40), known(20), known(20), known(20), known(20)]));
    expect(r.kind === "scored" && r.score).toBe(100);
  });
});

describe("bandFor", () => {
  test("bands at 70 and 40", () => {
    expect(bandFor(70)).toBe("strong");
    expect(bandFor(69)).toBe("possible");
    expect(bandFor(40)).toBe("possible");
    expect(bandFor(39)).toBe("weak");
  });
});
