import { getJourneyStatus } from "@/lib/journey/status";
import { milestone, type MilestoneKey } from "@/lib/journey/milestones";
import { nextAction, profileTabAction, type ProfileTabKey } from "@/lib/journey/next";
import { activeProfile } from "@/lib/profile-selection";
import { NextActionButton } from "./next-action-button";

// Bottom-of-page Next action (spec section 5): one line about the next stage and one primary
// button. Order, labels and "built" flags come from the shared milestone config; whether the
// current stage's minimum is met comes from getJourneyStatus(). On a profile page, pass
// profileTab so the button steps through the profile's tabs in order.
export async function NextAction({
  current,
  profileId,
  profileTab,
  href,
}: {
  current: MilestoneKey;
  profileId?: string;
  profileTab?: ProfileTabKey;
  href?: string; // a more specific link to the next stage, e.g. Contacts for one company
}) {
  const id = profileId ?? (await activeProfile()).active?.id;
  if (!id) return null;
  const journey = await getJourneyStatus(id);
  if (!journey.ok) return null;
  if (profileTab) return <NextActionButton {...profileTabAction(profileTab, journey.milestones, id)} />;
  const model = nextAction(current, journey.milestones, id);
  return <NextActionButton {...model} href={model.href && href ? href : model.href} stageLabel={milestone(current).label} />;
}
