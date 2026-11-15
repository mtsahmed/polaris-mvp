// Outreach rules (roadmap 3.1 and journey spec section 6). Pure functions, unit-tested.

import type { OutreachEventType, PipelineStage } from "@/lib/types";

export const STAGE_ORDER: PipelineStage[] = [
  "new_lead",
  "researching",
  "ready_to_pitch",
  "contacted",
  "replied",
  "meeting_booked",
  "won",
  "lost",
];

export const STAGE_LABEL: Record<PipelineStage, string> = {
  new_lead: "New lead",
  researching: "Researching",
  ready_to_pitch: "Ready to pitch",
  contacted: "Contacted",
  replied: "Replied",
  meeting_booked: "Meeting booked",
  won: "Won",
  lost: "Lost",
};

export const EVENT_LABEL: Record<OutreachEventType, string> = {
  sent: "Email sent",
  reply: "Reply received",
  call: "Call made",
  message: "WhatsApp or text sent",
  meeting: "Meeting booked",
  bounce: "Email bounced",
  note: "Note",
};

// Logged events move a prospect forward, never backward, and never out of Won or Lost.
const MOVES_TO: Partial<Record<OutreachEventType, PipelineStage>> = {
  sent: "contacted",
  reply: "replied",
  meeting: "meeting_booked",
};

export function stageAfter(current: PipelineStage, event: OutreachEventType): PipelineStage {
  if (current === "won" || current === "lost") return current;
  const target = MOVES_TO[event];
  if (!target) return current;
  return STAGE_ORDER.indexOf(target) > STAGE_ORDER.indexOf(current) ? target : current;
}

// Follow-up due date: a number of business days after the send (Saturday and Sunday skipped).
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) left -= 1;
  }
  return d;
}

export const FOLLOW_UP_BUSINESS_DAYS = 4;

// Which follow-up channels a contact may be reached on (roadmap 3.1, agreed 12 November 2026):
// a call only as a follow-up to an unanswered email; WhatsApp and text only after the prospect
// has replied or shared a number. Both need a mobile number. US attorney review is advised
// before calling or texting.
export function allowedChannels(input: { emailSent: boolean; replied: boolean; hasMobile: boolean }) {
  return {
    call: input.hasMobile && input.emailSent,
    message: input.hasMobile && input.replied,
  };
}

export function mailtoHref(to: string, subject: string | null, body: string): string {
  const params = [subject ? `subject=${encodeURIComponent(subject)}` : null, `body=${encodeURIComponent(body)}`]
    .filter(Boolean)
    .join("&");
  return `mailto:${encodeURIComponent(to)}?${params}`;
}

// wa.me needs the number in international format, digits only.
export function whatsappHref(mobile: string): string | null {
  const digits = mobile.replace(/[^\d]/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

export function telHref(mobile: string): string {
  return `tel:${mobile.replace(/[^\d+]/g, "")}`;
}
