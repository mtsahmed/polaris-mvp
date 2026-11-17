import { writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, test, vi } from "vitest";
import { DEFAULT_INPUTS } from "./model";

vi.mock("server-only", () => ({}));

describe("buildImpactReport", () => {
  test("builds a one-page PDF for both goals", async () => {
    const { buildImpactReport } = await import("./report-pdf");
    for (const goal of ["partnerships", "customers"] as const) {
      const bytes = await buildImpactReport({
        name: "Sam Rivera",
        company: "Northwind Studio",
        goal,
        inputs: { ...DEFAULT_INPUTS, replyUplift: 1, dealValue: 25000 },
        createdAt: new Date("2026-11-17T12:00:00Z"),
      });
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBe(1);
      expect(doc.getTitle()).toContain("Polaris");
      // Optional: write a sample to look at (PDF_SAMPLE=path npm test).
      if (process.env.PDF_SAMPLE) writeFileSync(`${process.env.PDF_SAMPLE}-${goal}.pdf`, bytes);
    }
  });
});
