"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Contact, LayoutDashboard, PenLine, Receipt, Route, Send, Telescope, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIDEBAR_CENTER, SIDEBAR_LABEL } from "@/lib/sidebar";

const NAV: { href: string; label: string; icon: typeof UserRound; ready: boolean; when?: string }[] = [
  { href: "/profiles", label: "Profiles", icon: UserRound, ready: true },
  { href: "/discovery", label: "Discovery", icon: Compass, ready: true },
  { href: "/intelligence", label: "Intelligence", icon: Telescope, ready: true },
  { href: "/contacts", label: "Contacts", icon: Contact, ready: true },
  { href: "/pitch", label: "Pitch studio", icon: PenLine, ready: true },
  { href: "/outreach", label: "Outreach", icon: Send, ready: true },
  { href: "/usage", label: "Usage & cost", icon: Receipt, ready: true },
  { href: "/how-it-works", label: "How it works", icon: Route, ready: true },
];

// Dashboard sits on its own just below the Workspace box (owner review, 17 Nov 2026).
export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard">
      <NavLink href="/dashboard" label="Dashboard" Icon={LayoutDashboard} active={pathname.startsWith("/dashboard")} />
    </nav>
  );
}

function NavLink({ href, label, Icon, active }: { href: string; label: string; Icon: typeof UserRound; active: boolean }) {
  return (
    <Link
      href={href}
      title={label}
      className={cn(
        "flex items-center gap-2.5 rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors",
        SIDEBAR_CENTER,
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/90 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active && "text-sidebar-primary")} />
      <span className={SIDEBAR_LABEL}>{label}</span>
    </Link>
  );
}

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-0.5">
      {NAV.map(({ href, label, icon: Icon, ready, when }) => {
        const active = ready && pathname.startsWith(href);
        if (!ready) {
          return (
            <div
              key={label}
              aria-disabled="true"
              title={`Planned for ${when}`}
              className="flex items-center gap-2.5 rounded-full px-4 py-1.5 text-[13px] text-sidebar-foreground/60"
            >
              <Icon className="size-[18px]" />
              <span className="flex-1">{label}</span>
              <span className="font-mono text-xs">{when}</span>
            </div>
          );
        }
        return <NavLink key={label} href={href} label={label} Icon={Icon} active={active} />;
      })}
    </nav>
  );
}
