# SEO plan

Added 18 November 2026 (end-to-end review, item 10: "SEO from day one"). Polaris is a signed-in
business app. Only the landing page (`/`) should appear in search results. Everything behind
sign-in stays out of them, and is also private by design.

## Built now

| What | Where | Notes |
|---|---|---|
| Site-wide title, description, keywords, author, Open Graph and Twitter card | `src/app/layout.tsx`, values in `src/config/seo.ts` | Title template `Page · Polaris`. Canonical `/` for the landing page. |
| Share image (1200×630) for LinkedIn, X, Slack, WhatsApp | `src/app/opengraph-image.tsx` | Generated at build time in the brand colours; no image file to maintain. |
| `robots.txt` | `src/app/robots.ts` | Allows `/` and the route-map embed `/how-it-works.html`; disallows the app, auth steps and `/api/`. Points to the sitemap. |
| `sitemap.xml` | `src/app/sitemap.ts` | The landing page. Add each new public page here. |
| Web app manifest | `src/app/manifest.ts` | Name, colours and icon when saved to a phone or desktop. |
| Structured data (JSON-LD) | `src/app/page.tsx` | `Organization` (TiffanyAI) and `SoftwareApplication` (Polaris). |
| `noindex` on private pages | `src/app/(app)/layout.tsx`, login, onboarding, reset password | `noindex, follow`, and no canonical link. |
| Search files reachable when signed out | `PUBLIC_PATHS` in `src/lib/supabase/proxy-session.ts` | Without this the proxy sends crawlers to the sign-in page. |
| One `h1` per page, `lang="en"`, semantic `main` | Existing layout | Checked. |

## Before go-live (deployment plan step 2 onwards)

1. **Set `NEXT_PUBLIC_SITE_URL` on Vercel** to the live address (for example `https://polaris.tiffanyaisys.com`). Canonical links, the sitemap and the share image all use it; left unset they point at localhost.
2. **Keep preview deployments out of search.** Vercel adds `X-Robots-Tag: noindex` to preview URLs by default; check it is still on.
3. **Google Search Console and Bing Webmaster Tools:** verify the domain (DNS record), submit `/sitemap.xml`, then check the landing page with the URL inspection tool.
4. **Check the share preview** with LinkedIn Post Inspector and the X card validator once the domain is live.
5. **Run Lighthouse** (Chrome DevTools) on the live landing page and fix anything under 90 for Performance, Accessibility, Best practices and SEO.

## Later, when there is time for content

- A pricing page and a short "How Polaris works" article page, each with its own title and description, added to the sitemap.
- Case studies with real, approved results (never invented numbers; see the project rules).
- A blog for search terms such as "how to find brand partnerships" or "sponsorship outreach email", written from real Polaris runs.
- Final product name: after the trademark clearance search, change `brand.ts`. Titles, share image and structured data follow automatically.
