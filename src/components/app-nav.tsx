"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Contact, Kanban, PenLine, Receipt, Send, Telescope, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; icon: typeof UserRound; ready: boolean; when?: string }[] = [
  { href: "/profiles", label: "Profiles", icon: UserRound, ready: true },
  { href: "/discovery", label: "Discovery", icon: Compass, ready: true },
  { href: "/intelligence", label: "Intelligence", icon: Telescope, ready: true },
  { href: "/contacts", label: "Contacts", icon: Contact, ready: true },
  { href: "/pitch", label: "Pitch studio", icon: PenLine, ready: true },
  { href: "/outreach", label: "Outreach", icon: Send, ready: true },
  { href: "/pipeline", label: "Pipeline", icon: Kanban, ready: true },
  { href: "/usage", label: "Usage & cost", icon: Receipt, ready: true },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-1.5">
      {NAV.map(({ href, label, icon: Icon, ready, when }) => {
        const active = ready && pathname.startsWith(href);
        if (!ready) {
          return (
            <div
              key={label}
              aria-disabled="true"
              title={`Planned for ${when}`}
              className="flex items-center gap-3 rounded-full px-4 py-2.5 text-[0.9375rem] text-sidebar-foreground/60"
            >
              <Icon className="size-[18px]" />
              <span className="flex-1">{label}</span>
              <span className="font-mono text-xs">{when}</span>
            </div>
          );
        }
        return (
          <Link
            key={label}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-full px-4 py-2.5 text-base font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/90 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className={cn("size-[18px]", active && "text-sidebar-primary")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
