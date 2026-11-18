import { describe, expect, it } from "vitest";
import { formatQa, mergeQa, parseQa } from "./questionnaire";

describe("open-question answers", () => {
  it("round-trips pairs, including answers with blank lines", () => {
    const pairs = [
      { q: "Who are your clients?", a: "Indie labels.\n\nSome podcasts." },
      { q: "Where are you based?", a: "London" },
    ];
    expect(parseQa(formatQa(pairs))).toEqual(pairs);
    expect(parseQa(null)).toEqual([]);
  });

  it("replaces, removes and keeps answers when merging", () => {
    const saved = [
      { q: "A?", a: "old" },
      { q: "B?", a: "keep me" },
      { q: "C?", a: "remove me" },
    ];
    expect(
      mergeQa(saved, [
        { q: "A?", a: "new" },
        { q: "C?", a: "  " },
        { q: "D?", a: "added" },
      ]),
    ).toEqual([
      { q: "A?", a: "new" },
      { q: "B?", a: "keep me" },
      { q: "D?", a: "added" },
    ]);
  });
});
