import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Globe, Mail } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { brand } from "@/config/brand";

const LINK = "text-sidebar-foreground/85 underline-offset-4 hover:text-sidebar-foreground hover:underline";

// The footer's one-line description of Polaris (owner's wording, 19 November 2026).
const ABOUT =
  "Polaris is a SalesTech platform for B2B partnership & GTM intelligence with multi-channel outreach. Find the B2B partners worth pitching. Design and automate your pitches, sales pipeline and multi-channel outreach using the frontier AI models.";

// Instagram's outline glyph (lucide-react has no brand icons).
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

// A small round icon followed by the link text. Three rows (3 x 28px + 2 x 6px = 96px) match the
// QR tile (84px + 2 x 6px padding), so both line up top and bottom.
function IconLink({ href, text, external, children }: { href: string; text: string; external?: boolean; children: ReactNode }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener" } : {})}
      className="group flex items-center gap-2.5 text-[15px] text-sidebar-foreground/85 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-full"
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-sidebar-border bg-sidebar-accent/60 transition-colors group-hover:bg-sidebar-accent">
        {children}
      </span>
      <span className="underline-offset-4 group-hover:underline">{text}</span>
    </a>
  );
}

// Footer of the public pages (landing, privacy, terms). Owner review, 19 November 2026: brand, then
// the description with the contact icons and a small QR code on the same row, then legal links and
// copyright.
export function LandingFooter() {
  const website = brand.website.replace(/^https?:\/\//, "");
  return (
    <footer className="relative border-t border-sidebar-border px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-[1120px] space-y-5">
        <BrandMark />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
          <p className="max-w-2xl text-[15px] leading-relaxed text-sidebar-foreground/80">{ABOUT}</p>
          <div className="flex shrink-0 items-center gap-5">
            <ul className="flex flex-col justify-center gap-1.5" aria-label="Contact">
              <li>
                <IconLink href={`mailto:${brand.contactEmail}`} text={brand.contactEmail}>
                  <Mail className="size-3.5" aria-hidden="true" />
                </IconLink>
              </li>
              <li>
                <IconLink href={brand.website} text={website} external>
                  <Globe className="size-3.5" aria-hidden="true" />
                </IconLink>
              </li>
              <li>
                <IconLink href={`https://www.instagram.com/${brand.instagram}/`} text={`@${brand.instagram}`} external>
                  <InstagramIcon className="size-3.5" />
                </IconLink>
              </li>
            </ul>
            <div className="shrink-0 rounded-lg bg-white p-1.5">
              <Image
                src="/icons/qr-code-tiffany.png"
                alt={`${brand.companyName} QR code`}
                width={84}
                height={84}
                className="size-[84px] [image-rendering:pixelated]"
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/privacy" className={LINK}>Privacy policy</Link>
            <Link href="/terms" className={LINK}>Terms of service</Link>
          </nav>
          <p className="text-sidebar-foreground/75">© 2026 {brand.legalName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
