import { describe, expect, it } from "vitest";
import { cleanLabels } from "./assemble";

describe("cleanLabels", () => {
  it("removes label groups when no links are given", () => {
    expect(cleanLabels("It is an operator (N1, E2). It fits (N3).")).toBe("It is an operator. It fits.");
  });

  it("removes a leading label from a finding summary", () => {
    expect(cleanLabels("N4: A listing dated October 22.")).toBe("A listing dated October 22.");
  });

  it("swaps label groups for the findings' links", () => {
    const urlOf = new Map([
      ["N1", "https://a.example/x"],
      ["E2", "https://b.example/y"],
    ]);
    expect(cleanLabels("Plausible customer (N1, E2).", urlOf)).toBe(
      "Plausible customer https://a.example/x https://b.example/y.",
    );
  });

  it("drops unknown labels and leaves ordinary brackets alone", () => {
    expect(cleanLabels("Fits (N9) well (in Austin).", new Map())).toBe("Fits well (in Austin).");
  });
});
