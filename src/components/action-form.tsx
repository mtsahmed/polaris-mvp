"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SpinningStar } from "@/components/polaris-working";
import type { ActionState } from "@/lib/action-state";

type Variant = "default" | "gradient-outline" | "outline" | "secondary" | "ghost" | "destructive";

export function SubmitButton({
  children,
  pendingLabel,
  variant,
  className,
  name,
  value,
  disabled,
  size,
  title,
  working = false,
}: {
  children: ReactNode;
  pendingLabel?: string;
  // An AI or background step: while pending, the rotating Polaris star shows before the label.
  variant?: Variant;
  className?: string;
  // For forms with several submit buttons (the clicked one's name and value are submitted).
  name?: string;
  value?: string;
  disabled?: boolean;
  size?: "default" | "sm";
  title?: string;
  working?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      variant={variant}
      size={size}
      title={title}
      className={className}
      name={name}
      value={value}
    >
      {pending ? (
        working ? (
          <>
            <SpinningStar /> {pendingLabel ?? "Working…"}
          </>
        ) : (
          (pendingLabel ?? "Saving…")
        )
      ) : (
        children
      )}
    </Button>
  );
}

// Form bound to a server action returning ActionState; reports the outcome as a toast.
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.at) return;
    if (state.error) toast.error(state.error);
    else if (state.ok) {
      if (state.message) toast.success(state.message);
      if (resetOnSuccess) formRef.current?.reset();
    }
  }, [state, resetOnSuccess]);

  return (
    <form ref={formRef} action={formAction} className={className}>
      {children}
      {state.error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
