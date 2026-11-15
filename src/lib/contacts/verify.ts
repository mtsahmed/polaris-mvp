// Checks that a contact detail the AI reports really appears on the page it cites. Pure helpers
// (tested) plus a page fetch. A detail that cannot be found on its source page is dropped, so a
// guessed address such as firstname@company.com never reaches the database.

export function pageTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    // mailto: and tel: links often hold the only copy of an address or number.
    .replace(/<a\b[^>]*?href\s*=\s*["'](?:mailto|tel):([^"'?]+)[^>]*>/gi, " $1 ")
    // WhatsApp click-to-chat links: wa.me/<digits> or api.whatsapp.com/send?phone=<digits>.
    .replace(/<a\b[^>]*?href\s*=\s*["'][^"']*?(?:wa\.me\/|whatsapp\.com\/send\/?\?phone=)(\d+)[^>]*>/gi, " WhatsApp $1 ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#64;|&commat;/gi, "@")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ");
}

export function normalizeEmail(email: string): string | null {
  const e = email.trim().toLowerCase().replace(/^mailto:/, "");
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e) ? e : null;
}

export function emailOnPage(email: string, text: string): boolean {
  const e = normalizeEmail(email);
  return Boolean(e && text.toLowerCase().includes(e));
}

export function digits(phone: string): string {
  return phone.replace(/\D/g, "");
}

// Matches on the last 10 digits (the US number without country code), in any formatting.
export function phoneOnPage(phone: string, text: string): boolean {
  const d = digits(phone);
  if (d.length < 7) return false;
  const key = d.slice(-10);
  return digits(text).includes(key) || text.replace(/[^\d]/g, " ").replace(/\s+/g, "").includes(key);
}

const MAX_PDF_BYTES = 15 * 1024 * 1024;

// Reads the text of a PDF (staff lists and reports are often PDFs). unpdf runs locally: no AI,
// no cost. Loaded on demand so pages that never meet a PDF do not load it.
async function pdfText(data: ArrayBuffer): Promise<string | null> {
  if (data.byteLength > MAX_PDF_BYTES) return null;
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const { text } = await extractText(pdf, { mergePages: true });
    return text.replace(/\s+/g, " ");
  } catch {
    return null;
  }
}

// Downloads a page (HTML, plain text or PDF) as plain text, or null if it cannot be read
// (blocked, timeout, another file type, a PDF over 15 MB).
export async function fetchPageText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; PolarisBot/1.0)", accept: "text/html,application/xhtml+xml,application/pdf;q=0.9" },
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
      redirect: "follow",
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (type.includes("pdf") || (/\.pdf($|\?)/i.test(new URL(res.url || url).pathname) && type.includes("octet-stream"))) {
      return pdfText(await res.arrayBuffer());
    }
    if (!type.includes("html") && !type.includes("text")) return null;
    return pageTextFromHtml(await res.text());
  } catch {
    return null;
  }
}

// A WhatsApp number counts as found when its digits appear on the page, including inside a
// wa.me or api.whatsapp.com link (kept by pageTextFromHtml).
export function whatsappOnPage(number: string, text: string): boolean {
  return phoneOnPage(number, text);
}
