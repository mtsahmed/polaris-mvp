"use client";

import { useState } from "react";
import { Mail, Send } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { NativeSelect } from "@/components/field";
import { buttonVariants } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";
import { mailtoHref } from "@/lib/outreach/rules";

type Recipient = { id: string; name: string; email: string; verified: boolean; unconfirmed: boolean };

// Sending an approved email by hand: pick the recipient, open it in the user's own mail app (or
// copy it), send it there, then record it here. Polaris itself sends nothing.
export function SendPanel({
  subject,
  body,
  recipients,
  defaultRecipientId,
  markSent,
}: {
  subject: string | null;
  body: string;
  recipients: Recipient[];
  defaultRecipientId: string | null;
  markSent: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  // Never default to an address Polaris could not confirm on its source page.
  const [to, setTo] = useState(defaultRecipientId ?? (recipients.find((r) => !r.unconfirmed) ?? recipients[0])?.id ?? "");
  const recipient = recipients.find((r) => r.id === to);
  const copy = `${subject ? `Subject: ${subject}\n\n` : ""}${body}`;

  if (!recipients.length) {
    return (
      <p className="rounded-2xl border border-dashed p-3 text-[0.9375rem] text-muted-foreground">
        No contact with an email yet. Add one on the Contacts page first.
      </p>
    );
  }

  return (
    <ActionForm action={markSent} className="space-y-3">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Send to</span>
        <NativeSelect name="contact_id" value={to} onChange={(e) => setTo(e.target.value)}>
          {recipients.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} · {r.email} {r.unconfirmed ? "(not confirmed: may be guessed)" : r.verified ? "(verified)" : "(unverified)"}
            </option>
          ))}
        </NativeSelect>
      </label>
      {recipient?.unconfirmed && (
        <p className="text-[13px] font-medium text-amber-700 dark:text-amber-400">
          Polaris did not find this address on the page the search cited, so it may be guessed. A wrong address bounces and can hurt
          your sending domain: confirm it before sending.
        </p>
      )}
      {recipient && !recipient.verified && !recipient.unconfirmed && (
        <p className="text-[13px] text-muted-foreground/75 italic">This address is unverified. Check it before sending.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {recipient && (
          <a href={mailtoHref(recipient.email, subject, body)} className={buttonVariants({ variant: "gradient-outline", size: "sm" })}>
            <Mail /> Open in email app
          </a>
        )}
        <CopyButton text={copy} label="Copy email" />
        <SubmitButton variant="gradient-outline" className="h-8" pendingLabel="Saving…">
          <Send /> Mark as sent
        </SubmitButton>
      </div>
      <p className="text-[13px] text-muted-foreground/75 italic">
        Send it from your own mailbox, then mark it as sent. Polaris records who sent it and when, and sets a follow-up reminder.
      </p>
    </ActionForm>
  );
}
