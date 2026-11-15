// Turns AI research text into display tokens:
// - markdown links "[label](url)" (web search adds these, often wrapped in parentheses) and bare
//   URLs become source citations, shown as a small icon chip instead of the raw address
// - **Name** marks a person's name (the research prompt asks for this), shown highlighted
// Pure functions, safe on server and client.

export type RichToken =
  | { kind: "text"; text: string }
  | { kind: "source"; href: string; host: string }
  | { kind: "person"; text: string };

const PATTERN =
  /\(?\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)\)?|\*\*([^*]+?)\*\*|(https?:\/\/[^\s)<>"']+[^\s)<>"'.,;:!?])/g;

// Drops tracking parameters (web search appends utm_source=openai) and fragments.
export function cleanHref(raw: string): string {
  try {
    const u = new URL(raw);
    for (const key of [...u.searchParams.keys()]) if (/^utm_/i.test(key)) u.searchParams.delete(key);
    u.hash = "";
    return u.toString();
  } catch {
    return raw;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function sameKey(a: string, b: string) {
  const key = (u: string) => {
    try {
      const x = new URL(u);
      return `${x.hostname.replace(/^www\./, "")}${x.pathname.replace(/\/+$/, "")}`;
    } catch {
      return u;
    }
  };
  return key(a) === key(b);
}

// `omitHref`: a citation to this address is left out (the card already shows it as its source).
export function parseRichText(input: string, omitHref?: string): RichToken[] {
  const tokens: RichToken[] = [];
  let last = 0;
  for (const m of input.matchAll(PATTERN)) {
    const start = m.index ?? 0;
    if (start > last) tokens.push({ kind: "text", text: input.slice(last, start) });
    last = start + m[0].length;
    if (m[3]) {
      tokens.push({ kind: "person", text: m[3].trim() });
      continue;
    }
    const href = cleanHref(m[2] ?? m[4]);
    if (omitHref && sameKey(href, omitHref)) continue;
    // Several citations to the same page in a row collapse into one chip.
    const prev = tokens.at(-1);
    if (prev?.kind === "source" && prev.href === href) continue;
    tokens.push({ kind: "source", href, host: hostOf(href) });
  }
  if (last < input.length) tokens.push({ kind: "text", text: input.slice(last) });

  // Tidy the text around removed citations: no space before punctuation, no trailing space.
  return tokens
    .map((t, i) => {
      if (t.kind !== "text") return t;
      let text = t.text.replace(/\s+([.,;:])/g, "$1");
      if (i === tokens.length - 1) text = text.trimEnd();
      return { ...t, text };
    })
    .filter((t) => t.kind !== "text" || t.text.length > 0);
}

// Plain text for prompts: citations removed, name markers dropped.
export function plainText(input: string): string {
  return parseRichText(input)
    .map((t) => (t.kind === "source" ? "" : t.text))
    .join("")
    .replace(/\s{2,}/g, " ")
    .trim();
}
