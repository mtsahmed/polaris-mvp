import { describe, expect, it } from "vitest";
import { addBusinessDays, allowedChannels, mailtoHref, stageAfter, whatsappHref } from "./rules";

describe("stageAfter", () => {
  it("moves forward on send, reply and meeting", () => {
    expect(stageAfter("ready_to_pitch", "sent")).toBe("contacted");
    expect(stageAfter("researching", "sent")).toBe("contacted");
    expect(stageAfter("contacted", "reply")).toBe("replied");
    expect(stageAfter("replied", "meeting")).toBe("meeting_booked");
  });

  it("never moves backward or out of Won and Lost", () => {
    expect(stageAfter("meeting_booked", "sent")).toBe("meeting_booked");
    expect(stageAfter("won", "reply")).toBe("won");
    expect(stageAfter("lost", "meeting")).toBe("lost");
  });

  it("calls, bounces and notes leave the stage alone", () => {
    expect(stageAfter("contacted", "call")).toBe("contacted");
    expect(stageAfter("contacted", "bounce")).toBe("contacted");
  });
});

describe("addBusinessDays", () => {
  it("skips weekends", () => {
    // Thursday 12 November 2026 + 4 business days = Wednesday 18 November.
    expect(addBusinessDays(new Date("2026-11-12T15:00:00Z"), 4).toISOString().slice(0, 10)).toBe("2026-11-18");
  });
});

describe("allowedChannels", () => {
  it("allows a call only after an email, and messages only after a reply", () => {
    expect(allowedChannels({ emailSent: false, replied: false, hasMobile: true })).toEqual({ call: false, message: false });
    expect(allowedChannels({ emailSent: true, replied: false, hasMobile: true })).toEqual({ call: true, message: false });
    expect(allowedChannels({ emailSent: true, replied: true, hasMobile: true })).toEqual({ call: true, message: true });
    expect(allowedChannels({ emailSent: true, replied: true, hasMobile: false })).toEqual({ call: false, message: false });
  });
});

describe("links", () => {
  it("encodes mailto subject and body", () => {
    expect(mailtoHref("a@b.com", "Hi & hello", "Line 1\nLine 2")).toBe(
      "mailto:a%40b.com?subject=Hi%20%26%20hello&body=Line%201%0ALine%202",
    );
  });

  it("builds a WhatsApp link from digits only", () => {
    expect(whatsappHref("+1 (210) 555-0101")).toBe("https://wa.me/12105550101");
    expect(whatsappHref("123")).toBeNull();
  });
});
