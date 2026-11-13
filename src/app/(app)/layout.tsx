import { LogOut } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { BrandMark } from "@/components/brand-mark";
import { ModelPicker } from "@/components/model-picker";
import { anthropicConfigured } from "@/lib/ai/providers/anthropic";
import { openaiConfigured } from "@/lib/ai/providers/openai";
import { selectedModelId } from "@/lib/ai/selection";
import { signOut } from "@/app/login/actions";
import { switchOrganization } from "@/app/onboarding/actions";
import { setModel } from "./model-actions";
import { requireSession } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  const model = await selectedModelId();

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="relative flex shrink-0 flex-col gap-8 overflow-x-hidden overflow-y-auto border-r border-sidebar-border bg-sidebar px-5 py-7 text-sidebar-foreground md:sticky md:top-0 md:h-dvh md:w-72">
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-24 size-80 rounded-full opacity-20 blur-3xl bg-brand-gradient" />
        <BrandMark className="relative px-2" />

        <div className="relative rounded-2xl border border-sidebar-border bg-sidebar-accent/50 px-4 py-3">
          <div className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-gold">Workspace</div>
          {session.orgs.length > 1 ? (
            <div className="mt-1 space-y-0.5">
              {session.orgs.map((o) => (
                <form key={o.id} action={switchOrganization.bind(null, o.id)}>
                  <button
                    type="submit"
                    className={
                      o.id === session.org.id
                        ? "text-base font-semibold"
                        : "text-base text-sidebar-foreground/80 hover:text-sidebar-foreground"
                    }
                  >
                    {o.name}
                  </button>
                </form>
              ))}
            </div>
          ) : (
            <div className="mt-1 truncate text-base font-semibold">{session.org.name}</div>
          )}
        </div>

        <div className="relative">
          <AppNav />
        </div>

        <ModelPicker
          value={model}
          setModel={setModel}
          configured={{ anthropic: anthropicConfigured(), openai: openaiConfigured() }}
        />

        <div className="relative mt-auto space-y-3 border-t border-sidebar-border px-2 pt-5">
          <div className="truncate text-sm text-sidebar-foreground/80" title={session.email ?? ""}>
            {session.email}
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-2 text-sm font-medium text-sidebar-foreground/85 hover:text-sidebar-foreground"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-10 sm:px-8 lg:px-14 lg:py-14">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
