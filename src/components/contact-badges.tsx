import { BadgeCheck, CircleHelp, MailWarning, MailX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { VerificationStatus } from "@/lib/types";

// Email status in words plus an icon, never colour alone (spec section 9).
export function EmailStatusBadge({ status }: { status: VerificationStatus }) {
  if (status === "verified")
    return (
      <Badge variant="outline" className="border-emerald-600/40 text-emerald-700 dark:text-emerald-400">
        <BadgeCheck /> Verified email
      </Badge>
    );
  if (status === "unverified")
    return (
      <Badge variant="outline">
        <CircleHelp /> Unverified email
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <MailX /> No email
    </Badge>
  );
}

// An email the AI search reported that Polaris did not find on the cited page: it may be guessed.
export function UnconfirmedEmailBadge() {
  return (
    <Badge variant="outline" className="border-amber-600/50 text-amber-700 dark:text-amber-400" title="The AI search reported this address, but Polaris did not find it on the cited page. It may be guessed: check it before sending.">
      <MailWarning /> Not confirmed: may be guessed
    </Badge>
  );
}

// "Apollo" or "Added by hand: <where>".
export function ContactSource({ source }: { source: string }) {
  return <span className="text-[13px] text-muted-foreground/75 italic">Source: {source}</span>;
}
