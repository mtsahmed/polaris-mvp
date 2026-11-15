"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NextActionButton({
  intro,
  label,
  href,
  missing,
  stageLabel,
}: {
  intro: string;
  label: string;
  href: string | null; // null: the next stage is not built yet
  missing: string | null; // set when this stage's minimum is not met
  stageLabel: string;
}) {
  const [showMissing, setShowMissing] = useState(false);
  const full = "w-full sm:w-auto";

  return (
    <section
      aria-label="Next action"
      className="mt-12 flex flex-col gap-4 rounded-3xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6"
    >
      <div className="space-y-1">
        <div className="kicker">After {stageLabel.toLowerCase()}</div>
        <p className="text-base leading-relaxed">{intro}</p>
        {showMissing && missing && (
          <p role="status" className="flex items-center gap-2 text-sm font-medium text-destructive">
            <Info className="size-4 shrink-0" aria-hidden="true" /> {missing}
          </p>
        )}
      </div>
      {!href ? (
        <Button disabled className={full}>
          {label}
        </Button>
      ) : missing ? (
        <Button className={full} onClick={() => setShowMissing(true)}>
          {label} <ArrowRight />
        </Button>
      ) : (
        <Link href={href} className={cn(buttonVariants(), full)}>
          {label} <ArrowRight />
        </Link>
      )}
    </section>
  );
}
