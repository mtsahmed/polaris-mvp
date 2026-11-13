# Polaris by TiffanyAI: MVP decisions, architecture and roadmap

Last updated: 12 November 2026. Status: **approved by the owner on 12 November 2026.** Build started; weeks 1–2 foundation in progress.

## 1. What Polaris is

A branded web app that takes one business or talent profile from **profile → ICP → cited opportunity discovery → decision-maker contacts → creative partnership concepts → approved outreach → pipeline**.

- First segment: media and creative businesses, US market.
- Other profile types (creators, athletes, agencies, real estate, legal) are stored as configuration and are not tuned or tested in v1.
- Success metric: reply rate and meeting rate per 20 pitches sent.
- Volume assumption: about 50 well-researched companies a month, roughly 150 contacts.

## 2. Decisions agreed

| Topic | Decision |
|---|---|
| Name | Polaris by TiffanyAI |
| Contact data | Apollo.io only, behind a provider adapter. Email for every saved contact; mobile number revealed on demand |
| Research and signals | Claude API web search is the source for all stored research, plus Apollo news and job-posting data. Google Search was the owner's first preference, but Google's terms do not allow its grounded results to be stored or analyzed (see 3.6), so it is limited to an optional live lookup. Every signal carries a source URL and date or is not shown |
| Priority score | Explainable: each score lists the signals that produced it |
| Orchestration | TypeScript functions plus a job queue. n8n stays out of v1 and is added only if a real need appears |
| Outreach channels | Email for first contact. Phone call, text message and WhatsApp are follow-up methods recorded per contact |
| Human approval | Required before every email, call or message. Nothing leaves Polaris without a named user approving it |
| Email sending | Instantly (Hypergrowth plan), behind an adapter so it can be swapped later |
| Investor demo | After week 8, once the end-to-end flow works with real data |
| Trademark clearance | Owner will have a US trademark attorney run a clearance search on "TiffanyAI" and "Polaris" before investor materials are finalized |
| WhatsApp and text messages | Follow-up only, after a prospect has replied or shared a number. WhatsApp uses a click-to-chat link; no WhatsApp or SMS API in v1 |
| Phone calls | Allowed as a follow-up to an unanswered email, placed by the user by hand |
| Voice | No "AI humanizer" tools. Quality comes from research, the user's writing samples, short emails and human edits |
| Dropped or deferred | Gojiberry (dropped). Clay, branded PDF proposals, LinkedIn automation, CRM sync, billing (deferred) |
| Maintenance | Owner with Claude Code; no developer assumed |
| AI fallback (added 13 November 2026) | Claude stays the primary model. OpenAI is a fallback used only when Claude is unavailable (invalid key, no credit, rate limit, outage), never after a safety refusal. OpenAI models are tried in order: gpt-6.1-sol ($2 / $10 per million tokens), then gpt-5.5 ($5 / $30) only if gpt-6.1-sol is unavailable. Every attempt is logged with its provider, model and cost. On the OpenAI path Polaris downloads source pages itself, since OpenAI cannot read a given URL |

## 3. Open points that need the owner's decision

### 3.1 WhatsApp and mobile outreach
Meta's WhatsApp Business policy requires a recipient's opt-in before a business messages them, and unsolicited messages risk account suspension. US business contacts also rarely use WhatsApp for work, and Apollo charges 8 credits per mobile number against 1 for an email.

**Agreed (12 November 2026):** v1 is email only for first contact. WhatsApp appears in the pipeline as a follow-up action (a click-to-chat link) only after a prospect has replied or shared a number. No WhatsApp API in v1.

**Added at the owner's request: mobile number and outreach method.**

- Each contact can hold a mobile number, its status (verified, unverified, missing) and source, and a chosen outreach method: email, call, text message or WhatsApp.
- Mobile numbers are revealed from Apollo one contact at a time when the user asks, not in bulk, because each costs 8 credits.
- A call or message is prepared in Polaris as a draft (call talking points or message text), approved by a user, and only then actioned. The approval, approver and time are logged.
- In v1 the user places the call or sends the message from their own phone through a click-to-call or click-to-chat link, then records the outcome. Polaris does not dial or send texts itself.

