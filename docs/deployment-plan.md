# Deployment plan: Polaris on polaris.tiffanyaisys.com

Status: approved by the owner on 17 November 2026. **Decision: Polaris is hosted on Vercel only.** Hosting the app on Hostinger was considered and dropped by the owner; Hostinger keeps only the DNS and email for `tiffanyaisys.com`.

## Context

Polaris has run only on `localhost:3000` until now, against the owner's real Supabase project. It goes live at `polaris.tiffanyaisys.com`, a subdomain of the TiffanyAI domain whose DNS and email are at Hostinger.

**Why Vercel?**
- **Next.js comes from Vercel**, and this repo already assumes it. Six pages set `export const maxDuration = 300`, which Vercel honours for long research and contact jobs.
- **Every push to `main` deploys automatically from GitHub**, with preview links for branches.
- **No upload problem.** Files go from the browser straight to Supabase Storage (`profile-uploads`), so Vercel's 4.5 MB request limit doesn't apply.

**Plan to use: Vercel Pro (about $20 a month per member).**
- Hobby is limited to non-commercial personal use, and Polaris is a TiffanyAI business tool.
- Both plans allow the 300-second jobs. Pro allows up to 800 seconds if a job ever needs more.
- This sits within the roadmap's $25–45 hosting estimate. Supabase Pro ($25/month) is also worth it, because free projects pause after a week with no activity.

## Steps

### 1. Prepare the repo (small, before the first deploy)
- `README.md`: add a "Deploy to Vercel" section (env vars, Supabase URLs, DNS) and fix step 3, which mentions "later your Vercel URL".
- `CLAUDE.md` current status: add a "Deployed" line once the site is live.
- No code changes are needed:
  - `NEXT_PUBLIC_SITE_URL` already drives email links (`src/lib/env.ts`, used in `src/app/login/actions.ts`).
  - `next.config.ts` needs nothing for Vercel.
  - The PDF route runs on the Node runtime by default.
- Confirm `npx tsc --noEmit`, `npm run lint`, `npm test` and `npm run build` pass on `main`.

### 1b. Stream user-facing AI responses (before go-live)

**Why.** Six AI actions still make the browser wait on one silent request until the whole answer is back, often one to three minutes with web search:
- profile intelligence (`src/lib/ai/profile-intelligence.ts`);
- the ICP draft (`icp-draft.ts`, `draftIcpWithClaude` in `profiles/actions.ts`);
- Find companies (`discovery.ts`);
- pitch research, concepts and emails (`pitch.ts`, `research/provider.ts`, `pitch/actions.ts`).

On the live site such a request crosses Vercel's edge and the user's network. Idle connections can be dropped, mobile browsers suspend background tabs, and the user sees only a spinner. Intelligence briefs and contact searches already avoid this: they run in the background with `after()` and the page updates by itself.

**How.**
1. **Stream from the AI providers.**
   - In `src/lib/ai/providers/anthropic.ts`, call `claude().beta.messages.stream(...)` instead of `.parse(...)`, take the final message from the stream, and keep the existing structured-output check, continuation loop (`pause_turn`), refusal handling and usage logging.
   - In `providers/openai.ts`, use the Responses API with `stream: true` in the same way.
   - `generateStructured()` in `src/lib/ai/generate.ts` gets an optional `onProgress(event)` callback. Events: searching the web (with the site being read), reading sources, writing, and, for emails, the draft text as it arrives.
   - The connection to the AI provider is never silent, and Polaris knows what stage the job is at.
2. **Stream to the browser.** Each of the six actions moves to a streaming route handler, `POST /api/ai/[task]`. This is the Next.js 16 pattern in `node_modules/next/dist/docs/01-app/02-guides/streaming.md`, which Vercel supports natively.
   - **The response:** newline-delimited JSON events (stage, detail, partial email text, then `done` or `error`), with `Cache-Control: no-cache`, `X-Accel-Buffering: no`, and a short heartbeat event every 15 seconds so nothing on the way closes an idle connection.
   - **The work runs separately from the response,** kept alive with `after()`, and **saves its own result** to the database, as the background jobs do today. If the browser closes or the connection drops, the job still finishes.
   - **Checks stay the same:** `requireSession()` and the existing checks for the profile and prospect, `maxDuration = 300`, and the usage and cost log (`logProviderCall`).
3. **Show it in the page.** A small client hook, `useAiStream(task, body)`, reads the stream and feeds the existing `PolarisWorking` panel (`src/components/polaris-working.tsx`). The rotating star and one line ("Reading naturahq.com…", "Writing the first email…") follow the design guide. Email drafts appear word by word. On `done`, the page refreshes (`router.refresh()`). If the connection drops, the panel says the work continues and the page polls until the result is saved.
4. **Unchanged:** Intelligence research and contact searches already run in the background. Their pages can later show the same live progress.

