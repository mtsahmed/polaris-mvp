import type { Metadata } from "next";
import { HowItWorksEmbed } from "@/components/how-it-works-embed";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "How it works" };

// The route map on its own page, reachable from the sidebar at any time. The map carries its
// own heading, so there is no PageHeader here.
export default async function HowItWorksPage() {
  await requireSession();
  return (
    <div className="mx-auto max-w-6xl">
      <HowItWorksEmbed />
    </div>
  );
}