**Agreed rule for v1 (12 November 2026):** calls may be a follow-up to an unanswered email, while text messages follow the WhatsApp rule and go only to contacts who have replied or shared their number.

**Background (not legal advice):** unsolicited texts to US mobile numbers carry legal risk under the federal Telephone Consumer Protection Act, and several states add their own rules; calls placed by hand to business contacts are treated more leniently than texts or automated dialing. Have a US attorney confirm before any calling or texting starts.

### 3.2 The approval gate must live in Polaris, not in the sending tool
Instantly and Smartlead are built to send sequences automatically. To keep human approval: Polaris stores each draft, the user approves it, and only then is that lead pushed to the sending platform with the approved subject and body as per-lead fields. This needs a one-day technical spike in week 0 to confirm the chosen platform supports it cleanly.

### 3.3 Sending infrastructure has a lead time
Cold email needs separate sending domains and mailboxes that warm up for two to three weeks. These should be bought in week 0 or the first real send slips. Never send cold email from the main TiffanyAI domain.

### 3.4 Names (not legal advice)
"Different company, so no issue" is not the test trademark law applies; famous marks get protection beyond direct competitors, and Tiffany & Co. has litigated over its name before. "Polaris" is also a heavily used name in software. Since the plan is to pitch US investors, a US trademark attorney's clearance search on both names is worth doing before the pitch deck is printed.

**Agreed (12 November 2026):** the owner will commission the clearance search. Until it is back, keep the product name in one configuration setting so a rename does not mean code changes.

### 3.5 Investor demo date
**Decided (12 November 2026):** the demo comes after week 8. That lets it show the full flow with real data, and week 9 (hardening and demo script) becomes demo preparation. If the date moves earlier, the pitch studio from weeks 3–4 is the piece to show.

### 3.6 Google Search cannot be the stored research source
Google no longer sells new customers a plain search-results API, so "Google first" would mean letting a Gemini model run the Google searches and return sources (Grounding with Google Search).

**Checked 12 November 2026.** Google's Gemini API terms for that service, as published in the versions readable today (through October 2025), do not fit how Polaris works:

- Grounded results and their links may not be stored, cached, copied or analyzed, and collecting the links for another purpose is named as a violation.
- The only storage allowed is the result text without links, for up to 30 days to tune display, or up to six months inside an end user's chat history.
- Results may be shown only to the end user who submitted the prompt, together with Google's search suggestions.

Polaris needs the opposite: source URLs saved against each signal, results passed to Claude for scoring and pitch writing, and research visible to the whole team for months. The current terms (effective 23 March 2026) could not be opened from this session, so re-read the "Grounding with Google Search" section before relying on this.

**Applied, as set out when this point was raised:** Claude web search is the source for all stored research. Google grounding is at most a live "check on Google" panel that shows results to the user in the moment and stores nothing. Recommendation: leave that panel out of v1, since it adds a second AI vendor for little gain.

**Confirmed by the owner (12 November 2026):** Google first is dropped for now; Claude web search is the research source. This reverses the earlier "Google first" preference. One alternative worth a look only if Claude's search results prove weak in the week 0 test: Google Cloud sells an enterprise web-grounding option under separate terms, which have not been checked.

## 4. Architecture

- **Web app:** Next.js with TypeScript, deployed on Vercel. UI built with Tailwind CSS and shadcn/ui components.
- **Database and auth:** Supabase (Postgres, auth, file storage) with row-level security by organization.
- **Research:** Claude API web search, with every source URL and date saved. Google grounding is not used for stored research (see 3.6).
- **Reasoning and writing:** Claude API produces the profile, ICP, signal extraction, concepts and pitches as structured outputs, working from the sources the search returns.
- **Background jobs:** a hosted job runner (Inngest or Trigger.dev; choose in Phase 1 after checking current free tiers) for research and enrichment runs.
- **Adapters:** `ContactProvider` (Apollo), `ResearchProvider` (Claude web search), `OutreachProvider` (Instantly). Each adapter logs calls and cost.
- **Approval gate:** one shared mechanism for all channels. Email drafts are pushed to the sending platform after approval; call and message drafts unlock a click-to-call or click-to-chat link after approval.
- **Not in v1:** n8n, Clay, CRM sync, LinkedIn, WhatsApp API, SMS API, automated dialer.

