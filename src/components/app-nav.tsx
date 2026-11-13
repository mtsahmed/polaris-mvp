"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Kanban, PenLine, Receipt, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/profiles", label: "Profiles", icon: UserRound, ready: true },
  { href: "/usage", label: "Usage & cost", icon: Receipt, ready: true },
  { href: "#", label: "Pitch studio", icon: PenLine, ready: false, when: "Weeks 3–4" },
  { href: "#", label: "Discovery", icon: Compass, ready: false, when: "Weeks 5–6" },
  { href: "#", label: "Pipeline", icon: Kanban, ready: false, when: "Weeks 7–8" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {NAV.map(({ href, label, icon: Icon, ready, when }) => {
        const active = ready && pathname.startsWith(href);
        if (!ready) {
          return (
            <div
              key={label}
              aria-disabled="true"
              title={`Planned for ${when}`}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/35"
            >
              <Icon className="size-4" />
              <span className="flex-1">{label}</span>
              <span className="text-[10px] uppercase tracking-wider">{when}</span>
            </div>
          );
        }
        return (
          <Link
            key={label}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className={cn("size-4", active && "text-sidebar-primary")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
