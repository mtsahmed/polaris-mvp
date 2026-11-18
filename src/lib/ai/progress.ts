// What an AI provider reports while it works. The route handler turns these into lines for the
// browser (describeProgress). Pure code, so it can be unit-tested.

export type AiProgress =
  | { kind: "model"; name: string } // starting on this model
  | { kind: "fallback"; reason: string } // Auto: Claude unavailable, moving to OpenAI
  | { kind: "search"; query?: string }
  | { kind: "read"; url: string }
  | { kind: "think" }
  | { kind: "write" }
  | { kind: "delta"; text: string }; // a piece of the answer as it is written (JSON text)

export type ProgressSink = (event: AiProgress) => void;

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// One line for the "Polaris is working" panel, or null when the event has no line of its own.
// `writing` is the task's own wording, e.g. "Writing the first email and follow-up…".
export function describeProgress(event: AiProgress, writing: string): string | null {
  switch (event.kind) {
    case "model":
      return `Starting with ${event.name}…`;
    case "fallback":
      return `${event.reason} Switching to OpenAI…`;
    case "search":
      return event.query ? `Searching the web for “${event.query}”…` : "Searching the web…";
    case "read":
      return `Reading ${host(event.url)}…`;
    case "think":
      return "Thinking it through…";
    case "write":
      return writing;
    case "delta":
      return null;
  }
}
