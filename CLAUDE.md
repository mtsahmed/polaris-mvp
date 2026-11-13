@AGENTS.md
@docs/polaris-mvp-roadmap.md

# Polaris project notes

The approved plan is imported above from `docs/polaris-mvp-roadmap.md`. Edit the plan there, never here, so there is one copy. Setup and architecture: `README.md`.

## Current status

Update this section whenever a phase starts or finishes.

- **Weeks 1–2, foundation:** built 12 November 2026. Auth, workspaces with RLS, profiles, sources (links, uploads, questionnaire), Claude profile intelligence with cited evidence, versioned ICP with approval, usage and cost log. Type-checks, lints and builds. Running against the owner's real Supabase project since 13 November 2026 (migrations applied by pasting into the SQL Editor). First profile created and a profile-intelligence draft generated on 13 November via the OpenAI fallback (gpt-6.1-sol), because the Anthropic account has no credit yet. Claude path not yet exercised end to end; ICP drafting not yet tried.
- **Next: weeks 3–4, pitch studio.**
- Week 0 tasks (sending domains, Apollo API check, Instantly spike, trademark search) are the owner's and run in parallel.

## Rules for working in this repo

- Next.js 16: use `proxy.ts` (not middleware), async `params`/`searchParams`/`cookies()`. Cache Components is off on purpose.
- shadcn/ui here is the Base UI flavour: components take a `render` prop, not `asChild`. For links styled as buttons use `buttonVariants()` on `<Link>`.
- Database changes go in a new file under `supabase/migrations/`; every new table needs `org_id`, the member-only RLS policy, and an explicit `grant ... to authenticated` (this Supabase project does not grant table access automatically).
- AI calls go through `generateStructured()` in `src/lib/ai/generate.ts` (Claude first, OpenAI fallback only when Claude is unavailable, never after a refusal). Log `result.attempts` / `AiError.attempts` with `logProviderCall`.
- Never present mock or placeholder data as real. Unbuilt features stay visibly "planned".
- Run `npx tsc --noEmit`, `npm run lint` and `npm run build` before calling work done.
