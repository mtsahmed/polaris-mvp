import "server-only";
import { z } from "zod";
import type { ProviderAttempt } from "@/lib/ai/types";
import { researchProvider } from "@/lib/research/provider";
import { hostOf } from "@/lib/rich-text";
import { urlKey } from "@/lib/url-key";
import type { FoundContact } from "./sources/types";
import { digits, emailOnPage, fetchPageText, normalizeEmail, phoneOnPage, whatsappOnPage } from "./verify";

// Finds published business contact details on the public web: the company's own site first
// (contact, about and team pages), then other public pages that name its staff. Polaris downloads
// each cited page itself and looks for the exact email or number on it. Numbers not on the page
// are dropped; emails not on the page are kept but marked "Not confirmed" (owner's choice,
// 15 November 2026), with the reason recorded for the Contacts page.

const FoundSchema = z.object({
  contacts: z
    .array(
      z.object({
        name: z
          .string()
          .describe('The person\'s full name as printed, or "General inbox" / "Main office" for a company-wide contact.'),
        title: z.string().describe("Job title as printed, or an empty string."),
        email: z.string().describe("Email address exactly as printed on the source page, or an empty string."),
        phone: z.string().describe("Business phone number exactly as printed on the source page, or an empty string."),
        phone_kind: z.enum(["office", "mobile", "unknown"]).describe("mobile only if the page says it is a mobile or cell."),
        whatsapp: z
          .string()
          .describe("WhatsApp number as printed, or the digits of a wa.me / api.whatsapp.com link on the page; empty string if none."),
        source_url: z.string().describe("Exact URL of the page where these details are printed."),
      }),
    )
    .describe("Up to 12 contacts, the roles to approach first, then company-wide contacts."),
  notes: z.string().describe("One or two sentences: where you looked and what was not found."),
});

const SYSTEM = `You find published business contact details for Polaris, a B2B outreach tool. Polaris shows every detail to a person who decides whether to contact anyone.

Rules:
- Copy only email addresses, phone numbers and WhatsApp numbers that are printed on a page you read (a WhatsApp number may be the digits in a wa.me or api.whatsapp.com link). Never construct, guess or complete an address from a name pattern (for example firstname@company.com), and never "fix" one.
- Start with the company's own website: its contact, about, team, leadership, staff and location pages. Then search the web for public pages that list its staff in the roles asked for (press releases, association directories, event speaker pages, local business listings).
- Business details only: work emails, office or company lines, and business mobiles or WhatsApp numbers the person or company published for work. No home addresses, personal social media accounts or data-broker sites.
- Each contact's source_url is the page where its email or numbers are printed. If a person is named on one page and their email on another, list the page with the email.
- A person with no published email or phone is still worth listing (with empty details) when they hold one of the roles asked for and the source names them.
- Company-wide contacts (a general inbox, the main office line, a branch's line) are listed as "General inbox" or "Main office"; add the branch city to the title when there is one.`;

export type WebFindResult = {
  kept: FoundContact[];
  dropped: number; // phone or WhatsApp numbers not found on their page (not saved)
  unconfirmed: number; // emails not found on their page (saved, marked not confirmed)
  checks: string[]; // the reason for each of those
  notes: string;
  attempts: ProviderAttempt[];
};

function pageLabel(url: string) {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "")}`;
  } catch {
    return url;
  }
}

export async function findContactsOnWeb(input: {
  companyName: string;
  website: string | null;
  location: string | null;
  roles: string[];
}): Promise<WebFindResult> {
  const result = await researchProvider().run({
    task: "contacts-web",
    system: SYSTEM,
    prompt: `Company: ${input.companyName}
${input.website ? `Website (W1): ${input.website}` : "Website: not known"}
${input.location ? `Location: ${input.location}` : ""}
Roles to approach first: ${input.roles.length ? input.roles.join("; ") : "decision-makers for marketing, partnerships or operations"}

