import { LogOut } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { BrandMark } from "@/components/brand-mark";
import { signOut } from "@/app/login/actions";
import { switchOrganization } from "@/app/onboarding/actions";
import { requireSession } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-8 bg-sidebar px-4 py-6 text-sidebar-foreground md:sticky md:top-0 md:h-screen md:w-64">
        <BrandMark className="px-2" />

        <div className="px-2">
          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-sidebar-foreground/45">
            Workspace
          </div>
          {session.orgs.length > 1 ? (
            <div className="mt-1 space-y-0.5">
              {session.orgs.map((o) => (
                <form key={o.id} action={switchOrganization.bind(null, o.id)}>
                  <button
                    type="submit"
                    className={
                      o.id === session.org.id
                        ? "text-sm font-medium"
                        : "text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground"
                    }
                  >
                    {o.name}
                  </button>
                </form>
              ))}
            </div>
          ) : (
            <div className="mt-1 truncate text-sm font-medium">{session.org.name}</div>
          )}
        </div>

        <AppNav />

        <div className="mt-auto space-y-3 border-t border-sidebar-border px-2 pt-4">
          <div className="truncate text-xs text-sidebar-foreground/60" title={session.email ?? ""}>
            {session.email}
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground"
            >
              <LogOut className="size-3.5" /> Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-12">{children}</main>
    </div>
  );
}
