import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const TIMEOUT_MS = 15_000;
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_CHARS = 60_000;
const MAX_REDIRECTS = 3;

export type FetchedPage =
  | { ok: true; url: string; title: string | null; text: string; isPdf: false }
  | { ok: true; url: string; title: string | null; base64: string; isPdf: true }
  | { ok: false; url: string; error: string };

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb");
}

// Refuses anything that is not a public http(s) address, so user-supplied links
// cannot be used to reach the server's own network.
async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http and https links can be read.");
  if (url.username || url.password) throw new Error("Links with embedded credentials are not allowed.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("Only standard web ports can be read.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) throw new Error("That address is not a public website.");
  return url;
}

function decodeEntities(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function htmlToText(html: string): { title: string | null; text: string } {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null;
  const text = html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const clean = decodeEntities(text)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return { title: title ? decodeEntities(title) : null, text: clean.slice(0, MAX_CHARS) };
}

async function readCapped(res: Response): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(Math.min(total, MAX_BYTES));
  let offset = 0;
  for (const c of chunks) {
    out.set(c.subarray(0, out.length - offset), offset);
    offset += c.byteLength;
    if (offset >= out.length) break;
  }
  return out;
}

// Downloads one public page and returns its readable text (or the PDF bytes).
export async function fetchPage(rawUrl: string): Promise<FetchedPage> {
  let current = rawUrl;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const url = await assertPublicUrl(current);
      const res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": "PolarisResearchBot/1.0", accept: "text/html,application/pdf;q=0.9,*/*;q=0.5" },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        current = new URL(res.headers.get("location")!, url).toString();
        continue;
      }
      if (!res.ok) return { ok: false, url: rawUrl, error: `The site answered ${res.status}.` };

      const type = res.headers.get("content-type") ?? "";
      const body = await readCapped(res);
      if (type.includes("application/pdf")) {
        return { ok: true, url: current, title: null, base64: Buffer.from(body).toString("base64"), isPdf: true };
      }
      const { title, text } = htmlToText(new TextDecoder().decode(body));
      if (text.length < 40) {
        return { ok: false, url: rawUrl, error: "The page has almost no readable text (it may need JavaScript to load)." };
      }
      return { ok: true, url: current, title, text, isPdf: false };
    }
    return { ok: false, url: rawUrl, error: "Too many redirects." };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read the page.";
    return { ok: false, url: rawUrl, error: message.includes("timeout") || message.includes("aborted") ? "The site took too long to answer." : message };
  }
}
