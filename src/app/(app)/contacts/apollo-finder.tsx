"use client";

import { useState, useTransition } from "react";
import { Mail, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ApolloCandidate } from "@/lib/contacts/apollo-map";
import { findPeople, revealContact } from "./actions";

// Apollo people search (free) and one-at-a-time email reveal (1 credit each, on click only).
export function ApolloFinder({ prospectId, connected }: { prospectId: string; connected: boolean }) {
  const [candidates, setCandidates] = useState<ApolloCandidate[] | null>(null);
  const [byTitle, setByTitle] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [revealing, setRevealing] = useState<string | null>(null);

  if (!connected) {
    return (
      <div className="rounded-2xl border border-dashed p-4 text-[0.9375rem] text-muted-foreground">
        <strong className="text-foreground">Apollo is not connected yet.</strong> Add <code className="font-mono text-sm">APOLLO_API_KEY</code>{" "}
        to <code className="font-mono text-sm">.env.local</code> and restart the app to search Apollo. Until then, add people you
        found yourself below.
      </div>
    );
  }

  const search = () =>
    startSearch(async () => {
      setError(null);
      const res = await findPeople(prospectId);
      if (!res.ok) {
        setError(res.error);
        setCandidates(null);
        return;
      }
      setCandidates(res.candidates);
      setByTitle(res.byTitle);
    });

  const reveal = async (c: ApolloCandidate) => {
    setRevealing(c.apolloId);
    const res = await revealContact(prospectId, c.apolloId);
    setRevealing(null);
    if (res.error) toast.error(res.error);
    else {
      if (res.message) toast.success(res.message);
      setCandidates((list) => list?.filter((x) => x.apolloId !== c.apolloId) ?? null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="gradient-outline" onClick={search} disabled={searching}>
          <Search /> {searching ? "Searching…" : candidates ? "Search again" : "Find people"}
        </Button>
        <span className="text-[13px] text-muted-foreground/75 italic">Searching Apollo is free. Getting an email costs 1 Apollo credit.</span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {candidates && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {candidates.length === 0
              ? "Apollo has no one else at this company."
              : byTitle
                ? `${candidates.length} people in the roles to approach. Apollo hides last names until you get the email.`
                : `No one matched the roles to approach, so these are other people Apollo knows at the company.`}
          </p>
          <ul className="divide-y rounded-2xl border">
            {candidates.map((c) => (
              <li key={c.apolloId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium">{c.displayName}</div>
                  <div className="text-sm text-muted-foreground">
                    {c.title ?? "No title"} · {c.hasEmail ? "Apollo has an email" : "Apollo may not have an email"}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => reveal(c)}
                  disabled={revealing !== null}
                  aria-label={`Get email for ${c.displayName}, 1 Apollo credit`}
                >
                  <Mail /> {revealing === c.apolloId ? "Getting…" : "Get email · 1 credit"}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
