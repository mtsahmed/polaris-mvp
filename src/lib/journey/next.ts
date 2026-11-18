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



// Inside a profile the Next action button steps through the tabs in order (owner review,
// 18 Nov 2026): Business info → Sources → Insights → Profile → Ideal customer → Discover. Sources
// and insights are optional, so those steps never block; the Profile tab leads to the ideal
// customer and needs the profile's required fields, like the Profile milestone.
export const PROFILE_TAB_STEPS = [
  { key: "business", label: "Business info", intro: "" },
  { key: "sources", label: "Sources", intro: "Add the website, documents or links Polaris should learn from." },
  { key: "insights", label: "Insights", intro: "Let Polaris draft the profile details from your sources, then check them." },
  { key: "profile", label: "Profile", intro: "Check the positioning and add writing samples." },
  { key: "icp", label: "Ideal customer", intro: "" },
] as const;
export type ProfileTabKey = (typeof PROFILE_TAB_STEPS)[number]["key"];

export function profileTabAction(
  tab: ProfileTabKey,
  statuses: MilestoneStatus[],
  profileId: string,
): NextActionModel & { stageLabel: string } {
  const i = PROFILE_TAB_STEPS.findIndex((t) => t.key === tab);
  const stageLabel = PROFILE_TAB_STEPS[i].label;
  if (tab === "icp") return { ...nextAction("icp", statuses, profileId), stageLabel };
  if (tab === "profile") return { ...nextAction("profile", statuses, profileId), stageLabel };
  const next = PROFILE_TAB_STEPS[i + 1];
  return {
    intro: next.intro,
    label: `Next action (${next.label})`,
    href: `/profiles/${profileId}?tab=${next.key}`,
    missing: null,
    stageLabel,
  };
}
