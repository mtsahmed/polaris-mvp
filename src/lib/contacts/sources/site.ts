import "server-only";
import { hostOf } from "@/lib/rich-text";
import { bareDomain, contactPageLinks, extractSiteDetails, isGenericInbox } from "../site-scan";
import { digits } from "../verify";
import type { FoundContact, SourceContext, SourceResult } from "./types";

// Free website step: Polaris downloads the company's homepage and contact pages itself and reads
// the mailto:, tel: and WhatsApp links plus emails on the company's domain. No AI and no cost;
// every detail is copied from the page, so it counts as confirmed.

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; PolarisBot/1.0)", accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
      redirect: "follow",
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

const base = (source: string, sourceUrl: string): Omit<FoundContact, "name"> => ({
  title: null,
  email: null,
  emailStatus: "missing",
  phone: null,
  mobile: null,
  whatsapp: null,
  source,
  sourceUrl,
});

export async function findOnSite(ctx: SourceContext): Promise<SourceResult> {
  const home = ctx.website ?? (ctx.domain ? `https://${ctx.domain}` : null);
  if (!home) return { outcome: "skipped", contacts: [], note: "no website known" };
  const domain = bareDomain(ctx.domain ?? home);

  const homeHtml = await fetchHtml(home);
  if (!homeHtml) return { outcome: "failed", contacts: [], note: `could not read ${hostOf(home)}` };
  const links = contactPageLinks(homeHtml, home);
  if (!links.length) links.push(new URL("/contact", home).toString());
  const pages: { url: string; html: string }[] = [{ url: home, html: homeHtml }];
  for (const url of links) {
    const html = await fetchHtml(url);
    if (html) pages.push({ url, html });
  }

  // Where each detail was first seen, so every contact links to a page that shows it.
  const firstSeen = new Map<string, string>();
  const phoneDigits = new Set<string>(); // one entry per number, however each page writes it
  for (const page of pages) {
    const d = extractSiteDetails(page.html, domain);
    const newPhones = d.phones.filter((p) => {
      const key = digits(p).slice(-10);
      if (phoneDigits.has(key)) return false;
      phoneDigits.add(key);
      return true;
    });
    for (const v of [...d.emails, ...newPhones.map((p) => `tel:${p}`), ...d.whatsapps.map((w) => `wa:${w}`)]) {
      if (!firstSeen.has(v)) firstSeen.set(v, page.url);
    }
  }
  const emails = [...firstSeen.keys()].filter((k) => !k.startsWith("tel:") && !k.startsWith("wa:"));
  const phones = [...firstSeen.keys()].filter((k) => k.startsWith("tel:"));
  const phone = phones[0];
  const whatsapp = [...firstSeen.keys()].find((k) => k.startsWith("wa:"));
  const source = `Website: ${domain}`;

  const contacts: FoundContact[] = [];
  const generic = emails.filter(isGenericInbox);
  const office = generic[0];
  if (office || phone || whatsapp) {
    contacts.push({
      ...base(source, firstSeen.get(office ?? phone ?? whatsapp!)!),
      name: "Main office",
      email: office ?? null,
      emailStatus: office ? "unverified" : "missing",
      phone: phone ? phone.slice(4) : null,
      whatsapp: whatsapp ? whatsapp.slice(3) : null,
    });
  }
  for (const e of generic.slice(1)) {
    contacts.push({ ...base(source, firstSeen.get(e)!), name: "General inbox", email: e, emailStatus: "unverified" });
  }
  // Further office lines (other branches). The site does not say which office each belongs to in a
  // form Polaris reads reliably, so each is listed under its own number for the user to rename.
  for (const p of phones.slice(1)) {
    contacts.push({ ...base(source, firstSeen.get(p)!), name: `Office line ${p.slice(4)}`, phone: p.slice(4) });
  }
  // A personal work address printed on the site; the page does not say whose it is, so it is
  // listed under the address itself for the user to name.
  for (const e of emails.filter((x) => !isGenericInbox(x))) {
    contacts.push({ ...base(source, firstSeen.get(e)!), name: `Email on website (${e.split("@")[0]})`, email: e, emailStatus: "unverified" });
  }
  return { outcome: contacts.length ? "found" : "none", contacts, note: `read ${pages.length} page${pages.length === 1 ? "" : "s"}` };
}
