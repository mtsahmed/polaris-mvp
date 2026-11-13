# Polaris by TiffanyAI

Takes a business or talent profile from **profile → ICP → cited opportunity discovery → contacts → partnership concepts → approved outreach → pipeline**. The plan, decisions and roadmap are in [docs/polaris-mvp-roadmap.md](docs/polaris-mvp-roadmap.md).

## Status

**Weeks 1–2 (foundation): built, awaiting first run against a real Supabase project.**

| Area | State |
|---|---|
| Login, sign-up, email confirmation | Built (Supabase Auth, email + password) |
| Workspaces (organizations) with row-level security | Built; every table is scoped by `org_id` |
| Profiles: create, edit, delete; voice samples | Built |
| Sources: links, PDF/.txt/.md uploads, owner questionnaire | Built |
| Profile intelligence: Claude reads the sources and drafts the profile with a quote per claim | Built |
| ICP: Claude draft, manual edits, versions, approval stamped with the approver | Built |
| Usage & cost log for every provider call | Built |
| Pitch studio, discovery, contacts, outreach, pipeline | Weeks 3–8 (shown as "planned" in the sidebar, not clickable) |

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · shadcn/ui (Base UI) · Supabase (Postgres, Auth, Storage) · Claude API (`claude-opus-5-5`, web fetch tool, structured outputs) · OpenAI Responses API as fallback.

## First-time setup

1. **Create a Supabase project** at supabase.com (free tier is fine to start).
2. **Create the database.** In the Supabase dashboard open *SQL Editor* and run each file in `supabase/migrations/` in name order:
   - `20261112000000_initial_schema.sql` creates all tables, the security rules and the `profile-uploads` storage bucket.
   - `20261113000000_grants.sql` lets signed-in users use those tables (without it you see "permission denied for table").
3. **Auth settings.** *Authentication → URL Configuration*: set Site URL to `http://localhost:3000` (and later your Vercel URL), and add `http://localhost:3000/auth/confirm` to Redirect URLs.
   Supabase's built-in email sender allows only a few emails an hour; add your own SMTP under *Authentication → Emails* before inviting others.
4. **Environment.** Copy `.env.example` to `.env.local` and fill in the Supabase URL and anon key (*Project Settings → API*) and your `ANTHROPIC_API_KEY`. Optionally add `OPENAI_API_KEY` as a fallback for when Claude is unavailable; `OPENAI_MODELS` sets the order of OpenAI models tried (default `gpt-6.1-sol,gpt-5.5`).
5. **Run it.**
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000, create an account, confirm the email, name your workspace.

## Everyday commands

```bash
npm run dev     # local development
npm run build   # production build (also type-checks)
npm run lint    # ESLint
```

## How the pieces fit

- `src/proxy.ts` refreshes the Supabase session on every request and sends signed-out users to `/login`.
- `src/lib/session.ts` resolves the signed-in user and their active workspace; pages call `requireSession()`.
- `src/app/(app)/profiles/actions.ts` holds every profile, source, intelligence and ICP action.
- The **AI model** picker in the sidebar chooses the model for every AI job (stored per browser). The list lives in `src/lib/ai/models.ts`; add or rename models there. "Auto" keeps the default routing below; a picked model runs on its own and reports an error rather than switching vendor.
- `src/lib/ai/generate.ts` runs every AI job: on Auto, Claude first (`providers/anthropic.ts`), OpenAI only if Claude is unavailable (`providers/openai.ts`). Each job must return JSON matching a schema. Refusals and bad answers are reported, never re-sent to the other vendor. Every attempt is logged. List prices for the cost log are in `claude.ts` (Claude) and `providers/openai.ts` (OpenAI); update them when providers change prices.
- For OpenAI, which cannot read a URL itself, `fetch-page.ts` downloads source pages on the server and refuses private or internal network addresses.
- `src/config/brand.ts` is the only place the product name is set (roadmap 3.4).
- Uploads go straight from the browser to Supabase Storage under `<org id>/<profile id>/…`; storage rules reject any other path.

## Rules the code enforces

- No research without a source: profile intelligence must cite a source label and quote for every statement, or list the gap as a question.
- Approvals are stamped by the database with the acting user (`icps`, `pitches`), and approved ICP versions cannot be edited.
- A pitch cannot leave draft without an approver; editing an approved pitch sends it back to draft (enforced in the schema, used from week 7).
- Every Claude call is logged in `provider_calls` with tokens and estimated cost, including failures.
