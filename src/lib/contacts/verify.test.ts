import { describe, expect, it } from "vitest";
import { emailOnPage, normalizeEmail, pageTextFromHtml, phoneOnPage, whatsappOnPage } from "./verify";

const html = `<html><head><script>var x="fake@nowhere.com"</script></head><body>
  <p>Contact <a href="mailto:Info@NaturaHQ.com?subject=Hi">our team</a></p>
  <p>Call (210) 555-0101 or jane&#64;naturahq.com</p></body></html>`;

describe("pageTextFromHtml", () => {
  it("keeps mailto addresses and decodes @, drops scripts", () => {
    const t = pageTextFromHtml(html);
    expect(t).toContain("Info@NaturaHQ.com");
    expect(t).toContain("jane@naturahq.com");
    expect(t).not.toContain("fake@nowhere.com");
  });
});

describe("emailOnPage", () => {
  const t = pageTextFromHtml(html);
  it("finds addresses printed on the page, ignoring case", () => {
    expect(emailOnPage("info@naturahq.com", t)).toBe(true);
    expect(emailOnPage("jane@naturahq.com", t)).toBe(true);
  });
  it("rejects a guessed address", () => {
    expect(emailOnPage("jane.doe@naturahq.com", t)).toBe(false);
    expect(emailOnPage("fake@nowhere.com", t)).toBe(false);
  });
  it("rejects malformed input", () => {
    expect(normalizeEmail("not an email")).toBeNull();
  });
});

describe("phoneOnPage", () => {
  const t = pageTextFromHtml(html);
  it("matches a number in any formatting", () => {
    expect(phoneOnPage("+1 210-555-0101", t)).toBe(true);
    expect(phoneOnPage("2105550101", t)).toBe(true);
  });
  it("rejects a number not on the page", () => {
    expect(phoneOnPage("(210) 555-0199", t)).toBe(false);
    expect(phoneOnPage("123", t)).toBe(false);
  });
});

describe("whatsappOnPage", () => {
  const t = pageTextFromHtml('<p>Chat with us <a href="https://wa.me/12105550142">on WhatsApp</a></p>');
  it("finds a number held only in a wa.me link", () => {
    expect(whatsappOnPage("+1 210 555 0142", t)).toBe(true);
  });
  it("rejects a number not on the page", () => {
    expect(whatsappOnPage("+1 210 555 0199", t)).toBe(false);
  });
});
