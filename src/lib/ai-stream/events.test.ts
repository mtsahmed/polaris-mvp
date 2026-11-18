import { describe, expect, it } from "vitest";
import { createEventDecoder, encodeEvent, partialStringField, type StreamEvent } from "./events";

describe("encodeEvent / createEventDecoder", () => {
  it("round-trips events, one JSON object per line", () => {
    const events: StreamEvent[] = [
      { type: "stage", text: "Reading naturahq.com…" },
      { type: "draft", text: "Dear Ana,\nI saw \"Natura\" grew." },
      { type: "heartbeat" },
      { type: "done", message: "Saved.", redirect: "/pitch/1" },
    ];
    const wire = events.map(encodeEvent).join("");
    expect(wire.split("\n").filter(Boolean)).toHaveLength(4);
    expect(createEventDecoder()(wire)).toEqual(events);
  });

  it("holds back a line split across chunks until it is complete", () => {
    const wire = encodeEvent({ type: "stage", text: "Searching the web…" }) + encodeEvent({ type: "error", message: "No credit." });
    const decode = createEventDecoder();
    const cut = 10;
    expect(decode(wire.slice(0, cut))).toEqual([]);
    const rest = decode(wire.slice(cut, wire.length - 5));
    expect(rest).toEqual([{ type: "stage", text: "Searching the web…" }]);
    expect(decode(wire.slice(wire.length - 5))).toEqual([{ type: "error", message: "No credit." }]);
  });

  it("skips blank and malformed lines instead of failing", () => {
    const decode = createEventDecoder();
    expect(decode('\n{not json}\n{"type":"heartbeat"}\n')).toEqual([{ type: "heartbeat" }]);
  });
});

describe("partialStringField", () => {
  it("returns null until the field starts", () => {
    expect(partialStringField('{"email":{"subject":"Hi"', "body")).toBeNull();
    expect(partialStringField('{"email":{"subject":"Hi","bo', "body")).toBeNull();
  });

  it("returns the text written so far", () => {
    expect(partialStringField('{"email":{"subject":"Hi","body":"Dear Ana, I saw', "body")).toBe("Dear Ana, I saw");
  });

  it("stops at the closing quote and takes the first matching field", () => {
    const json = '{"email":{"subject":"Hi","body":"First."},"follow_up":{"subject":"Re: Hi","body":"Second."}}';
    expect(partialStringField(json, "body")).toBe("First.");
  });

  it("decodes escapes, including one cut off at the end of a chunk", () => {
    expect(partialStringField('{"body":"Line one\\nLine \\"two\\" \\u00e9', "body")).toBe('Line one\nLine "two" é');
    expect(partialStringField('{"body":"Ends with \\', "body")).toBe("Ends with ");
    expect(partialStringField('{"body":"Half \\u00', "body")).toBe("Half ");
  });

  it("allows spaces around the colon", () => {
    expect(partialStringField('{ "body" :  "Hello', "body")).toBe("Hello");
  });
});