### v0.app: fallback only

Decision (12 November 2026): Claude Code builds the frontend with Next.js, Tailwind CSS and shadcn/ui. v0.app is used only if that does not produce a good enough interface.

- **When the fallback applies:** a screen still falls short of the premium TiffanyAI look after two rounds of revision in Claude Code, judged by the owner at the end of weeks 1–2 (app shell) and weeks 3–4 (pitch studio).
- **Why v0 is a workable fallback:** it generates the same Next.js, Tailwind and shadcn/ui code and can import a GitHub repository and return changes as a pull request, so nothing has to be rebuilt.
- **Scope if used:** screen layout and styling only. Database rules, provider adapters, the approval gate, background jobs and anything touching API keys stay with Claude Code.
- **Working rule if used:** one GitHub repository. v0 works on a branch and opens a pull request; Claude Code wires the screen to real data and merges.
- **Cost if used:** credit-based, roughly $0–30 a month. Confirm on v0.app/pricing before subscribing.

### Integration facts checked on 12 November 2026

| Provider | Finding | Note |
|---|---|---|
| Apollo API | People search uses no credits and returns no emails. People enrichment costs 1 credit for email and 8 more for a mobile. Organization search, job postings and news search cost 1 credit per page. Organization enrichment costs 1 credit | Official pricing page does not say which plans unlock the API; confirm inside the account in week 0 |
| Instantly | API v2 from the Growth plan; webhooks (reply events) need Hypergrowth at about $97/month | Up to 1,000 leads per add request |
| Smartlead | API and webhooks sit on Pro at about $94/month as of mid-2026 | Third-party sources disagree about the Base plan; confirm on the live pricing page |
| WhatsApp | Opt-in required before business-initiated messages | See 3.1 |
| Google Search | The Custom Search JSON API is closed to new customers and ends on 1 January 2027. The official route to Google's index is Grounding with Google Search in the Gemini API, billed per search query on current models. Google Cloud lists 5,000 grounded queries a month free, then $14 per 1,000 | Terms bar storing or analyzing grounded results, so it is not used for stored research. See 3.6. Third-party "Google SERP" APIs are unofficial scrapers and are not used |
| v0.app | Generates Next.js, Tailwind and shadcn/ui code; imports existing GitHub repositories; syncs through branches and pull requests | Fallback only. See "v0.app: fallback only" above |

Decision: Instantly on Hypergrowth. The adapter keeps Smartlead available as a swap.

## 5. Database structure (proposed)

All tables carry `org_id` and are protected by row-level security.

| Table | Purpose | Key fields |
|---|---|---|
| organizations, memberships | Tenancy and users | name; user, role |
| profiles | A business or talent being represented | type, name, positioning, services, audience, strengths, objectives, voice samples |
| profile_sources | Inputs behind a profile | kind (url, file, questionnaire), location, extracted text |
| icps | Approved ideal customer profile per profile | industries, company traits, geographies, titles, problems addressed, version |
| companies | Organizations found or entered | name, domain, industry, location, Apollo id |
| signals | Evidence about a company | type, summary, source URL, source date, retrieved at, search provider |
| prospects | A company in one profile's pipeline | profile, company, stage, score, score reasons, status (saved or rejected) |
| contacts | Decision-makers | company, name, title, email, email status (verified, unverified, missing), mobile, mobile status, outreach method (email, call, text, WhatsApp), consent to message (yes, no, unknown), source, retrieved at |
| concepts | Partnership ideas for a prospect | title, description, commercial rationale, signals used, selected |
| pitches | Outreach drafts | prospect, contact, concept, channel (email, call, text, WhatsApp), kind (first contact, follow-up, call talking points), subject, body, status (draft, approved, sent or done), approved by, approved at |
| outreach_events | Sends, replies, bounces, calls, messages, meetings | pitch, channel, type, outcome, timestamp, provider reference |
| tasks | Follow-ups | prospect, due date, done |
| provider_calls | Usage and cost log | provider, endpoint, credits or tokens, cost estimate |

