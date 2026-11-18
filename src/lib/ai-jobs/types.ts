import "server-only";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import type { SessionContext } from "@/lib/session";
import type { createClient } from "@/lib/supabase/server";

export type Db = Awaited<ReturnType<typeof createClient>>;

export type JobContext = {
  session: SessionContext;
  supabase: Db;
  // Sends one "what Polaris is doing" line to the browser, for steps after the AI call
  // (for example "Saving the findings…").
  report: (line: string) => void;
};

export type JobResult = { ok: true; message: string; redirect?: string } | { ok: false; message: string };

// One AI job that POST /api/ai/[task] can run. The job saves its own result, so it finishes
// even if the browser closes or the connection drops.
export type AiJob<S extends z.ZodType> = {
  input: S;
  // The line shown while the model writes its answer.
  writing: string;
  // For jobs that write an email: the JSON field whose text is shown as it is written.
  draftField?: string;
  run: (ctx: JobContext, input: z.infer<S>) => Promise<JobResult>;
};

export const done = (message: string, redirect?: string): JobResult => ({ ok: true, message, redirect });
export const failed = (message: string): JobResult => ({ ok: false, message });

// revalidatePath is a hint for the next visit. It must never fail a job whose result is saved,
// for example when it runs after the browser has gone.
export function revalidate(...paths: string[]) {
  for (const p of paths) {
    try {
      revalidatePath(p);
    } catch (err) {
      console.warn(`[ai-jobs] revalidatePath(${p}) skipped:`, err instanceof Error ? err.message : err);
    }
  }
}

export const NO_PROVIDER = "No AI provider is configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env.local.";
