import { describe, expect, it } from "vitest";
import { mergeFound, type ExistingContact } from "./merge";
import type { FoundContact } from "./sources/types";

const found = (over: Partial<FoundContact>): FoundContact => ({
  name: "Jane Doe",
  title: null,
  email: null,
  emailStatus: "missing",
  phone: null,
  mobile: null,
  whatsapp: null,
  source: "Web: example.com",
  sourceUrl: "https://example.com/team",
  ...over,
});

const existing = (over: Partial<ExistingContact>): ExistingContact => ({
  id: "c1",
  name: "Jane Doe",
  title: null,
  email: null,
  email_status: "missing",
  email_unconfirmed: false,
  phone: null,
  mobile: null,
  whatsapp: null,
  apollo_id: null,
  source_url: null,
  ...over,
});

describe("mergeFound", () => {
  it("skips a company-wide line whose number is already saved, however it is written", () => {
    const saved = existing({ name: "Main office", title: "San Antonio HQ", phone: "+18882842257" });
    const r = mergeFound([saved], [found({ name: "Natura HQ", phone: "(888) 284-2257" })]);
    expect(r.inserts).toHaveLength(0);
    expect(r.updates).toHaveLength(0);
  });

  it("skips the same company-wide line twice in one batch", () => {
    const r = mergeFound([], [found({ name: "Main office", phone: "+18882842257" }), found({ name: "Headquarters", phone: "888.284.2257" })]);
    expect(r.inserts.map((i) => i.name)).toEqual(["Main office"]);
  });

  it("keeps a named person who shares the main line, and a company line with a new number", () => {
    const saved = existing({ name: "Main office", phone: "+18882842257" });
    const r = mergeFound([saved], [
      found({ name: "Jane Doe", title: "Office Manager", phone: "888-284-2257" }),
      found({ name: "Office line +15122587357", phone: "+15122587357" }),
    ]);
    expect(r.inserts.map((i) => i.name)).toEqual(["Jane Doe", "Office line +15122587357"]);
  });

  it("adds new people", () => {
    const r = mergeFound([], [found({ email: "jane@example.com", emailStatus: "unverified" })]);
    expect(r.inserts).toHaveLength(1);
    expect(r.updates).toEqual([]);
  });

  it("fills gaps on the same person instead of duplicating", () => {
    const r = mergeFound(
      [existing({ email: "jane@example.com", email_status: "verified" })],
      [found({ email: "JANE@example.com", emailStatus: "unverified", phone: "210 555 0101", whatsapp: "12105550101" })],
    );
    expect(r.inserts).toEqual([]);
    expect(r.updates).toEqual([{ id: "c1", patch: { phone: "210 555 0101", whatsapp: "12105550101", source_url: "https://example.com/team" } }]);
  });

  it("never overwrites a saved email or downgrades a verified one", () => {
    const r = mergeFound([existing({ email: "jane@example.com", email_status: "verified" })], [found({ email: "jane@example.com", emailStatus: "unverified" })]);
    expect(r.updates[0]?.patch.email_status).toBeUndefined();
    const byName = mergeFound([existing({ email: "jane@example.com", email_status: "unverified" })], [found({ phone: "1" })]);
    expect(byName.updates[0].patch.email).toBeUndefined();
  });

  it("upgrades unverified to verified for the same address", () => {
    const r = mergeFound([existing({ email: "jane@example.com", email_status: "unverified" })], [found({ email: "jane@example.com", emailStatus: "verified" })]);
    expect(r.updates[0].patch.email_status).toBe("verified");
  });

  it("de-duplicates within one batch", () => {
    const r = mergeFound([], [found({ phone: "1" }), found({ email: "jane@example.com", emailStatus: "unverified" })]);
    expect(r.inserts).toHaveLength(1);
    expect(r.inserts[0]).toMatchObject({ phone: "1", email: "jane@example.com" });
  });

  it("treats different emails as different people", () => {
    const r = mergeFound([existing({ email: "jane@example.com" })], [found({ email: "info@example.com", name: "General inbox" })]);
    expect(r.inserts).toHaveLength(1);
  });

  it("keeps an unconfirmed email and replaces it with a confirmed one later", () => {
    const first = mergeFound([], [found({ email: "harrison@example.com", emailStatus: "unverified", emailUnconfirmed: true })]);
    expect(first.inserts[0].emailUnconfirmed).toBe(true);
    const later = mergeFound(
      [existing({ email: "harrison@example.com", email_status: "unverified", email_unconfirmed: true })],
      [found({ email: "h.rodgers@example.com", emailStatus: "unverified" })],
    );
    expect(later.inserts).toEqual([]);
    expect(later.updates[0].patch).toMatchObject({ email: "h.rodgers@example.com", email_unconfirmed: false });
  });

  it("clears the mark when the same address is confirmed", () => {
    const r = mergeFound(
      [existing({ email: "jane@example.com", email_status: "unverified", email_unconfirmed: true })],
      [found({ email: "jane@example.com", emailStatus: "unverified" })],
    );
    expect(r.updates[0].patch.email_unconfirmed).toBe(false);
  });

  it("never lets an unconfirmed email replace a confirmed one", () => {
    const r = mergeFound([existing({ email: "jane@example.com", email_status: "unverified" })], [found({ email: "jdoe@example.com", emailStatus: "unverified", emailUnconfirmed: true })]);
    expect(r.updates[0]?.patch.email).toBeUndefined();
    expect(r.inserts).toEqual([]);
  });

  it("prefers the contact that already has the email over a same-name one", () => {
    const r = mergeFound(
      [existing({ id: "office", name: "Main office", phone: "888" }), existing({ id: "inbox", name: "General inbox", email: "care@example.com" })],
      [found({ name: "Main office", email: "care@example.com", emailStatus: "unverified", phone: "888" })],
    );
    expect(r.inserts).toEqual([]);
    expect(r.updates.find((u) => u.id === "office")).toBeUndefined();
  });
});
