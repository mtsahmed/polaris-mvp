// Normalizes a URL for "did the AI really see this page?" checks: host without www, path without
// trailing slash, no query or fragment. Returns null for anything that is not an http(s) URL.
export function urlKey(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    return null;
  }
}
