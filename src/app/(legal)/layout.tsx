import Link from "next/link";
import { LogIn } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { LandingFooter } from "@/components/landing-footer";
import { buttonVariants } from "@/components/ui/button";

// Public legal pages (privacy, terms): the landing page's dark frame, header and footer.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col bg-sidebar text-sidebar-foreground" style={{ colorScheme: "dark" }}>
      <header className="flex items-center justify-between gap-4 border-b border-sidebar-border px-5 py-3 sm:px-8">
        <Link href="/" title="Polaris home page" className="rounded-xl transition-opacity hover:opacity-85">
          <BrandMark size="lg" />
        </Link>
        <Link href="/login" className={buttonVariants({ variant: "brand" })}>
          <LogIn /> Sign in
        </Link>
      </header>
      <article className="legal mx-auto w-full max-w-3xl flex-1 px-5 py-12 sm:px-8">{children}</article>
      <LandingFooter />
    </main>
  );
}
