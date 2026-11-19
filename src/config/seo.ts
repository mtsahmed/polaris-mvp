import { brand } from "./brand";

// Search and sharing settings (end-to-end review, 18 November 2026: SEO from day one). Plan and
// checklist: docs/seo-plan.md. Only the landing page is meant to be found; everything behind
// sign-in is marked noindex and disallowed in robots.txt.

// The public address. Set NEXT_PUBLIC_SITE_URL to the live domain on Vercel, or every canonical
// link, sitemap entry and share image points at localhost.
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export const seo = {
  title: `${brand.fullName}: partnership and customer prospecting with sourced research`,
  description:
    "Polaris turns a business or talent profile into an ideal customer profile, finds companies that fit, researches each one with cited sources, finds decision-makers and drafts outreach you approve before it is sent.",
  keywords: [
    "partnership prospecting",
    "B2B prospecting",
    "ideal customer profile",
    "account research",
    "sales intelligence",
    "brand partnerships",
    "sponsorship outreach",
    "AI sales research",
    "cited research",
    "outreach drafts",
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
