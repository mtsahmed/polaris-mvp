import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { AiProgress, ProgressSink } from "./progress";

// The progress sink for the AI job running in this async context. The streaming route sets it
// with withAiProgress(); generateStructured() and the providers read it with currentProgress().
// Code that runs outside a streaming route (server actions, background jobs) gets a no-op, so
// nothing else has to pass a callback around.
const storage = new AsyncLocalStorage<ProgressSink>();

export function withAiProgress<T>(sink: ProgressSink, fn: () => Promise<T>): Promise<T> {
  return storage.run(sink, fn);
}

const noop: ProgressSink = () => {};

export function currentProgress(): ProgressSink {
  const sink = storage.getStore();
  if (!sink) return noop;
  // A broken sink (for example a closed stream) must never fail the AI job itself.
  return (event: AiProgress) => {
    try {
      sink(event);
    } catch {
      // ignored
    }
  };
}
