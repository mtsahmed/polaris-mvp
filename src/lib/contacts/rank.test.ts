import { describe, expect, it } from "vitest";
import { pickTop, titleScore } from "./rank";

const roles = ["Branch Manager, Austin", "Brand Manager", "Director of Account Management"];

describe("titleScore", () => {
  it("ranks an exact title above a partial one", () => {
    expect(titleScore("Brand Manager", roles)).toBeGreaterThan(titleScore("Senior Brand Lead", roles));
  });
  it("ignores the city after a comma and scores unrelated titles 0", () => {
    expect(titleScore("Branch Manager", roles)).toBeGreaterThan(2);
    expect(titleScore("Horticulture Technician", roles)).toBe(0);
    expect(titleScore(null, roles)).toBe(0);
  });
});

describe("pickTop", () => {
  const people = [
    { id: 1, title: "Horticulture Technician", hasEmail: true },
    { id: 2, title: "Brand Manager", hasEmail: false },
    { id: 3, title: "Branch Manager", hasEmail: true },
    { id: 4, title: "Account Management Director", hasEmail: true },
    { id: 5, title: "Brand Manager", hasEmail: true },
  ];
  it("caps the picks and never picks unrelated people", () => {
    const top = pickTop(people, roles, 3).map((p) => p.id);
    expect(top).toHaveLength(3);
    expect(top).not.toContain(1);
  });
  it("prefers people Apollo has an email for among equal matches", () => {
    const top = pickTop(people, ["Brand Manager"], 1).map((p) => p.id);
    expect(top).toEqual([5]);
  });
  it("with no roles, takes the first candidates", () => {
    expect(pickTop(people, [], 2)).toHaveLength(2);
  });
});
