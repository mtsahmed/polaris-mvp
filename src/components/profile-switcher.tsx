"use client";

import { useEffect, useTransition } from "react";
import { UserRound } from "lucide-react";
import type { ProfileOption } from "@/lib/profile-selection";

// Sidebar control: which profile the journey bar and stage pages work on.
export function ProfileSwitcher({
  profiles,
  value,
  setProfile,
}: {
  profiles: ProfileOption[];
  value: string;
  setProfile: (formData: FormData) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <form action={setProfile} className="relative rounded-2xl border border-sidebar-border bg-sidebar-accent/50 px-4 py-3">
      <label
        htmlFor="profile-switcher"
        className="flex items-center gap-1.5 font-mono text-xs font-medium uppercase tracking-[0.14em] text-gold"
      >
        <UserRound className="size-3.5" aria-hidden="true" /> Profile
      </label>
      <select
        id="profile-switcher"
        name="profile"
        // key: re-mount when another page changes the active profile.
        key={value}
        defaultValue={value}
        disabled={pending}
        onChange={(e) => {
          const formData = new FormData(e.currentTarget.form!);
          startTransition(() => setProfile(formData));
        }}
        className="mt-2 h-10 w-full rounded-xl border border-sidebar-border bg-sidebar px-3 text-[0.9375rem] font-medium text-sidebar-foreground [color-scheme:dark] outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/50 disabled:opacity-70"
      >
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </form>
  );
}

// Placed on pages that belong to one profile, so the journey bar follows what the user opened.
export function FollowProfile({
  profileId,
  activeId,
  follow,
}: {
  profileId: string;
  activeId: string | null;
  follow: (profileId: string) => Promise<void>;
}) {
  useEffect(() => {
    if (profileId !== activeId) void follow(profileId);
  }, [profileId, activeId, follow]);
  return null;
}
