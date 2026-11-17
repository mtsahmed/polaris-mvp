"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

export type AuthState = { error?: string; message?: string };
// Sign-up result: `sentTo` is set once the confirmation email has been requested.
export type SignUpState = {
  error?: string;
  sentTo?: string;
  resent?: boolean;
  // Echoed back on an error so the form can keep what was typed (passwords are never echoed).
  values?: { name: string; email: string };
};

const credentials = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const newAccount = z
  .object({
    name: z.string().trim().min(1, "Enter your name.").max(100, "Name must be 100 characters or fewer."),
    email: z.email("Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The two passwords do not match.", path: ["confirm"] });

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "/profiles";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/profiles";
}

function confirmRedirect() {
  return `${serverEnv.siteUrl()}/auth/confirm?next=/onboarding`;
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Confirm your email first: open the link we sent you, then sign in." };
    }
    return { error: error.message };
  }

  redirect(safeNext(formData.get("next")));
}

export async function signUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const parsed = newAccount.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  const values = { name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  const { name, email, password } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: confirmRedirect(), data: { full_name: name } },
  });
  if (error) return { error: error.message, values };

  // With email confirmation on (Supabase default) there is no session until the link is opened.
  if (!data.session) return { sentTo: email };
  redirect("/onboarding");
}

// "Resend email" on the check-your-email panel.
export async function resendConfirmation(prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { ...prev, error: "Enter a valid email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.data,
    options: { emailRedirectTo: confirmRedirect() },
  });
  if (error) return { sentTo: email.data, error: error.message };
  return { sentTo: email.data, resent: true };
}

// Forgot password: emails a reset link. The answer is the same whether or not an account exists,
// so the form cannot be used to find out who has a Polaris account.
export type ResetRequestState = { error?: string; sentTo?: string };

export async function requestPasswordReset(_prev: ResetRequestState, formData: FormData): Promise<ResetRequestState> {
  const email = z.email("Enter a valid email address.").safeParse(formData.get("email"));
  if (!email.success) return { error: email.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${serverEnv.siteUrl()}/auth/confirm?next=/reset-password`,
  });
  // Rate limits and outages are worth showing; Supabase never reports "no such user" here.
  if (error) return { error: error.message };
  return { sentTo: email.data };
}

const newPassword = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The two passwords do not match.", path: ["confirm"] });

// Choose a new password: runs while the reset link's session is active.
export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = newPassword.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    return { error: "Your reset link has expired. Ask for a new one from the sign-in page." };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { error: "Choose a password different from your current one." };
    return { error: error.message };
  }
  redirect("/profiles");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
