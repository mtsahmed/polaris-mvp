import { Suspense } from "react";
import { getJourneyStatus } from "@/lib/journey/status";
import { MILESTONES } from "@/lib/journey/milestones";
import { activeProfile } from "@/lib/profile-selection";
import { JourneyBar } from "./journey-bar";

// Server part of the journey bar: loads the selected profile's real status and hands it to the
// client bar, which only works out which milestone is the current page.
export async function Journey() {
  const { active } = await activeProfile();
  if (!active) return null;
  const journey = await getJourneyStatus(active.id);
  if (!journey.ok) {
    return (
      <div className="mb-10 rounded-3xl border border-dashed px-5 py-4 text-sm text-muted-foreground">
        {journey.message}
      </div>
    );
  }
  const items = journey.milestones.map((m) => ({
    ...m,
    href: MILESTONES.find((x) => x.key === m.key)!.route(active.id),
  }));
  return (
    // useSearchParams in the client bar needs a Suspense boundary.
    <Suspense fallback={<div className="mb-10 h-28 rounded-3xl border bg-card" />}>
      <JourneyBar profileName={active.name} items={items} />
    </Suspense>
  );
}
