import { describe, expect, test } from "vitest";
import type { BriefOutput } from "./brief";
import { assembleBrief, verifiedFindings } from "./assemble";
import { CRITERIA } from "./fit";

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
    criteria: CRITERIA.map((c) => ({ key: c.key, rating: 15, reason: "ok", refs: ["N1"] })),
    why_now: [{ statement: "Launched in October.", ref: "N1" }],
    risks: [{ statement: "No budget information.", ref: "" }],
    recommendation: "pursue",
    recommendation_reason: "Good fit.",
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

  test("maps labels to signal ids and scores the five criteria", () => {
    const b = assembleBrief(output(), ids);
    expect(b.status).toBe("ready");
    expect(b.fit_score).toBe(75);
    expect(b.fit_band).toBe("strong");
    expect(b.criteria.every((c) => c.signal_ids[0] === "sig-1")).toBe(true);
    expect(b.signal_ids).toEqual(["sig-1"]);
  });

  test("a rating that cites an unknown finding becomes Unknown", () => {
    const criteria = CRITERIA.map((c, i) => ({ key: c.key, rating: 15, reason: "ok", refs: [i < 3 ? "N9" : "N1"] }));
    const b = assembleBrief(output({ criteria }), ids);
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
