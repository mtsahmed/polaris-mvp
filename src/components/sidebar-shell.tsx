"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIDEBAR_COOKIE } from "@/lib/sidebar";

// Collapsible app sidebar (owner review, 17 Nov 2026). On medium screens and up the arrow
// collapses it to a 4rem icon rail and expands it again. The choice is kept in a cookie, so the
// server renders the same width on the next page load with no jump.
//
// Phones (below md, owner review 19 Nov 2026): the sidebar is closed by default. A slim top bar,
// hidden while scrolling down, holds a menu button (three bars) and the brand; the button slides the sidebar in from the left
// over the page, like the Claude iOS app. Tapping outside, pressing Escape, the close button or
// opening another page closes it.
//
// Children hide themselves when collapsed with the classes in src/lib/sidebar.ts, read from the
// data-collapsed attribute on the aside.

const SidebarContext = createContext<{ collapsed: boolean; toggle: () => void }>({ collapsed: false, toggle: () => {} });

const ROUND_BUTTON =
  "grid size-9 shrink-0 place-items-center rounded-full border border-sidebar-border bg-sidebar-accent/60 text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/50";

export function SidebarShell({
  initialCollapsed,
  mobileBrand,
  children,
}: {
  initialCollapsed: boolean;
  mobileBrand?: ReactNode; // shown in the phone top bar next to the menu button
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  };

  // The phone menu is open only on the page where it was opened, so following a link closes it
  // without an effect.
  const pathname = usePathname();
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const mobileOpen = openedOn === pathname;
  const closeMobile = () => setOpenedOn(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenedOn(null);
    };
    // Keep the page underneath still while the menu is open.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  // The phone top bar slides away while scrolling down and comes back on any scroll up, so the page
  // gets the full screen height (owner review, 19 Nov 2026; same behaviour as the landing header).
  const [barHidden, setBarHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      if (Math.abs(y - last) < 6) return;
      setBarHidden(y > last && y > 64);
      last = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      {/* Phone top bar. */}
      <div
        className={cn(
          "sticky top-0 z-30 flex items-center gap-3 border-b border-sidebar-border bg-sidebar/95 px-4 py-2.5 text-sidebar-foreground backdrop-blur transition-transform duration-300 focus-within:translate-y-0 motion-reduce:transition-none md:hidden",
          barHidden && "-translate-y-full",
        )}
      >
        <button
          type="button"
          onClick={() => setOpenedOn(pathname)}
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          aria-controls="app-sidebar"
          className={ROUND_BUTTON}
        >
          <Menu className="size-5" />
        </button>
        {mobileBrand}
      </div>

      {/* Phone backdrop: tap outside the menu to close it. */}
      <div
        aria-hidden="true"
        onClick={closeMobile}
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        id="app-sidebar"
        data-collapsed={collapsed}
        className={cn(
          "group/sidebar flex shrink-0 flex-col gap-4 overflow-x-hidden overflow-y-auto overscroll-contain border-r border-sidebar-border bg-sidebar px-5 py-5 text-sidebar-foreground",
          // Phones: a drawer from the left, hidden (and out of the tab order) until opened.
          "fixed inset-y-0 left-0 z-50 w-[min(20rem,85vw)] transition-[transform,visibility] duration-200 motion-reduce:transition-none",
          mobileOpen ? "visible translate-x-0 shadow-2xl" : "invisible -translate-x-full",
          // Medium screens and up: the sticky column, collapsible to an icon rail.
          "md:visible md:sticky md:top-0 md:z-auto md:h-dvh md:translate-x-0 md:shadow-none md:transition-[width]",
          collapsed ? "md:w-16 md:px-2" : "md:w-72",
        )}
      >
        <button
          type="button"
          onClick={closeMobile}
          aria-label="Close menu"
          className={cn(ROUND_BUTTON, "absolute top-4 right-4 z-10 md:hidden")}
        >
          <X className="size-5" />
        </button>
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
