import { brand } from "./brand";

// Search and sharing settings (end-to-end review, 18 November 2026: SEO from day one). Plan and
// checklist: docs/seo-plan.md. Only the landing page is meant to be found; everything behind
// sign-in is marked noindex and disallowed in robots.txt.

// The public address. Set NEXT_PUBLIC_SITE_URL to the live domain on Vercel, or every canonical
// link, sitemap entry and share image points at localhost.
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export const seo = {
  // Owner's wording, 19 November 2026: a short title (search results cut titles at about 60
  // characters) and the full positioning sentence as the description everywhere.
  title: `${brand.fullName}: B2B Partnership & GTM Intelligence`,
  description:
    "Polaris by TiffanyAI is a SalesTech platform for B2B partnership & GTM intelligence with multi-channel outreach. Find the B2B partners worth pitching. Design and automate your pitches and multi-channel outreach using the frontier AI models.",
  keywords: [
    "partnership prospecting",
    "B2B prospecting",
    "B2B sales intelligence",
    "ideal customer profile",
    "company research",
    "sales intelligence",
    "brand partnerships",
    "sponsorship outreach",
    "AI sales research",
    "cited research",
    "outreach drafts",
    "SalesTech",
    "GTM intelligence",
    "AI SDR",
    "multi-channel outreach",
  ],
  // Pages that never belong in search results: the signed-in app, auth steps and APIs.
  privatePaths: [
    "/api/",
    "/admin",
    "/auth/",
    "/dashboard",
    "/profiles",
    "/discovery",
    "/intelligence",
    "/contacts",
    "/pitch",
    "/outreach",
    "/pipeline",
    "/usage",
    "/workspace",
    "/how-it-works$", // the in-app page only; the landing embed /how-it-works.html stays open
    "/login",
    "/onboarding",
    "/reset-password",
  ],
} as const;

// Never index, but let crawlers follow links back to the landing page.
export const noIndex = { index: false, follow: true } as const;
