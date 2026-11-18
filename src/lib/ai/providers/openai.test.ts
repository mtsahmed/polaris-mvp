import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { AiProgress } from "../progress";
import { withAiProgress } from "../progress-context";
import type { StructuredRequest } from "../types";
import { OpenAIExhaustedError, runOpenAI } from "./openai";

// The adapter streams from OpenAI's Responses API. These tests feed it scripted streams and check
// it returns the same result the non-streaming call did (parsed data, URLs seen, searches, usage),
// still moves to the next model when one is unavailable, and reports progress.

const { streamMock, RateLimitError } = vi.hoisted(() => {
  class APIError extends Error {}
  return { streamMock: vi.fn(), RateLimitError: class extends APIError {}, APIError };
});

vi.mock("server-only", () => ({}));
vi.mock("openai", () => {
  class APIError extends Error {}
  class Other extends APIError {}
  class OpenAI {
    static APIError = APIError;
    static AuthenticationError = Other;
    static PermissionDeniedError = Other;
    static NotFoundError = Other;
    static RateLimitError = RateLimitError;
    static InternalServerError = Other;
    static APIConnectionError = Other;
    responses = { stream: streamMock };
  }
  return { default: OpenAI };
});
vi.mock("openai/helpers/zod", () => ({ zodTextFormat: () => ({ type: "json_schema" }) }));
vi.mock("../fetch-page", () => ({
  fetchPage: vi.fn(async (url: string) => ({ ok: true, url, title: "About", text: "page text", isPdf: false })),
}));

type Script = { events?: [string, unknown][]; response?: unknown; error?: Error };

function fakeStream(script: Script) {
  const handlers: Record<string, ((arg: unknown) => void)[]> = {};
  return {
    on(event: string, fn: (arg: unknown) => void) {
      (handlers[event] ??= []).push(fn);
      return this;
    },
    async finalResponse() {
      for (const [event, arg] of script.events ?? []) for (const fn of handlers[event] ?? []) fn(arg);
      if (script.error) throw script.error;
      return script.response;
    },
  };
}

const req: StructuredRequest<z.ZodObject<{ answer: z.ZodString }>> = {
  task: "test",
  system: "system",
  prompt: "prompt",
  schema: z.object({ answer: z.string() }),
  schemaName: "test",
  urls: [{ label: "S1", url: "https://naturahq.com/about" }],
  webSearch: { maxUses: 3 },
};

const searchItem = {
  type: "web_search_call",
  action: { type: "search", query: "Natura news", sources: [{ url: "https://news.example/natura" }] },
};

const goodResponse = {
  status: "completed",
  output_parsed: { answer: "yes" },
  usage: { input_tokens: 1000, output_tokens: 100, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 } },
  output: [
    searchItem,
    {
      type: "message",
      content: [{ type: "output_text", annotations: [{ type: "url_citation", url: "https://cited.example/page" }] }],
    },
  ],
};

beforeEach(() => streamMock.mockReset());

describe("runOpenAI (streaming)", () => {
  it("returns the parsed answer, every URL seen and the cost, and reports progress", async () => {
    streamMock.mockReturnValueOnce(
      fakeStream({
        events: [
          ["response.output_item.added", { item: { type: "reasoning" } }],
          ["response.output_item.added", { item: { type: "web_search_call" } }],
          ["response.output_item.done", { item: searchItem }],
          ["response.output_text.delta", { delta: '{"answer":"yes"}' }],
        ],
        response: goodResponse,
      }),
    );

    const events: AiProgress[] = [];
    const result = await withAiProgress((e) => events.push(e), () => runOpenAI(req, ["gpt-6.1-sol"]));

    expect(result.data).toEqual({ answer: "yes" });
    expect(result.seenUrls.sort()).toEqual([
      "https://cited.example/page",
      "https://naturahq.com/about",
      "https://news.example/natura",
    ]);
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]).toMatchObject({ provider: "openai", model: "gpt-6.1-sol", ok: true, searches: 1 });
    expect(result.attempts[0].costUsd).toBeCloseTo((1000 * 2 + 100 * 10) / 1_000_000 + 0.01, 6);
    expect(events).toEqual([
      { kind: "read", url: "https://naturahq.com/about" },
      { kind: "think" },
      { kind: "search" },
      { kind: "search", query: "Natura news" },
      { kind: "write" },
      { kind: "delta", text: '{"answer":"yes"}' },
    ]);
  });

  it("moves to the next model when one is unavailable, and says so", async () => {
    streamMock
      .mockReturnValueOnce(fakeStream({ error: new RateLimitError("Rate limit") }))
      .mockReturnValueOnce(fakeStream({ response: goodResponse }));

    const events: AiProgress[] = [];
    const result = await withAiProgress((e) => events.push(e), () => runOpenAI(req, ["gpt-6.1-sol", "gpt-5.5"]));

    expect(result.attempts.map((a) => [a.model, a.ok])).toEqual([
      ["gpt-6.1-sol", false],
      ["gpt-5.5", true],
    ]);
    expect(events).toContainEqual({ kind: "model", name: "GPT 5.5" });
  });

  it("fails without retrying when the answer is incomplete", async () => {
    streamMock.mockReturnValueOnce(
      fakeStream({ response: { ...goodResponse, status: "incomplete", incomplete_details: { reason: "max_output_tokens" } } }),
    );
    const err = await runOpenAI(req, ["gpt-6.1-sol", "gpt-5.5"]).catch((e) => e);
    expect(err).toBeInstanceOf(OpenAIExhaustedError);
    expect(streamMock).toHaveBeenCalledTimes(1);
  });
});