Find who to contact at this company and their published work email, phone and WhatsApp numbers.`,
    schema: FoundSchema,
    schemaName: "web_contacts",
    urls: input.website ? [{ label: "W1", url: input.website }] : undefined,
    maxSearches: 6,
    effort: "medium",
    maxTokens: 8000,
  });

  const seen = new Set(result.seenUrls.map(urlKey).filter(Boolean));
  const pages = new Map<string, Promise<string | null>>();
  const page = (url: string) => {
    if (!pages.has(url)) pages.set(url, fetchPageText(url));
    return pages.get(url)!;
  };

  // Every detail is checked by Polaris downloading the cited page itself (pages the search did not
  // open are checked the same way). Confirmed details are saved as found. An email that is not on
  // its page is still saved, at the owner's request, but marked "Not confirmed" (it may be
  // guessed); a phone or WhatsApp number that is not on its page is dropped. Each case gets a reason.
  let dropped = 0;
  let unconfirmed = 0;
  const checks: string[] = [];
  const kept: FoundContact[] = [];
  for (const c of result.data.contacts.slice(0, 12)) {
    const url = c.source_url.trim();
    const name = c.name.trim();
    if (!name) continue;
    const text = url ? await page(url) : null;
    const where = !url
      ? "no source page given"
      : text === null
        ? `${pageLabel(url)} could not be read${seen.has(urlKey(url)) ? "" : " and the search never opened it"}`
        : `not on ${pageLabel(url)}`;

    const rawEmail = c.email.trim() ? normalizeEmail(c.email) : null;
    const emailConfirmed = Boolean(rawEmail && text && emailOnPage(rawEmail, text));
    if (rawEmail && !emailConfirmed) {
      unconfirmed += 1;
      checks.push(`Email ${rawEmail} (${name}): ${where}. Saved as not confirmed; it may be guessed.`);
    }
    const phone = c.phone.trim() && text && phoneOnPage(c.phone, text) ? c.phone.trim() : null;
    if (c.phone.trim() && !phone) {
      dropped += 1;
      checks.push(`Phone ${c.phone.trim()} (${name}): ${where}. Not saved.`);
    }
    const whatsapp = c.whatsapp.trim() && text && whatsappOnPage(c.whatsapp, text) ? c.whatsapp.trim() : null;
    if (c.whatsapp.trim() && !whatsapp) {
      dropped += 1;
      checks.push(`WhatsApp ${c.whatsapp.trim()} (${name}): ${where}. Not saved.`);
    }
    // A person with no detail at all is kept only when the page itself names them.
    if (!rawEmail && !phone && !whatsapp && !(text && text.toLowerCase().includes(name.toLowerCase()))) {
      if (url) checks.push(`${name}: ${text === null ? where : `name not found on ${pageLabel(url)}`}. Not saved.`);
      continue;
    }
    const isMobile = c.phone_kind === "mobile";
    kept.push({
      name,
      title: c.title.trim() || null,
      email: rawEmail,
      emailStatus: rawEmail ? "unverified" : "missing",
      emailUnconfirmed: Boolean(rawEmail && !emailConfirmed),
      phone: isMobile ? null : phone,
      mobile: isMobile ? phone : null,
      whatsapp,
      source: `Web: ${url ? hostOf(url) : "search"}`,
      sourceUrl: url || null,
    });
  }

  // One entry per email, then per name and number.
  const unique: FoundContact[] = [];
  for (const c of kept) {
    const num = digits(c.phone ?? c.mobile ?? c.whatsapp ?? "");
    const dup = unique.find(
      (u) =>
        (c.email && u.email === c.email) ||
        (!c.email && u.name === c.name && num && digits(u.phone ?? u.mobile ?? u.whatsapp ?? "") === num),
    );
    if (!dup) unique.push(c);
  }
  return { kept: unique, dropped, unconfirmed, checks, notes: result.data.notes.trim(), attempts: result.attempts };
}
