"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AiTask } from "@/lib/ai-jobs/tasks";
import { createEventDecoder } from "./events";

const POLL_MS = 10_000;
const POLL_FOR_MS = 6 * 60_000; // a little longer than the 300-second job limit

export const DROPPED_LINE =
  "The connection dropped, but Polaris keeps working and saves the result. This page checks for it every 10 seconds.";

type State = {
  status: "idle" | "running" | "dropped";
  line: string;
  draft: string;
  error: string | null;
  startKey: string | null; // resultKey when the run started
};

const IDLE: State = { status: "idle", line: "", draft: "", error: null, startKey: null };

async function errorMessage(res: Response): Promise<string> {
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    if (body?.error) return body.error;
  }
  if (res.redirected || type.includes("text/html")) return "Your session has ended. Sign in again, then retry.";
  return `The request failed (${res.status}). Try again.`;
}

// Runs one AI task through POST /api/ai/[task] and follows its progress.
// - On "done" the page refreshes (or opens the result page), on "error" the message shows.
// - If the connection drops before either, the job still finishes on the server. The page then
//   refreshes every 10 seconds until `resultKey` (something that changes when the result is
//   saved, such as a timestamp) differs from its value at the start, or gives up after 6 minutes.
export function useAiStream(task: AiTask, resultKey: string | null) {
  const router = useRouter();
  const [state, setState] = useState<State>(IDLE);

  const waiting = state.status === "dropped" && resultKey === state.startKey;

  useEffect(() => {
    if (!waiting) return;
    const started = Date.now();
    const id = setInterval(() => {
      if (Date.now() - started > POLL_FOR_MS) {
        clearInterval(id);
        setState({ ...IDLE, error: "Polaris could not confirm the result. Reload the page to check, or run it again." });
        return;
      }
      router.refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [waiting, router]);

  async function run(body: Record<string, unknown>, firstLine: string) {
    setState({ status: "running", line: firstLine, draft: "", error: null, startKey: resultKey });
    let finished = false;
    try {
      const res = await fetch(`/api/ai/${task}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body || !(res.headers.get("content-type") ?? "").includes("ndjson")) {
        const message = await errorMessage(res);
        toast.error(message);
        setState({ ...IDLE, error: message });
        return;
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      const decode = createEventDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const event of decode(value)) {
          if (event.type === "stage") setState((s) => ({ ...s, line: event.text }));
          else if (event.type === "draft") setState((s) => ({ ...s, draft: event.text }));
          else if (event.type === "done") {
            finished = true;
            toast.success(event.message);
            setState(IDLE);
            if (event.redirect) router.push(event.redirect);
            else router.refresh();
          } else if (event.type === "error") {
            finished = true;
            toast.error(event.message);
            setState({ ...IDLE, error: event.message });
          }
        }
      }
    } catch {
      // The network failed mid-run; handled below.
    }
    if (!finished) setState((s) => ({ ...s, status: "dropped", line: DROPPED_LINE }));
  }

  return {
    run,
    running: state.status === "running",
    waiting,
    line: state.line,
    draft: state.draft,
    error: state.error,
  };
}
