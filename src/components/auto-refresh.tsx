"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// While a background job is running, re-reads the page every few seconds so its real status
// shows up. Renders nothing; stops as soon as the server says nothing is running.
export function AutoRefresh({ active, everyMs = 6000 }: { active: boolean; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(t);
  }, [active, everyMs, router]);
  return null;
}
