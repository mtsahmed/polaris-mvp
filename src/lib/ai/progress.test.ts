import { describe, expect, it } from "vitest";
import { describeProgress } from "./progress";

const WRITING = "Writing the first email and follow-up…";

describe("describeProgress", () => {
  it("names the search query when it is known", () => {
    expect(describeProgress({ kind: "search", query: "Natura funding 2026" }, WRITING)).toBe(
      "Searching the web for “Natura funding 2026”…",
    );
    expect(describeProgress({ kind: "search" }, WRITING)).toBe("Searching the web…");
  });

  it("shows only the site for a page being read", () => {
    expect(describeProgress({ kind: "read", url: "https://www.naturahq.com/about?x=1" }, WRITING)).toBe("Reading naturahq.com…");
    expect(describeProgress({ kind: "read", url: "not a url" }, WRITING)).toBe("Reading not a url…");
  });

  it("uses the task's own wording while writing", () => {
    expect(describeProgress({ kind: "write" }, WRITING)).toBe(WRITING);
  });

  it("covers the model, the fallback and thinking", () => {
    expect(describeProgress({ kind: "model", name: "Claude Opus 5.5" }, WRITING)).toBe("Starting with Claude Opus 5.5…");
    expect(describeProgress({ kind: "fallback", reason: "Claude account has no credit." }, WRITING)).toBe(
      "Claude account has no credit. Switching to OpenAI…",
    );
    expect(describeProgress({ kind: "think" }, WRITING)).toBe("Thinking it through…");
  });

  it("gives no line for pieces of the answer", () => {
    expect(describeProgress({ kind: "delta", text: '{"email"' }, WRITING)).toBeNull();
  });
});
