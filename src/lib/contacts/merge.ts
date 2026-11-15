// Merges contacts found by any source into a company's existing contacts. Pure, unit-tested.
// - Same person: same email, same Apollo id, or same name (when either side has no email, or
//   either email is not confirmed).
// - A match only fills empty fields; it never replaces a detail the user or another source saved,
//   and never turns a verified email into an unverified one.
// - A confirmed email replaces a "not confirmed" one for the same person and clears the mark.
// - Everything else becomes a new contact (de-duplicated within the batch too).

import type { VerificationStatus } from "@/lib/types";
import type { FoundContact } from "./sources/types";

export type ExistingContact = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  email_status: VerificationStatus;
  email_unconfirmed: boolean;
  phone: string | null;
  mobile: string | null;
  whatsapp: string | null;
  apollo_id: string | null;
  source_url: string | null;
};

export type ContactPatch = Partial<
  Pick<ExistingContact, "title" | "email" | "email_status" | "email_unconfirmed" | "phone" | "mobile" | "whatsapp" | "source_url">
>;

const lower = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

type Who = { name: string; email: string | null; unconfirmed?: boolean; apolloId?: string | null };

function samePerson(a: Who, b: Who) {
  if (a.email && b.email && lower(a.email) === lower(b.email)) return true;
  if (a.email && b.email && !a.unconfirmed && !b.unconfirmed) return false;
  if (a.apolloId && b.apolloId) return a.apolloId === b.apolloId;
  return lower(a.name) === lower(b.name);
}

export function mergeFound(existing: ExistingContact[], found: FoundContact[]) {
  const inserts: FoundContact[] = [];
  const updates = new Map<string, ContactPatch>();

  for (const f of found) {
    const fWho: Who = { name: f.name, email: f.email, unconfirmed: f.emailUnconfirmed, apolloId: f.apolloId };
    // An exact email match wins over a name match, so an address already saved under one contact
    // is not copied onto another with the same name.
    const sameEmail = f.email ? existing.find((e) => lower({ ...e, ...updates.get(e.id) }.email) === lower(f.email)) : undefined;
    const match =
      sameEmail ??
      existing.find((e) => {
        const current = { ...e, ...updates.get(e.id) };
        return samePerson({ name: current.name, email: current.email, unconfirmed: current.email_unconfirmed, apolloId: current.apollo_id }, fWho);
      });
    if (match) {
      const patch: ContactPatch = { ...updates.get(match.id) };
      const current = { ...match, ...patch };
      if (!current.title && f.title) patch.title = f.title;
      if (f.email) {
        const sameAddress = lower(current.email) === lower(f.email);
        if (!current.email || (current.email_unconfirmed && !f.emailUnconfirmed && !sameAddress)) {
          patch.email = f.email;
          patch.email_status = f.emailStatus;
          patch.email_unconfirmed = Boolean(f.emailUnconfirmed);
        } else if (sameAddress) {
          if (current.email_unconfirmed && !f.emailUnconfirmed) patch.email_unconfirmed = false;
          if (current.email_status !== "verified" && f.emailStatus === "verified") patch.email_status = "verified";
        }
      }
      if (!current.phone && f.phone) patch.phone = f.phone;
      if (!current.mobile && f.mobile) patch.mobile = f.mobile;
      if (!current.whatsapp && f.whatsapp) patch.whatsapp = f.whatsapp;
      if (!current.source_url && f.sourceUrl) patch.source_url = f.sourceUrl;
      if (Object.keys(patch).length) updates.set(match.id, patch);
      continue;
    }
    const twin = inserts.find((i) => samePerson({ name: i.name, email: i.email, unconfirmed: i.emailUnconfirmed, apolloId: i.apolloId }, fWho));
    if (twin) {
      twin.title ??= f.title;
      if (f.email && (!twin.email || (twin.emailUnconfirmed && !f.emailUnconfirmed))) {
        twin.email = f.email;
        twin.emailStatus = f.emailStatus;
        twin.emailUnconfirmed = f.emailUnconfirmed;
      }
      twin.phone ??= f.phone;
      twin.mobile ??= f.mobile;
      twin.whatsapp ??= f.whatsapp;
      continue;
    }
    inserts.push({ ...f });
  }
  return { inserts, updates: [...updates.entries()].map(([id, patch]) => ({ id, patch })) };
}
