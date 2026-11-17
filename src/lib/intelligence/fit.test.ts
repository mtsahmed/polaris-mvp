import { describe, expect, test } from "vitest";
import {
  applicableKnockout,
  bandFor,
  clampRating,
  computeFit,
  criteriaFor,
  CUSTOMER_CRITERIA,
  knockoutRulesFor,
  LEGACY_CRITERIA,
  PARTNER_CRITERIA,
  recommend,
  setForGoal,
  type CriterionRating,
  type FitResult,
  type Knockout,
} from "./fit";

const known = (rating: number): Omit<CriterionRating, "key"> => ({ rating, reason: "r", signal_ids: ["s1"] });
const unknown: Omit<CriterionRating, "key"> = { rating: null, reason: "No evidence found", signal_ids: [] };

function customer(values: Omit<CriterionRating, "key">[]): CriterionRating[] {
  return CUSTOMER_CRITERIA.map((c, i) => ({ key: c.key, ...values[i] }));
}

describe("computeFit", () => {
  test("total matches the criteria", () => {
    const r = computeFit(customer([known(20), known(15), known(10), known(5), known(0)]), CUSTOMER_CRITERIA);
    expect(r).toEqual({ kind: "scored", score: 50, band: "possible", known: 5, total: 5, capped: false });
  });

  test("unknown criteria are left out of the score instead of counting as 0", () => {
    const r = computeFit(customer([known(20), known(20), known(20), known(20), unknown]), CUSTOMER_CRITERIA);
    expect(r).toEqual({ kind: "scored", score: 100, band: "strong", known: 4, total: 5, capped: false });
  });

  test("a rating without a source counts as unknown", () => {
    const r = computeFit(
      customer([known(20), known(20), known(20), known(20), { rating: 20, reason: "x", signal_ids: [] }]),
      CUSTOMER_CRITERIA,
    );
    expect(r.known).toBe(4);
  });

  test("fewer than three known criteria give insufficient evidence and no score", () => {
    const r = computeFit(customer([known(20), known(20), unknown, unknown, unknown]), CUSTOMER_CRITERIA);
    expect(r).toEqual({ kind: "insufficient", known: 2, total: 5 });
  });

  test("with exactly three known, a strong score is capped at Possible", () => {
    const r = computeFit(customer([known(20), known(20), known(15), unknown, unknown]), CUSTOMER_CRITERIA);
    expect(r).toMatchObject({ kind: "scored", score: 92, band: "possible", capped: true });
  });

  test("ratings from another set are ignored", () => {
    expect(computeFit(customer([known(20), known(20), known(20), known(20), known(20)]), PARTNER_CRITERIA).kind).toBe(
      "insufficient",
    );
  });

  test("missing criteria count as unknown", () => {
    expect(computeFit([], CUSTOMER_CRITERIA)).toEqual({ kind: "insufficient", known: 0, total: 5 });
  });
});

describe("clampRating", () => {
  test("clamps to 0–20 and snaps to the anchored steps", () => {
    expect(clampRating(40)).toBe(20);
    expect(clampRating(-3)).toBe(0);
    expect(clampRating(12)).toBe(10);
    expect(clampRating(13)).toBe(15);
    expect(clampRating(null)).toBeNull();
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

describe("goals", () => {
  test("customer uses the customer set; every other goal the partner set", () => {
    expect(setForGoal("customer")).toBe("customer");
    expect(setForGoal("partnership")).toBe("partner");
    expect(setForGoal("referral")).toBe("partner");
    expect(setForGoal("co_marketing")).toBe("partner");
    expect(criteriaFor(null)).toBe(LEGACY_CRITERIA);
  });
});

describe("knockouts", () => {
  test("competitor and exclusive partner are always checked; the others only when the ICP sets them", () => {
    expect(knockoutRulesFor(null)).toEqual(["competitor", "exclusive_partner"]);
    expect(knockoutRulesFor({ excluded_geographies: ["Canada"], competitors: [], min_employees: 20 })).toEqual([
      "competitor",
      "exclusive_partner",
      "excluded_geography",
      "below_min_size",
    ]);
  });

  test("an exclusive partner only knocks out the partnership goal", () => {
    const k: Knockout[] = [{ rule: "exclusive_partner", reason: "x", signal_id: "s1" }];
    expect(applicableKnockout(k, "customer")).toBeNull();
    expect(applicableKnockout(k, "partnership")?.rule).toBe("exclusive_partner");
  });

  test("a knockout without a source never applies", () => {
    expect(applicableKnockout([{ rule: "competitor", reason: "x", signal_id: "" }], "customer")).toBeNull();
  });
});

describe("recommend", () => {
  const scored = (score: number, band: "strong" | "possible" | "weak"): FitResult => ({
    kind: "scored",
    score,
    band,
    known: 5,
    total: 5,
    capped: false,
  });

  test("follows the fixed rules", () => {
    const base = { knockout: null, goal: "customer" as const, hasTiming: false };
    expect(recommend({ ...base, fit: scored(80, "strong") }).recommendation).toBe("pursue");
    expect(recommend({ ...base, fit: scored(30, "weak") }).recommendation).toBe("skip");
    expect(recommend({ ...base, fit: scored(55, "possible") }).recommendation).toBe("hold");
    expect(recommend({ ...base, fit: scored(55, "possible"), hasTiming: true }).recommendation).toBe("pursue");
    expect(recommend({ ...base, fit: { kind: "insufficient", known: 2, total: 5 } }).recommendation).toBe("hold");
  });

  test("a knockout means skip whatever the score", () => {
    const r = recommend({
      fit: scored(95, "strong"),
      knockout: { rule: "competitor", reason: "x", signal_id: "s1" },
      goal: "customer",
      hasTiming: true,
    });
    expect(r).toEqual({ recommendation: "skip", lead: "Not a fit: competitor." });
  });

  test("the lead names the band, goal and score", () => {
    expect(recommend({ fit: scored(78, "strong"), knockout: null, goal: "customer", hasTiming: false }).lead).toBe(
      "Strong fit as a customer (78).",
    );
  });
});
