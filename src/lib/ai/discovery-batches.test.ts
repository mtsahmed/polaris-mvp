import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { planDiscoveryBatches } = await import("./discovery");

describe("planDiscoveryBatches", () => {
  it("splits 10 companies into two parallel batches, one per ICP industry share", () => {
    expect(planDiscoveryBatches(10, ["Audio software", "Record labels", "Podcast networks"])).toEqual([
      { ask: 6, angle: "Audio software; Podcast networks" },
      { ask: 6, angle: "Record labels" },
    ]);
  });

  it("gives extra batches their own angle when there are fewer industries than batches", () => {
    const batches = planDiscoveryBatches(20, ["Audio software"]);
    expect(batches).toHaveLength(4);
    expect(batches[0].angle).toBe("Audio software");
    const angles = batches.map((b) => b.angle);
    expect(new Set(angles).size).toBe(4);
    expect(batches.every((b) => b.ask === 6)).toBe(true);
  });

  it("runs one batch for small counts", () => {
    expect(planDiscoveryBatches(5, ["A", "B"])).toEqual([{ ask: 6, angle: null }]);
  });
});
