import type { Metadata } from "next";
import Link from "next/link";
import { LogOut, Settings, Users } from "lucide-react";
import { AppNav, DashboardNav } from "@/components/app-nav";
import { BrandMark } from "@/components/brand-mark";
import { SidebarShell, SidebarToggle } from "@/components/sidebar-shell";
import { SIDEBAR_COOKIE, SIDEBAR_HIDE, SIDEBAR_LABEL } from "@/lib/sidebar";
import { cn } from "@/lib/utils";
import { cookies } from "next/headers";
import { Journey } from "@/components/journey";
import { ModelPicker } from "@/components/model-picker";
import { ProfileSwitcher } from "@/components/profile-switcher";
import { activeProfile } from "@/lib/profile-selection";
import { anthropicConfigured } from "@/lib/ai/providers/anthropic";
import { openaiConfigured } from "@/lib/ai/providers/openai";
import { selectedModelId } from "@/lib/ai/selection";
import { signOut } from "@/app/login/actions";
import { switchOrganization } from "@/app/onboarding/actions";
import { setModel } from "./model-actions";
import { setActiveProfile } from "./profile-actions";
import { isAppAdmin, requireSession } from "@/lib/session";
import { noIndex } from "@/config/seo";

// The app behind sign-in is never indexed (docs/seo-plan.md).
export const metadata: Metadata = { robots: noIndex, alternates: { canonical: null } };

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  const appAdmin = await isAppAdmin();
  const model = await selectedModelId();
  const { profiles, active } = await activeProfile();
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <SidebarShell initialCollapsed={collapsed}>
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-24 size-80 rounded-full opacity-20 blur-3xl bg-brand-gradient" />
        <div className="relative flex items-center justify-between gap-2 md:group-data-[collapsed=true]/sidebar:flex-col">
          <Link
            href="/"
            title="Polaris home page"
            className="rounded-xl px-2 py-1 transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:group-data-[collapsed=true]/sidebar:px-0"
          >
            <BrandMark textClassName={SIDEBAR_HIDE} />
          </Link>
          <SidebarToggle />
        </div>

        {/* Who is signed in (owner review, 17 Nov 2026). The workspace name shows only when the
            user belongs to more than one, as the switcher. */}
        <div className={cn("relative rounded-2xl border border-sidebar-border bg-sidebar-accent/50 px-4 py-2.5", SIDEBAR_HIDE)}>
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-gold">Signed in</div>
          <div className="mt-0.5 truncate text-[13px] font-semibold" title={session.email ?? ""}>
            {session.fullName ?? session.email?.split("@")[0] ?? "You"}
          </div>
          {session.orgs.length > 1 && (
            <div className="mt-1.5 space-y-0.5">
              <div className="text-[11px] text-sidebar-foreground/70">Workspace:</div>
              {session.orgs.map((o) => (
                <form key={o.id} action={switchOrganization.bind(null, o.id)}>
                  <button
                    type="submit"
                    className={
                      o.id === session.org.id
                        ? "text-[13px] font-semibold"
                        : "text-[13px] text-sidebar-foreground/80 hover:text-sidebar-foreground"
                    }
                  >
                    {o.name}
                  </button>
                </form>
              ))}
            </div>
          )}
          <Link
            href="/workspace"
            className="mt-1.5 flex items-center gap-1.5 text-[11px] text-sidebar-foreground/80 hover:text-sidebar-foreground"
          >
            <Settings className="size-3.5" /> Workspace settings
          </Link>
          {appAdmin && (
            <Link
              href="/admin/users"
              className="mt-1 flex items-center gap-1.5 text-[11px] text-sidebar-foreground/80 hover:text-sidebar-foreground"
            >
              <Users className="size-3.5" /> Users (Polaris admin)
            </Link>
          )}
        </div>

        <div className="relative -my-1">
          <DashboardNav />
        </div>

        {active && profiles.length > 1 && (
          <div className={SIDEBAR_HIDE}>
            <ProfileSwitcher profiles={profiles} value={active.id} setProfile={setActiveProfile} />
          </div>
        )}

        <div className="relative">
          <AppNav />
        </div>

        <div className={SIDEBAR_HIDE}>
          <ModelPicker
            value={model}
            setModel={setModel}
            configured={{ anthropic: anthropicConfigured(), openai: openaiConfigured() }}
          />
        </div>

        <div className="relative mt-auto space-y-2 border-t border-sidebar-border px-2 pt-4 md:group-data-[collapsed=true]/sidebar:px-0">
          <div className={cn("truncate text-[11px] text-sidebar-foreground/80", SIDEBAR_HIDE)} title={session.email ?? ""}>
            {session.email}
          </div>
          <form action={signOut}>
            <button
              type="submit"
              title="Sign out"
              className="flex items-center gap-2 text-[11px] font-medium text-sidebar-foreground/85 hover:text-sidebar-foreground md:group-data-[collapsed=true]/sidebar:mx-auto"
            >
              <LogOut className="size-3.5" /> <span className={SIDEBAR_LABEL}>Sign out</span>
            </button>
          </form>
        </div>
      </SidebarShell>

      <main className="min-w-0 flex-1 px-4 py-10 sm:px-8 lg:px-14 lg:py-14">
        <div className="mx-auto w-full max-w-7xl">
          <Journey />
          {children}
        </div>
      </main>
    </div>
  );
}
