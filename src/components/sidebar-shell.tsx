"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIDEBAR_COOKIE } from "@/lib/sidebar";

// Collapsible app sidebar (owner review, 17 Nov 2026). On medium screens and up the arrow
// collapses it to a 4rem icon rail and expands it again. The choice is kept in a cookie, so the
// server renders the same width on the next page load with no jump. Below md the sidebar is a
// top block and does not collapse.
//
// Children hide themselves when collapsed with the classes in src/lib/sidebar.ts, read from the
// data-collapsed attribute on the aside.

const SidebarContext = createContext<{ collapsed: boolean; toggle: () => void }>({ collapsed: false, toggle: () => {} });

export function SidebarShell({ initialCollapsed, children }: { initialCollapsed: boolean; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  };
  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      <aside
        data-collapsed={collapsed}
        className={cn(
          "group/sidebar relative flex shrink-0 flex-col gap-4 overflow-x-hidden overflow-y-auto border-r border-sidebar-border bg-sidebar px-5 py-5 text-sidebar-foreground transition-[width] duration-200 md:sticky md:top-0 md:h-dvh",
          collapsed ? "md:w-16 md:px-2" : "md:w-72",
        )}
      >
        {children}
      </aside>
    </SidebarContext.Provider>
  );
}

export function SidebarToggle() {
  const { collapsed, toggle } = useContext(SidebarContext);
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-expanded={!collapsed}
      title={label}
      className="hidden size-8 shrink-0 place-items-center rounded-full border border-sidebar-border bg-sidebar-accent/60 text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/50 md:grid"
    >
      {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
    </button>
  );
}
