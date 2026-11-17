"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "./action-form";

// Two-step destructive action: first click reveals the real submit button.
export function ConfirmSubmit({
  action,
  label,
  confirmLabel = "Yes, delete",
  pendingLabel = "Deleting…",
  size = "sm",
  title,
}: {
  action: () => Promise<void>;
  label: ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  size?: "sm" | "xs";
  title?: string; // hover text, for icon-only labels
}) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <Button type="button" variant="ghost" size={size} title={title} onClick={() => setArmed(true)}>
        {label}
      </Button>
    );
  }
  return (
    <form action={action} className="inline-flex items-center gap-1">
      <SubmitButton variant="destructive" pendingLabel={pendingLabel} className={size === "xs" ? "h-6 px-2 text-xs" : "h-7"}>
        {confirmLabel}
      </SubmitButton>
      <Button type="button" variant="ghost" size={size} onClick={() => setArmed(false)}>
        Cancel
      </Button>
    </form>
  );
}