**What streaming does not change.** A request still can't run longer than the Vercel function limit (300 s; up to 800 s on Pro). Streaming stops idle-connection drops and silent waits; it doesn't extend the limit.

**Tests:**
- Unit tests for the event encoding and for the provider adapters, which must produce the same final result from a stream as the current non-streaming calls.
- Then run each of the six actions once locally and once on the live site.

### 2. Create the Vercel project (owner, in the browser; I guide)
- Sign in to vercel.com with GitHub and import `mtsahmed/polaris-mvp`. The framework is detected as Next.js; leave the build settings at their defaults.
- **Function region:** set it to the region closest to the Supabase project's region (Supabase → Project Settings → General), so database calls are fast.
- **Environment variables** (Production and Preview), copied from `.env.local`. The keys are entered by the owner, never by me:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_SITE_URL=https://polaris.tiffanyaisys.com`
  - `ANTHROPIC_API_KEY`
  - `OPENAI_API_KEY`
  - `OPENAI_MODELS`
  - `APOLLO_API_KEY`
- Deploy, then open the `*.vercel.app` link and check the landing page loads.

### 3. Point the subdomain at Vercel (Hostinger DNS)
- In Vercel → Project → Domains, add `polaris.tiffanyaisys.com`. Vercel shows the exact CNAME target.
- In Hostinger:
  - Remove any existing `polaris` record (such as an `A` record from the Hostinger website first set up for it). It would otherwise conflict.
  - In DNS Zone for `tiffanyaisys.com`, add `CNAME polaris → <target Vercel shows>`.
  - Leave the MX and email records untouched, so `info@tiffanyaisys.com` and the SMTP sending keep working.
- Wait for Vercel to show the domain as valid; SSL is issued automatically.

### 4. Supabase settings for the live address
- **Authentication → URL Configuration:**
  - Site URL becomes `https://polaris.tiffanyaisys.com`.
  - Redirect URLs keep `http://localhost:3000/auth/confirm` and add `https://polaris.tiffanyaisys.com/auth/confirm`.
- **Email templates** (`docs/email-templates/*.html`) use `{{ .SiteURL }}`, so confirmation and reset links then point to the live site. Side effect: sign-ups made on localhost also get live-site links. That's fine with one shared project; a separate staging project can come later.
- **Migrations:** all are applied already, including `20261125000000_impact_leads.sql`. Nothing to run.

### 5. Go-live checks on https://polaris.tiffanyaisys.com
- **Landing page:**
  - The hero, the fixed-height map box, calculator links (`#impact?…`) and the header that hides on scroll all work.
  - The report form saves a lead and the PDF downloads.
  - Sign in / Create account buttons open `/login`.
- **Accounts:**
  - Create a test account and confirm the email; the link must open the live site.
  - Forgot password works end to end.
- **One real job**, to confirm a run of about two minutes finishes within the 300-second limit: run research on a shortlisted company, or a contact search, and check Usage & cost logs it.
- **Streaming:**
  - Run one streamed action (for example, writing a pitch email) and watch the progress lines and the draft text arrive as it's written.
  - Then close the tab mid-run, reopen the page and check the result was still saved.
- **Security headers:** check `/how-it-works.html` loads inside the landing page frame (same origin) and that the theme switch reaches it.

### 6. Afterwards
- Every merge to `main` deploys to production; branches get preview links.
  - Preview links use the same Supabase project, so test on them with care.
  - Supabase redirects will reject preview addresses unless they're added; sign-in emails always use the live address.
- Optional later:
  - A separate Supabase project for staging.
  - Vercel Analytics.
  - An uptime check.

## Owner decisions in this plan
- Vercel Pro (recommended) or Hobby for now.
- If a Hostinger website was set up for `polaris`, remove it (or at least its `A` record), so the only `polaris` record is the CNAME to Vercel.

## Sources
- Next.js 16 streaming guide (`node_modules/next/dist/docs/01-app/02-guides/streaming.md`): route handlers stream with the Web Streams API, Vercel supports streaming natively, and `X-Accel-Buffering: no` stops proxies buffering the stream.
- [Vercel function duration limits](https://vercel.com/docs/functions/configuring-functions/duration): with Fluid compute, Hobby has a 300 s default and maximum, and Pro defaults to 300 s with up to 800 s.
- [Vercel fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines): Hobby is for non-commercial personal use only.