Pipeline stages: New Lead → Researching → Ready to Pitch → Contacted → Replied → Meeting Booked → Won or Lost.

## 6. Roadmap

| When | Deliverable | Done when |
|---|---|---|
| Week 0 (starts now, in parallel) | Manual test: 20 pitches for one real media profile using Claude and the Apollo app. Buy sending domains and start mailbox warm-up. Confirm Apollo API access on the chosen plan. Spike the approval-then-push flow on Instantly. Research 10 companies with Claude web search and judge whether the sources are good enough. Commission the trademark clearance search | 20 pitches sent; reply rate recorded; API keys working; search quality noted |
| Weeks 1–2 | Foundation: branded app shell, login, organizations, profiles, profile intelligence from URLs and uploads, editable ICP | A real profile and ICP can be created, edited and saved |
| Weeks 3–4 | Pitch studio: paste a company URL → cited research → 2–3 concepts → email, subject line and follow-up, all editable | Pitches from the app are at least as good as the week 0 manual ones |
| Weeks 5–6 | Discovery and contacts: ICP-driven company discovery with cited signals and explainable scores; Apollo contacts with verified and unverified labels; on-demand mobile reveal and outreach method per contact | 25 real companies with sources and contacts for one profile |
| Weeks 7–8 | Outreach and pipeline: approval gate for email, call and message; push to Instantly; click-to-call and click-to-chat with outcome logging; reply events; pipeline board, tasks, dashboard with real numbers | One prospect taken end to end from discovery to "Replied" |
| Week 9 | Hardening: second profile to prove data separation, error handling for failed providers, cost dashboard, handover notes and demo script | Clean run-through with two profiles |

This is an estimate for part-time work with Claude Code and assumes the scope above does not grow.

## 7. Estimated monthly running cost (internal use)

| Item | Estimate |
|---|---|
| Hosting and database (Vercel, Supabase) | $25–45 |
| Claude API including web search, about 50 companies a month | $50–150 |
| Apollo, one seat | $49–119 |
| Instantly Hypergrowth | about $97 |
| Sending domains and mailboxes | $20–40 |
| **Total** | **about $240–450** |

Figures other than Instantly and Apollo list prices are estimates and should be checked against live pricing at sign-up. Mobile reveals draw on the Apollo seat's credits at 8 each, so heavy use of mobile numbers may need a larger plan or extra credits. v0.app is a fallback and not included; add $0–30 a month if it is used.

## 8. Rules carried from the project instructions

- Never fabricate contacts, signals or research; unverified items are labelled.
- Human approval before any external email, call or message.
- No mock functionality presented as finished.
- Every provider call is logged with its cost.

## Sources

- Apollo API pricing: https://docs.apollo.io/docs/api-pricing
- Instantly webhooks and plans: https://instantly.ai/blog/how-to-integrate-email-api-webhooks-for-real-time-reply-tracking/
- Instantly API v2 overview: https://instantly.ai/blog/api-webhooks-custom-integrations-for-outreach/
- Smartlead pricing: https://www.smartlead.ai/pricing.md
- WhatsApp opt-in requirement: https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in.md
- Google Custom Search JSON API closure: https://developers.google.com/custom-search/v1/overview
- Grounding with Google Search: https://ai.google.dev/gemini-api/docs/interactions/google-search.md.txt
- Gemini API terms, grounding section (archived versions read): https://ai.google.dev/gemini-api/terms-archive/terms_04_03_25 and https://ai.google.dev/gemini-api/terms-archive/terms_10_07_25
- Google Cloud grounding pricing: https://cloud.google.com/vertex-ai/generative-ai/pricing
- v0 FAQ: https://v0.app/faq
