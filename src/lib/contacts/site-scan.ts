// Reads the contact details a company publishes on its own website: mailto: links, tel: links,
// WhatsApp click-to-chat links and email addresses on the company's domain printed in the page.
// Pure (no fetching), unit-tested. Every detail comes straight from the page, nothing is guessed.

import { digits, normalizeEmail, pageTextFromHtml } from "./verify";

export type SiteDetails = { emails: string[]; phones: string[]; whatsapps: string[] };

// Inboxes that belong to the company rather than one person.
const GENERIC = new Set([
  "info", "care", "hello", "hi", "contact", "contactus", "office", "sales", "support", "help", "admin", "team",
  "inquiries", "enquiries", "service", "customerservice", "marketing", "press", "media", "partners", "partnerships",
  "business", "bookings", "booking", "general", "mail", "accounts", "billing", "jobs", "careers", "hr",
]);

export function isGenericInbox(email: string) {
  return GENERIC.has(email.split("@")[0].replace(/[^a-z]/g, ""));
}

const hostMatches = (emailHost: string, domain: string) => emailHost === domain || emailHost.endsWith(`.${domain}`);

export function bareDomain(urlOrDomain: string): string {
  try {
    const u = new URL(/^https?:\/\//i.test(urlOrDomain) ? urlOrDomain : `https://${urlOrDomain}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return urlOrDomain.replace(/^www\./, "").toLowerCase();
  }
}

export function extractSiteDetails(html: string, domain: string): SiteDetails {
  const emails = new Set<string>();
  const phones = new Map<string, string>(); // digits -> number as printed in the link
  const whatsapps = new Set<string>();

  for (const m of html.matchAll(/href\s*=\s*["']mailto:([^"'?]+)/gi)) {
    const e = normalizeEmail(decodeURIComponent(m[1]));
    if (e) emails.add(e);
  }
  // Plain-text addresses only when they are on the company's own domain (skips widget and
  // platform addresses that site builders embed).
  const text = pageTextFromHtml(html);
  for (const m of text.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) {
    const e = normalizeEmail(m[0]);
    if (e && hostMatches(e.split("@")[1], domain)) emails.add(e);
  }
  const addPhone = (raw: string) => {
    const printed = raw.trim();
    const d = digits(printed);
    if (d.length >= 10 && d.length <= 15 && !phones.has(d.slice(-10))) phones.set(d.slice(-10), printed);
  };
  for (const m of html.matchAll(/href\s*=\s*["']tel:([^"']+)/gi)) addPhone(decodeURIComponent(m[1]));
  // Structured data (schema.org JSON-LD) the site publishes about itself: "email" and "telephone".
  // pageTextFromHtml drops scripts, so these blocks are read here.
  for (const block of html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const m of block[1].matchAll(/"email"\s*:\s*"([^"]+)"/gi)) {
      const e = normalizeEmail(m[1]);
      if (e) emails.add(e);
    }
    for (const m of block[1].matchAll(/"telephone"\s*:\s*"([^"]+)"/gi)) addPhone(m[1]);
  }
  for (const m of html.matchAll(/(?:wa\.me\/|whatsapp\.com\/send\/?\?phone=)(\d{8,15})/gi)) whatsapps.add(m[1]);

  return { emails: [...emails], phones: [...phones.values()], whatsapps: [...whatsapps] };
}

// Links on the homepage that lead to a contact page on the same site (at most `limit`).
export function contactPageLinks(html: string, baseUrl: string, limit = 2): string[] {
  const base = new URL(baseUrl);
  const out: string[] = [];
  for (const m of html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
    let url: URL;
    try {
      url = new URL(m[1], base);
    } catch {
      continue;
    }
    if (url.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
    if (!/contact|get-in-touch|locations?\b|offices?\b/i.test(url.pathname)) continue;
    const clean = `${url.origin}${url.pathname}`;
    if (!out.includes(clean) && clean !== `${base.origin}${base.pathname}`) out.push(clean);
    if (out.length >= limit) break;
  }
  return out;
}
