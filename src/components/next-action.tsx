import { getJourneyStatus } from "@/lib/journey/status";
import { milestone, type MilestoneKey } from "@/lib/journey/milestones";
import { nextAction } from "@/lib/journey/next";
import { activeProfile } from "@/lib/profile-selection";
import { NextActionButton } from "./next-action-button";

// Bottom-of-page Next action (spec section 5): one line about the next stage and one primary
// button. Order, labels and "built" flags come from the shared milestone config; whether the
// current stage's minimum is met comes from getJourneyStatus().
export async function NextAction({ current, profileId }: { current: MilestoneKey; profileId?: string }) {
  const id = profileId ?? (await activeProfile()).active?.id;
  if (!id) return null;
  const journey = await getJourneyStatus(id);
  if (!journey.ok) return null;
  return <NextActionButton {...nextAction(current, journey.milestones, id)} stageLabel={milestone(current).label} />;
}
