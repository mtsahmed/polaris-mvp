import { after } from "next/server";
import { AI_JOBS } from "@/lib/ai-jobs/registry";
import { isAiTask } from "@/lib/ai-jobs/tasks";
import { describeProgress, type AiProgress } from "@/lib/ai/progress";
import { withAiProgress } from "@/lib/ai/progress-context";
import { encodeEvent, partialStringField, type StreamEvent } from "@/lib/ai-stream/events";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

// Runs one AI job a user waits on (profile insights, ICP draft, Find companies, pitch research,
// concepts and email) and streams its progress as newline-delimited JSON (StreamEvent).
// - The job runs apart from the response and is kept alive with after(), so it finishes and
//   saves its result even if the browser closes or the connection drops.
// - A heartbeat every 15 seconds keeps proxies and browsers from closing a quiet connection.
// - Streaming does not extend the time limit: a job still has maxDuration seconds.
export const maxDuration = 300;

const HEARTBEAT_MS = 15_000;
const DRAFT_EVERY_MS = 250;

export async function POST(request: Request, { params }: { params: Promise<{ task: string }> }) {
  const { task } = await params;
  if (!isAiTask(task)) return Response.json({ error: "Unknown AI task." }, { status: 404 });
  const job = AI_JOBS[task];

  const session = await requireSession(); // redirects to sign-in when signed out
  const body = await request.json().catch(() => null);
  const parsed = job.input.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Check the form." }, { status: 400 });
  }
  const supabase = await createClient();

  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let open = true;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      open = false; // the browser went away; the job keeps running
    },
  });

  const send = (event: StreamEvent) => {
    if (!open || !controller) return;
    try {
      controller.enqueue(encoder.encode(encodeEvent(event)));
    } catch {
      open = false;
    }
  };

  let lastStage = "";
  const stage = (text: string) => {
    if (text === lastStage) return;
    lastStage = text;
    send({ type: "stage", text });
  };

  // The answer arrives as JSON text. For an email the draft body is pulled out and sent as it
  // grows, at most every DRAFT_EVERY_MS.
  let answer = "";
  let lastDraft = "";
  let lastDraftAt = 0;
  const onProgress = (event: AiProgress) => {
    if (event.kind === "delta") {
      answer += event.text;
      if (!job.draftField) return;
      const draft = partialStringField(answer, job.draftField);
      const now = Date.now();
      if (draft && draft !== lastDraft && now - lastDraftAt >= DRAFT_EVERY_MS) {
        lastDraft = draft;
        lastDraftAt = now;
        send({ type: "draft", text: draft });
      }
      return;
    }
    if (event.kind !== "write") answer = ""; // a new turn or a new model starts a new answer
    const line = describeProgress(event, job.writing);
    if (line) stage(line);
  };

  const heartbeat = setInterval(() => send({ type: "heartbeat" }), HEARTBEAT_MS);
  stage("Getting started…");

  const work = withAiProgress(onProgress, () => job.run({ session, supabase, report: stage }, parsed.data))
    .then((result) =>
      send(result.ok ? { type: "done", message: result.message, redirect: result.redirect } : { type: "error", message: result.message }),
    )
    .catch((err) => {
      console.error(`[api/ai/${task}]`, err);
      send({ type: "error", message: err instanceof Error ? err.message : "The AI request failed." });
    })
    .finally(() => {
      clearInterval(heartbeat);
      if (open && controller) {
        open = false;
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    });
  after(() => work);

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
