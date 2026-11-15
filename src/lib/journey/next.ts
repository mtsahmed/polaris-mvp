// What the Next action button shows on a stage page (spec section 5). Pure, so it is tested.

import type { MilestoneStatus } from "./compute";
import { nextMilestone, PIPELINE, type MilestoneKey } from "./milestones";

export type NextActionModel = {
  intro: string;
  label: string;
  href: string | null; // null when the next stage is not built
  missing: string | null; // shown on click when the current stage's minimum is not met
};

export function nextAction(current: MilestoneKey, statuses: MilestoneStatus[], profileId: string): NextActionModel {
  const here = statuses.find((m) => m.key === current);
  const next = nextMilestone(current);
  const target = next
    ? { label: `Next action (${next.label})`, intro: next.intro, built: next.built, href: next.route(profileId) }
    : { label: PIPELINE.label, intro: PIPELINE.intro, built: PIPELINE.built, href: PIPELINE.route };
  return {
    intro: target.intro,
    label: target.built ? target.label : `${target.label} — coming soon`,
    href: target.built ? target.href : null,
    missing: here && !here.minimumMet ? here.missing : null,
  };
}


