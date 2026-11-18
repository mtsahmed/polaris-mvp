import { describe, expect, it } from "vitest";
import { STAGE_ORDER } from "@/lib/outreach/rules";
import { queryCompanies, segmentSlices, type CompanyRow, type TableQuery } from "./companies";

const row = (over: Partial<CompanyRow>): CompanyRow => ({
  id: over.name ?? "x",
  name: "X",
  segment: "Labels",
  stage: "new_lead",
  status: "",
  location: null,
  email: null,
  emailUnconfirmed: false,
  notes: "",
  added: "2026-11-10T00:00:00Z",
  ...over,
});

describe("segmentSlices", () => {
  it("colours ICP segments in ICP order whatever their size, then folds the rest into Other", () => {
    const rows = [
      ...Array(3).fill({ segment: "Podcasts" }),
      { segment: "Labels" },
      { segment: "Other" },
      { segment: "Real estate" },
    ];
    expect(segmentSlices(rows, ["Labels", "Podcasts"])).toEqual([
      { segment: "Labels", count: 1, colour: "var(--segment-1)" },
      { segment: "Podcasts", count: 3, colour: "var(--segment-2)" },
      { segment: "Real estate", count: 1, colour: "var(--segment-3)" },
      { segment: "Other", count: 1, colour: "var(--segment-other)" },
    ]);
  });

  it("never makes an eighth colour", () => {
    const icp = Array.from({ length: 9 }, (_, i) => `S${i}`);
    const slices = segmentSlices(icp.map((segment) => ({ segment })), icp);
    expect(slices).toHaveLength(8);
    expect(slices.at(-1)).toEqual({ segment: "Other", count: 2, colour: "var(--segment-other)" });
  });
});

describe("queryCompanies", () => {
  const rows = [
    row({ name: "Beta", location: "Austin, TX", stage: "contacted", added: "2026-11-17T00:00:00Z", segment: "Podcasts" }),
    row({ name: "Alpha", location: null, stage: "won", added: "2026-09-01T00:00:00Z" }),
    row({ name: "Gamma", location: "Boston, MA", stage: "new_lead", added: "2026-11-01T00:00:00Z" }),
  ];
  const q = (over: Partial<TableQuery>): TableQuery => ({ search: "", segment: "", stage: "", added: "any", sort: "recent", ...over });
  const names = (r: CompanyRow[]) => r.map((x) => x.name);
  const now = Date.parse("2026-11-18T00:00:00Z");

  it("sorts by recent, oldest, status and region (unknown region last)", () => {
    expect(names(queryCompanies(rows, q({}), STAGE_ORDER, now))).toEqual(["Beta", "Gamma", "Alpha"]);
    expect(names(queryCompanies(rows, q({ sort: "oldest" }), STAGE_ORDER, now))).toEqual(["Alpha", "Gamma", "Beta"]);
    expect(names(queryCompanies(rows, q({ sort: "status" }), STAGE_ORDER, now))).toEqual(["Gamma", "Beta", "Alpha"]);
    expect(names(queryCompanies(rows, q({ sort: "region" }), STAGE_ORDER, now))).toEqual(["Beta", "Gamma", "Alpha"]);
  });

  it("searches name or region and applies the filters together", () => {
    expect(names(queryCompanies(rows, q({ search: "boston" }), STAGE_ORDER, now))).toEqual(["Gamma"]);
    expect(names(queryCompanies(rows, q({ search: "alp" }), STAGE_ORDER, now))).toEqual(["Alpha"]);
    expect(names(queryCompanies(rows, q({ segment: "Labels", added: "30" }), STAGE_ORDER, now))).toEqual(["Gamma"]);
    expect(names(queryCompanies(rows, q({ stage: "won" }), STAGE_ORDER, now))).toEqual(["Alpha"]);
  });
});
