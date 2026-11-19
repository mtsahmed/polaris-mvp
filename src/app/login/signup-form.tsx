"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import { resendConfirmation, signUp, type SignUpState } from "./actions";

// Create account: name, email, password twice. On success the form is replaced by a
// "check your email" panel that says exactly what to do next.
export function SignUpForm() {
  const [state, action, pending] = useActionState<SignUpState, FormData>(signUp, {});

  if (state.sentTo) return <CheckEmail email={state.sentTo} />;

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" autoComplete="name" required maxLength={100} defaultValue={state.values?.name} placeholder="e.g. Jordan Lee" className="h-10" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} placeholder="e.g. you@company.com" className="h-10" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} required placeholder="At least 8 characters" className="h-10" />
        <p className="text-sm text-muted-foreground">At least 8 characters.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Re-enter password</Label>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={8} required placeholder="Type it again" className="h-10" />
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" variant="brand" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

function CheckEmail({ email }: { email: string }) {
  const [state, resend, resending] = useActionState<SignUpState, FormData>(resendConfirmation, { sentTo: email });

  return (
    <div role="status" className="space-y-5">
      <div className="flex gap-4 rounded-2xl border border-brand/30 bg-brand/5 p-5">
        <MailCheck className="mt-0.5 size-6 shrink-0 text-brand" aria-hidden="true" />
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Check your email</h2>
          <p className="text-base leading-relaxed">
            We sent a confirmation link to <span className="font-semibold break-all">{email}</span>.
          </p>
        </div>
      </div>

      <ol className="list-decimal space-y-2 pl-5 text-base leading-relaxed text-muted-foreground">
        <li>Open the email from Polaris and click the confirmation link.</li>
        <li>No email after a few minutes? Check your spam folder, or send it again below.</li>
      </ol>

      {state.resent && !state.error && (
        <Alert>
          <AlertDescription>Sent again. Only the newest link will work.</AlertDescription>
        </Alert>
      )}
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <form action={resend}>
          <input type="hidden" name="email" value={email} />
          <Button type="submit" variant="gradient-outline" size="lg" className="w-full" disabled={resending}>
            {resending ? "Sending…" : "Resend email"}
          </Button>
        </form>
        <Link href="/login" className={buttonVariants({ variant: "brand", size: "lg" })}>
          Go to sign in
        </Link>
      </div>
    </div>
  );
}
