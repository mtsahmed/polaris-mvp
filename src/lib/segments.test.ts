import { describe, expect, it } from "vitest";
import { OTHER_SEGMENT, resolveSegment, segmentOptions } from "./segments";

const options = segmentOptions(["Audio software and music-production tool companies", "Independent record labels", " ", "independent record labels"]);

describe("segmentOptions", () => {
  it("keeps the ICP industries in order, without blanks or repeats", () => {
    expect(options).toEqual(["Audio software and music-production tool companies", "Independent record labels"]);
  });
});

describe("resolveSegment", () => {
  it("takes the AI's choice when it names a segment", () => {
    expect(resolveSegment("independent record labels", "Music", options)).toBe("Independent record labels");
  });

  it("matches by shared words when the choice is reworded or missing", () => {
    expect(resolveSegment("", "Audio plugins and software", options)).toBe("Audio software and music-production tool companies");
    expect(resolveSegment("Record label", null, options)).toBe("Independent record labels");
  });

  it("falls back to Other when nothing matches", () => {
    expect(resolveSegment("", "Commercial real estate", options)).toBe(OTHER_SEGMENT);
  });

  it("uses the company's industry when the profile has no ICP industries", () => {
    expect(resolveSegment("", "Commercial real estate", [])).toBe("Commercial real estate");
    expect(resolveSegment(null, null, [])).toBe(OTHER_SEGMENT);
  });
});
