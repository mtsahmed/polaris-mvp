"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SpinningStar } from "@/components/polaris-working";
import type { ActionState } from "@/lib/action-state";

type Variant = "default" | "gradient-outline" | "outline" | "secondary" | "ghost" | "destructive";

// What the form would submit, as a comparable string (files by name and size).
function snapshot(form: HTMLFormElement): string {
  return JSON.stringify(
    [...new FormData(form).entries()].map(([k, v]) => [k, typeof v === "string" ? v : `${v.name}:${v.size}`]),
  );
}

// True once the button's form differs from how it was loaded (owner review, 19 Nov 2026: save buttons
// stay inactive until there is something new to save). A form reset, which React does after each
// form action and ActionForm does on resetOnSuccess, makes the current values the new baseline.
function useFormChanged(button: RefObject<HTMLButtonElement | null>, enabled: boolean): boolean {
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    const form = button.current?.form;
    if (!enabled || !form) return;
    let base = snapshot(form);
    const check = () => setChanged(snapshot(form) !== base);
    // The reset event fires before the fields are reset, so read them on the next frame.
    const rebase = () =>
      requestAnimationFrame(() => {
        base = snapshot(form);
        setChanged(false);
      });
    form.addEventListener("input", check);
    form.addEventListener("change", check);
    form.addEventListener("reset", rebase);
    return () => {
      form.removeEventListener("input", check);
      form.removeEventListener("change", check);
      form.removeEventListener("reset", rebase);
    };
  }, [button, enabled]);
  return changed;
}

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
  requireChanges = false,
  upToDate = null,
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
  // Save-type buttons: inactive until something in the form is changed or typed.
  requireChanges?: boolean;
  // Re-run buttons: when the result is already up to date with its inputs, the reason (shown on hover)
  // and the button is inactive. See src/lib/reruns.
  upToDate?: string | null;
}) {
  const { pending } = useFormStatus();
  const ref = useRef<HTMLButtonElement>(null);
  const changed = useFormChanged(ref, requireChanges);
  const waiting = requireChanges && !changed && !pending;
  const inactive = Boolean(upToDate) || waiting;
  const button = (
    <Button
      ref={ref}
      type="submit"
      disabled={pending || disabled || inactive}
      variant={variant}
      size={size}
      title={inactive ? undefined : title}
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
  // Buttons that can go inactive sit in a wrapper that carries the reason: a disabled button takes no
  // pointer events, so its own title would never show. Touch screens have no hover, so there the
  // reason for an up-to-date re-run is also printed under the button.
  if (!requireChanges && upToDate === undefined) return button;
  const note = upToDate || (waiting ? (title ?? "Nothing new to save yet") : undefined);
  return (
    <span title={note} className="inline-flex max-w-full flex-col items-start gap-1 align-top">
      {button}
      {upToDate && (
        <span className="hidden max-w-64 text-[12px] leading-4 italic text-muted-foreground/75 pointer-coarse:block">
          {upToDate}
        </span>
      )}
    </span>
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
