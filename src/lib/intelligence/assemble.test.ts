import { describe, expect, test } from "vitest";
import type { BriefOutput } from "./brief";
import { assembleBrief, scoreForGoal, verifiedFindings } from "./assemble";
import { CUSTOMER_CRITERIA, PARTNER_CRITERIA } from "./fit";

const finding = (url: string): BriefOutput["findings"][number] => ({
  type: "launch",
  summary: "Launched a thing.",
  source_url: url,
  source_date: "2026-10-01",
  quote: "We launched",
});

function output(over: Partial<BriefOutput> = {}): BriefOutput {
  return {
    findings: [],
    summary: "A company.",
    deal_goal: "customer",
    deal_goal_reason: "They buy this kind of service.",
    customer_criteria: CUSTOMER_CRITERIA.map((c) => ({ key: c.key, rating: 15, reason: "ok", refs: ["N1"] })),
    partner_criteria: PARTNER_CRITERIA.map((c) => ({ key: c.key, rating: 5, reason: "meh", refs: ["N1"] })),
    knockouts: [],
    fit_case: "Clear need, budget unknown.",
    why_now: [{ statement: "Launched in October.", ref: "N1" }],
    risks: [{ statement: "No budget information.", ref: "" }],
    suggested_angle: "Lead with the launch.",
    target_roles: [{ role: "Head of Marketing", reason: "Owns launches." }],
    concept_starters: [{ title: "Launch series", description: "A series.", refs: ["N1"] }],
    ...over,
  };
}

describe("verifiedFindings", () => {
  test("a finding without a source URL is rejected", () => {
    const kept = verifiedFindings([finding(""), finding("not a url")], ["https://example.com/a"]);
    expect(kept).toEqual([]);
  });

  test("a finding whose link was never seen is rejected; seen links are kept with their label", () => {
    const kept = verifiedFindings(
      [finding("https://made-up.example/x"), finding("https://www.example.com/a/")],
      ["https://example.com/a"],
    );
    expect(kept.map((k) => k.label)).toEqual(["N2"]);
  });
});

describe("assembleBrief", () => {
  const ids = new Map([["N1", "sig-1"]]);

  test("maps labels to signal ids and scores the suggested goal", () => {
    const b = assembleBrief(output(), ids);
    expect(b.status).toBe("ready");
    expect(b.deal_goal).toBe("customer");
    expect(b.fit_score).toBe(75);
    expect(b.fit_band).toBe("strong");
    expect(b.fit_known).toBe(5);
    expect(b.recommendation).toBe("pursue");
    expect(b.recommendation_reason).toBe("Strong fit as a customer (75). Clear need, budget unknown.");
    expect(b.criteria.every((c) => c.signal_ids[0] === "sig-1")).toBe(true);
    expect(b.criteria_sets.partner.every((c) => c.rating === 5)).toBe(true);
    expect(b.signal_ids).toEqual(["sig-1"]);
  });

  test("ratings are snapped to the anchored steps", () => {
    const customer_criteria = CUSTOMER_CRITERIA.map((c) => ({ key: c.key, rating: 13, reason: "ok", refs: ["N1"] }));
    expect(assembleBrief(output({ customer_criteria }), ids).criteria.every((c) => c.rating === 15)).toBe(true);
  });

  test("a knockout with a source means not a fit, whatever the score", () => {
    const b = assembleBrief(output({ knockouts: [{ rule: "competitor", reason: "Sells the same service.", ref: "N1" }] }), ids);
    expect(b.fit_score).toBe(75);
    expect(b.recommendation).toBe("skip");
    expect(b.recommendation_reason).toBe("Not a fit: competitor. Sells the same service.");
  });

  test("a knockout that cites no known finding is dropped", () => {
    const b = assembleBrief(output({ knockouts: [{ rule: "competitor", reason: "Guess.", ref: "N9" }] }), ids);
    expect(b.knockouts).toEqual([]);
    expect(b.recommendation).toBe("pursue");
  });

  test("changing the goal re-scores from the stored sets", () => {
    const b = assembleBrief(output(), ids);
    const r = scoreForGoal({ ...b, goal: "partnership", hasTiming: true, hasSources: true });
    expect(r.fit_score).toBe(25);
    expect(r.fit_band).toBe("weak");
    expect(r.recommendation).toBe("skip");
    expect(r.criteria.map((c) => c.key)).toEqual(PARTNER_CRITERIA.map((c) => c.key));
  });

  test("a rating that cites an unknown finding becomes Unknown", () => {
    const customer_criteria = CUSTOMER_CRITERIA.map((c, i) => ({ key: c.key, rating: 15, reason: "ok", refs: [i < 3 ? "N9" : "N1"] }));
    const b = assembleBrief(output({ customer_criteria }), ids);
    expect(b.criteria.filter((c) => c.rating === null)).toHaveLength(3);
    expect(b.status).toBe("insufficient_evidence");
    expect(b.fit_score).toBeNull();
    expect(b.fit_band).toBeNull();
  });

  test("timing signals and concept starters need a source; risks may rest on missing evidence", () => {
    const b = assembleBrief(
      output({
        why_now: [{ statement: "Unsourced timing.", ref: "N7" }],
        concept_starters: [{ title: "Unsourced idea", description: "x", refs: [] }],
      }),
      ids,
    );
    expect(b.why_now).toEqual([]);
    expect(b.concept_starters).toEqual([]);
    expect(b.risks).toEqual([{ statement: "No budget information.", signal_id: "" }]);
  });

  test("no usable findings at all gives insufficient evidence", () => {
    const b = assembleBrief(output(), new Map());
    expect(b.status).toBe("insufficient_evidence");
    expect(b.fit_score).toBeNull();
  });
});
