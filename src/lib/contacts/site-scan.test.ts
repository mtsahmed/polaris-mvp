import { describe, expect, it } from "vitest";
import { bareDomain, contactPageLinks, extractSiteDetails, isGenericInbox } from "./site-scan";

const html = `
<header><a href="tel:+18882842257">888-284-2257</a> <a href="mailto:care@naturahq.com?subject=Hi">Email us</a></header>
<p>Write to j.posey@naturahq.com or our widget at help@wixpress.com</p>
<a href="tel:888-284-2257">Call</a>
<a href="https://wa.me/12105550101">WhatsApp</a>
<img src="logo@2x.png">
<a href="/contact/">Contact</a> <a href="https://naturahq.com/locations/austin">Austin</a> <a href="https://other.com/contact">x</a>`;

describe("extractSiteDetails", () => {
  const d = extractSiteDetails(html, "naturahq.com");
  it("reads mailto links and company-domain emails, not other domains", () => {
    expect(d.emails.sort()).toEqual(["care@naturahq.com", "j.posey@naturahq.com"]);
  });
  it("reads tel links once per number", () => {
    expect(d.phones).toEqual(["+18882842257"]);
  });
  it("reads WhatsApp links", () => {
    expect(d.whatsapps).toEqual(["12105550101"]);
  });
});

describe("structured data", () => {
  it("reads email and telephone from JSON-LD", () => {
    const ld = `<script type="application/ld+json">{"@type":"Organization","email": "care@naturahq.com","telephone":"+1-888-284-2257"}</script>`;
    const d = extractSiteDetails(ld, "naturahq.com");
    expect(d.emails).toEqual(["care@naturahq.com"]);
    expect(d.phones).toEqual(["+1-888-284-2257"]);
  });
});

describe("helpers", () => {
  it("tells company inboxes from personal ones", () => {
    expect(isGenericInbox("care@naturahq.com")).toBe(true);
    expect(isGenericInbox("j.posey@naturahq.com")).toBe(false);
  });
  it("finds contact pages on the same site", () => {
    expect(contactPageLinks(html, "https://naturahq.com/")).toEqual(["https://naturahq.com/contact/", "https://naturahq.com/locations/austin"]);
  });
  it("normalises domains", () => {
    expect(bareDomain("https://www.NaturaHQ.com/about")).toBe("naturahq.com");
    expect(bareDomain("naturahq.com")).toBe("naturahq.com");
  });
});
