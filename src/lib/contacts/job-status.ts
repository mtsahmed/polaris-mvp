// Pure helpers for contact-finding jobs (no server imports), unit-tested.
import type { ContactJob, ContactJobStatus, ContactJobStep } from "@/lib/types";

export const JOB_TIMEOUT_MINUTES = 10;

// A job still "queued" or "running" after 10 minutes never finished (server restart, timeout).
export function effectiveJobStatus(job: Pick<ContactJob, "status" | "created_at">, now = Date.now()): ContactJobStatus {
  if ((job.status === "queued" || job.status === "running") && now - new Date(job.created_at).getTime() > JOB_TIMEOUT_MINUTES * 60_000) {
    return "failed";
  }
  return job.status;
}

export const isActive = (job: Pick<ContactJob, "status" | "created_at"> | null | undefined, now = Date.now()) =>
  Boolean(job && ["queued", "running"].includes(effectiveJobStatus(job, now)));

// The message apollo.ts logs when the Apollo plan has no API access (Free plan).
export const APOLLO_PLAN_BLOCKED = "plan does not include API access";

export function isPlanBlocked(error: string | null | undefined) {
  return Boolean(error && error.toLowerCase().includes(APOLLO_PLAN_BLOCKED.toLowerCase()));
}

const SOURCE_LABEL: Record<ContactJobStep["source"], string> = { recheck: "Recheck", apollo: "Apollo", site: "Website", web: "Web search" };

// One line per source, e.g. "Apollo skipped: Free plan has no API access" or
// "Web: 3 saved, 2 details dropped (not on the cited page)".
export function stepLine(step: ContactJobStep): string {
  const label = SOURCE_LABEL[step.source];
  if (step.source === "recheck") {
    const total = step.saved + (step.unconfirmed ?? 0);
    return `${label}: ${step.saved} of ${total} unconfirmed email${total === 1 ? "" : "s"} now confirmed`;
  }
  if (step.outcome === "skipped") return `${label} skipped${step.note ? `: ${step.note}` : ""}`;
  if (step.outcome === "failed") return `${label} failed${step.note ? `: ${step.note}` : ""}`;
  const parts = [step.saved ? `${step.saved} saved` : step.outcome === "none" ? "nothing found" : "nothing new"];
  if (step.unconfirmed) parts.push(`${step.unconfirmed} email${step.unconfirmed === 1 ? "" : "s"} not confirmed`);
  if (step.dropped) parts.push(`${step.dropped} number${step.dropped === 1 ? "" : "s"} dropped (not on the cited page)`);
  return `${label}: ${parts.join(", ")}`;
}
