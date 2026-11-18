import Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { AiProgress } from "../progress";
import { withAiProgress } from "../progress-context";
import { ProviderFailedError, ProviderUnavailableError, type StructuredRequest } from "../types";
import { runAnthropic } from "./anthropic";

// The adapter streams from Claude. These tests feed it scripted streams and check it returns the
// same result the non-streaming call did: parsed data, every URL seen, usage summed across
// continuations, and the same error classes. They also check the progress it reports.

const streamMock = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("../claude", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../claude")>()),
  claude: () => ({ beta: { messages: { stream: streamMock } } }),
}));

type Script = { events?: [string, unknown][]; message?: unknown; error?: Error };

function fakeStream(script: Script) {
  const handlers: Record<string, ((arg: unknown) => void)[]> = {};
  return {
    on(event: string, fn: (arg: unknown) => void) {
      (handlers[event] ??= []).push(fn);
      return this;
    },
    async finalMessage() {
      for (const [event, arg] of script.events ?? []) for (const fn of handlers[event] ?? []) fn(arg);
      if (script.error) throw script.error;
      return script.message;
    },
  };
}

const req: StructuredRequest<z.ZodObject<{ answer: z.ZodString }>> = {
  task: "test",
  system: "system",
  prompt: "prompt",
  schema: z.object({ answer: z.string() }),
  schemaName: "test",
  webSearch: { maxUses: 3 },
};

const usage = (input: number, output: number, searches = 0) => ({
  input_tokens: input,
  output_tokens: output,
  server_tool_use: { web_search_requests: searches },
});

beforeEach(() => streamMock.mockReset());

describe("runAnthropic (streaming)", () => {
  it("continues after pause_turn and returns the parsed answer, URLs and summed usage", async () => {
    const searchBlock = { type: "server_tool_use", name: "web_search", input: { query: "Natura news" } };
    const fetchBlock = { type: "server_tool_use", name: "web_fetch", input: { url: "https://naturahq.com/about" } };
    streamMock
      .mockReturnValueOnce(
        fakeStream({
          events: [["contentBlock", searchBlock]],
          message: {
            model: "claude-opus-5-5",
            stop_reason: "pause_turn",
            usage: usage(100, 10, 1),
            content: [
              searchBlock,
              { type: "web_search_tool_result", content: [{ type: "web_search_result", url: "https://news.example/natura" }] },
            ],
          },
        }),
      )
      .mockReturnValueOnce(
        fakeStream({
          events: [
            ["contentBlock", fetchBlock],
            ["thinking", "hmm"],
            ["text", '{"answer":'],
            ["text", '"yes"}'],
          ],
          message: {
            model: "claude-opus-5-5",
            stop_reason: "end_turn",
            usage: usage(200, 20),
            parsed_output: { answer: "yes" },
            content: [fetchBlock, { type: "web_fetch_tool_result", content: { type: "web_fetch_result", url: "https://naturahq.com/about" } }],
          },
        }),
      );

    const events: AiProgress[] = [];
    const result = await withAiProgress((e) => events.push(e), () => runAnthropic(req, "claude-opus-5-5"));

    expect(result.data).toEqual({ answer: "yes" });
    expect(result.seenUrls.sort()).toEqual(["https://naturahq.com/about", "https://news.example/natura"]);
    expect(result.attempt).toMatchObject({ provider: "anthropic", ok: true, inputTokens: 300, outputTokens: 30, searches: 1 });
    expect(result.attempt.costUsd).toBeCloseTo((300 * 4 + 30 * 20) / 1_000_000 + 0.01, 6);
    // The second call carries the first turn's content so Claude can continue.
    expect(streamMock).toHaveBeenCalledTimes(2);
    expect(streamMock.mock.calls[1][0].messages.at(-1)).toMatchObject({ role: "assistant" });
    expect(events).toEqual([
      { kind: "search", query: "Natura news" },
      { kind: "read", url: "https://naturahq.com/about" },
      { kind: "think" },
      { kind: "write" },
      { kind: "delta", text: '{"answer":' },
      { kind: "delta", text: '"yes"}' },
    ]);
  });

  it("reports a refusal as a failure that must not go to another provider", async () => {
    streamMock.mockReturnValueOnce(
      fakeStream({ message: { model: "claude-opus-5-5", stop_reason: "refusal", usage: usage(10, 1), content: [] } }),
    );
    const err = await runAnthropic(req, "claude-opus-5-5").catch((e) => e);
    expect(err).toBeInstanceOf(ProviderFailedError);
    expect(err.attempt.error).toBe("refusal");
  });

  it("treats an overload reported inside the stream as Claude being unavailable", async () => {
    const overloaded = new Anthropic.APIError(undefined, { type: "error", error: { type: "overloaded_error" } }, "Overloaded", undefined);
    streamMock.mockReturnValueOnce(fakeStream({ error: overloaded }));
    const err = await runAnthropic(req, "claude-opus-5-5").catch((e) => e);
    expect(err).toBeInstanceOf(ProviderUnavailableError);
  });

  it("runs without a progress sink outside a streaming route", async () => {
    streamMock.mockReturnValueOnce(
      fakeStream({
        events: [["text", "{}"]],
        message: { model: "claude-opus-5-5", stop_reason: "end_turn", usage: usage(1, 1), parsed_output: { answer: "ok" }, content: [] },
      }),
    );
    await expect(runAnthropic(req, "claude-opus-5-5")).resolves.toMatchObject({ data: { answer: "ok" } });
  });
});
