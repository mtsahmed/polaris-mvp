"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { StarIcon } from "@/components/brand-mark";
import { cn } from "@/lib/utils";

// The site-wide sign that Polaris is working (owner review, 17 Nov 2026; docs/design-guide.md):
// the Polaris star rotating slowly, beside one line saying what is happening. With reduced motion
// the star pulses instead (see .polaris-spin in globals.css).

export function SpinningStar({ className }: { className?: string }) {
  return <StarIcon className={cn("polaris-spin size-4 shrink-0", className)} />;
}

// A status line or panel for work running in the background (research, contact search).
// The text uses the side-note style: italic, 13px, grey.
export function PolarisWorking({
  children,
  panel = false,
  className,
}: {
  children: ReactNode;
  panel?: boolean; // a dashed panel with a larger star, for a page waiting on background work
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 text-[13px] text-muted-foreground/75 italic",
        panel && "rounded-2xl border border-dashed border-brand/30 bg-brand/5 px-4 py-3",
        className,
      )}
    >
      <SpinningStar className={panel ? "size-7" : "size-5"} />
      <span>{children}</span>
    </div>
  );
}

// Inside a form: shows the working panel only while the form is submitting, for AI steps that
// make the user wait (drafting, finding companies).
export function PolarisWorkingWhilePending({ children, className }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <PolarisWorking panel className={className}>
      {children}
    </PolarisWorking>
  );
}
