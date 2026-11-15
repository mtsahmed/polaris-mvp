import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csv", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell("Branch Manager, Austin")).toBe('"Branch Manager, Austin"');
    expect(csvCell('Say "hi"')).toBe('"Say ""hi"""');
    expect(csvCell(null)).toBe("");
  });

  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+1 210 555 0101")).toBe("'+1 210 555 0101");
  });

  it("joins rows with CRLF", () => {
    expect(toCsv(["a", "b"], [["1", "2"]])).toBe("a,b\r\n1,2\r\n");
  });
});
