// The wire format between POST /api/ai/[task] and the browser (useAiStream): one JSON event per
// line (newline-delimited JSON). Pure code, shared by the server and the client.

export type StreamEvent =
  | { type: "stage"; text: string } // one line saying what Polaris is doing now
  | { type: "draft"; text: string } // the email written so far (pitch email only)
  | { type: "heartbeat" } // every 15 seconds, so nothing on the way closes an idle connection
  | { type: "done"; message: string; redirect?: string }
  | { type: "error"; message: string };

export function encodeEvent(event: StreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}

// Returns a function that takes text chunks as they arrive and returns every complete event.
// A chunk may end in the middle of a line; that part waits for the next chunk.
export function createEventDecoder() {
  let buffer = "";
  return (chunk: string): StreamEvent[] => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    const events: StreamEvent[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as StreamEvent;
        if (parsed && typeof parsed.type === "string") events.push(parsed);
      } catch {
        // A malformed line is skipped rather than ending the stream.
      }
    }
    return events;
  };
}

// Reads the value of the first string field `key` from JSON that is still being written, for
// example `{"email":{"subject":"Hi","body":"Dear Ana, I saw` gives "Dear Ana, I saw" for "body".
// Returns null until the field has started.
export function partialStringField(json: string, key: string): string | null {
  const match = new RegExp(`"${key}"\\s*:\\s*"`).exec(json);
  if (!match) return null;
  let out = "";
  for (let i = match.index + match[0].length; i < json.length; i++) {
    const ch = json[i];
    if (ch === '"') return out;
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = json[i + 1];
    if (next === undefined) return out; // escape cut off at the end of the chunk
    const simple: Record<string, string> = { n: "\n", t: "\t", r: "", '"': '"', "\\": "\\", "/": "/", b: "", f: "" };
    if (next in simple) {
      out += simple[next];
      i++;
    } else if (next === "u") {
      const hex = json.slice(i + 2, i + 6);
      if (hex.length < 4) return out;
      out += String.fromCharCode(parseInt(hex, 16));
      i += 5;
    } else {
      i++;
    }
  }
  return out;
}
