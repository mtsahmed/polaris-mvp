"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { LogIn, Moon, Sun } from "lucide-react";
import { BrandMark, StarIcon } from "@/components/brand-mark";
import { HowItWorksEmbed } from "@/components/how-it-works-embed";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Shared with public/how-it-works.html, which reads the same key so the map starts in the right theme.
const THEME_KEY = "polaris-landing-theme";
type LandingTheme = "dark" | "light";

// Landing page frame: header with the background toggle and Sign in, the hero (children), then the
// route map. Dark is the default; the visitor's choice is kept in this browser only.
export function LandingShell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<LandingTheme>("dark");

  useEffect(() => {
    try {
      // Reading browser storage is a mount-time sync with an external store.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(THEME_KEY) === "light") setTheme("light");
    } catch {
      // Storage unavailable (private window, blocked site data): stay dark.
    }
  }, []);

  function toggle() {
    const next: LandingTheme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Not saved; the switch still applies to this visit.
    }
  }

  const light = theme === "light";

  return (
    // colorScheme must match the map's own scheme, or Chrome paints the frame opaque and hides the glow.
    <main
      className={cn(
        "relative flex min-h-dvh flex-col overflow-clip bg-sidebar text-sidebar-foreground transition-colors duration-300",
        light && "landing-light",
      )}
      style={{ colorScheme: theme }}
    >
      {/* One glow and one faint star for the whole page, so the hero runs into the map with no seam. */}
      <div
        aria-hidden="true"
        className="landing-glow pointer-events-none absolute left-[-10rem] top-[12rem] size-[40rem] rounded-full opacity-25 blur-3xl bg-brand-gradient"
      />
      <StarIcon
        plain
        className="pointer-events-none absolute -right-24 top-0 size-96 text-sidebar-foreground opacity-[0.04]"
      />
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-sidebar-border bg-sidebar/95 px-5 py-3 backdrop-blur sm:px-8">
        <BrandMark size="lg" />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            aria-label={light ? "Switch to dark background" : "Switch to light background"}
            title={light ? "Dark background" : "Light background"}
            className="grid size-10 place-items-center rounded-full border border-sidebar-border bg-sidebar-accent/60 text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {light ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
          </button>
          <Link href="/login" className={buttonVariants({ variant: "brand" })}>
            <LogIn /> Sign in
          </Link>
        </div>
      </header>

      {children}

      <HowItWorksEmbed src="/how-it-works.html" theme={theme} className="relative" />
    </main>
  );
}
