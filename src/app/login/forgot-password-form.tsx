"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset, type ResetRequestState } from "./actions";

// Forgot password: one email field. On success the form becomes a "check your email" panel
// with the same wording whether or not the address has an account.
export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<ResetRequestState, FormData>(requestPasswordReset, {});

  if (state.sentTo) {
    return (
      <div role="status" className="space-y-5">
        <div className="flex gap-4 rounded-2xl border border-brand/30 bg-brand/5 p-5">
          <MailCheck className="mt-0.5 size-6 shrink-0 text-brand" aria-hidden="true" />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Check your email</h2>
            <p className="text-base leading-relaxed">
              If <span className="font-semibold break-all">{state.sentTo}</span> has a Polaris account, we sent it a
              link to choose a new password.
            </p>
          </div>
        </div>
        <ol className="list-decimal space-y-2 pl-5 text-base leading-relaxed text-muted-foreground">
          <li>Open the email from Polaris and click Choose a new password.</li>
          <li>No email after a few minutes? Check your spam folder, or check the address and try again.</li>
        </ol>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/login?mode=forgot" className={buttonVariants({ variant: "gradient-outline", size: "lg" })}>
            Try again
          </Link>
          <Link href="/login" className={buttonVariants({ variant: "brand", size: "lg" })}>
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-10" />
      </div>
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" variant="brand" size="lg" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
