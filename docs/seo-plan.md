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
| Favicons (light and dark) | `public/icons/`, `src/app/favicon.ico`, icons in `src/app/layout.tsx` | The brand star on a white tile for light browser themes and on navy for dark ones, plus the Apple icon and 192/512 app icons. Regenerate with `node scripts/favicons/make-favicons.mjs`. |
| Structured data (JSON-LD) | `src/app/page.tsx` | `Organization` (TiffanyAI) and `SoftwareApplication` (Polaris). |
| `noindex` on private pages | `src/app/(app)/layout.tsx`, login, onboarding, reset password | `noindex, follow`, and no canonical link. |
| Search files reachable when signed out | `PUBLIC_PATHS` in `src/lib/supabase/proxy-session.ts` | Without this the proxy sends crawlers to the sign-in page. |
| One `h1` per page, `lang="en"`, semantic `main` | Existing layout | Checked. |
| Title and description (owner's wording, 19 Nov 2026) | `src/config/seo.ts` | Title "Polaris by TiffanyAI: B2B Partnership & GTM Intelligence" (short, since search results cut at about 60 characters); the full positioning sentence is the description, share text, manifest, JSON-LD and llms.txt summary. Page titles use `Page · Polaris by TiffanyAI`. |
| `llms.txt` for AI agents | `src/app/llms.txt/route.ts`, text in `src/lib/agents/discovery.ts` | H1, summary blockquote and link lists (llmstxt.org). |
| Agent catalog (ARD) | `/.well-known/ai-catalog.json` and `/.well-known/ard.json` (same manifest), `<link rel="ai-catalog">` / `rel="ard"` on the landing page | `specVersion` 1.0, one entry pointing at llms.txt. Lighthouse 13.5 reads the ai-catalog path; the current spec uses ard.json. Add entries if Polaris ever offers an MCP server or public API. |
| Privacy policy and Terms of service | `/privacy`, `/terms` (`src/app/(legal)/`), in the sitemap and the landing footer | Drafts for the owner's review (19 Nov 2026); set `DRAFT` to false in `draft-notice.tsx` once approved. |

## Before go-live (deployment plan step 2 onwards)

1. **Set `NEXT_PUBLIC_SITE_URL` on Vercel** to the live address (for example `https://polaris.tiffanyaisys.com`). Canonical links, the sitemap and the share image all use it; left unset they point at localhost.
2. **Keep preview deployments out of search.** Vercel adds `X-Robots-Tag: noindex` to preview URLs by default; check it is still on.
3. **Google Search Console and Bing Webmaster Tools:** verify the domain (DNS record), submit `/sitemap.xml`, then check the landing page with the URL inspection tool. *Google: domain verified by DNS and sitemap submitted 19 November 2026. Bing: the Search Console import did not list the site, so it is verified with the XML file `public/BingSiteAuth.xml` (public in `proxy-session.ts`), added 19 November 2026; then submit the sitemap in Bing. IndexNow key file `public/ccf5a106b3f9490fade1bab6bed13bc2.txt` (public in `proxy-session.ts`); after a change to a public page is deployed, run `node scripts/indexnow.mjs` to tell Bing and the other IndexNow engines.*
4. **Check the share preview** with LinkedIn Post Inspector and the X card validator once the domain is live. *Done 19 November 2026: LinkedIn shows the share image, title and description.*
5. **Run Lighthouse** (Chrome DevTools) on the live landing page and fix anything under 90 for Performance, Accessibility, Best practices and SEO.

## Later, when there is time for content

- A pricing page and a short "How Polaris works" article page, each with its own title and description, added to the sitemap.
- Case studies with real, approved results (never invented numbers; see the project rules).
- A blog for search terms such as "how to find brand partnerships" or "sponsorship outreach email", written from real Polaris runs.
- Final product name: after the trademark clearance search, change `brand.ts`. Titles, share image and structured data follow automatically.
