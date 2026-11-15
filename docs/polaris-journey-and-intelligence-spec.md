# Polaris: journey bar, Next action and the Intelligence stage

Build instructions for Claude Code. Read this whole file, inspect the existing code and schema, then show a short plan and wait for approval before changing anything. This file works alongside `polaris-mvp-roadmap.md`; where the two differ on the journey, this file wins.

## 1. Purpose

Polaris guides a user from a business profile to a sent pitch. Two things make that guidance visible:

1. A **journey bar** at the top of every page showing seven milestones and real progress.
2. An **Intelligence** stage, where Polaris researches each shortlisted company, explains how well it fits, and recommends what to do. This is the product's differentiator and is branded "Polaris Intelligence" in marketing; in the app the milestone is labelled "Intelligence".

## 2. Non-negotiable rules

- **Real data only.** Every state, count, score and finding comes from database records. No placeholder numbers, no sample companies, no stored "done" or progress flags.
- **Nothing without a source.** Every research finding stores a source URL, the source's date where available, and the time it was retrieved. A finding without a source URL is not saved and not shown.
- **Unknown stays unknown.** If evidence for something is missing, say "No evidence found". Never guess or fill a gap.
- **Unbuilt means "Coming soon".** A milestone whose feature does not work end to end is labelled "Coming soon" and is not clickable.
- **Human decides.** Polaris recommends; the user accepts or overrides. No email, call or message leaves Polaris without approval.
- **Every AI and provider call is logged** with its cost in `provider_calls`.

## 3. The seven milestones

Define these once, in a single config list used by the journey bar and the Next action button. Each entry has: key, label, route, `built` (true or false), and the subtasks below.

| # | Label | What the user does | Status line (from real data) | Minimum before moving on |
|---|---|---|---|---|
| 1 | Profile | Describes the business or talent; adds sources and writing samples | "Complete" or "N fields missing" | Required profile fields filled |
| 2 | Ideal customer | Reviews and approves the ideal customer profile | "Approved" or "Draft" | An approved ideal customer profile exists |
| 3 | Discover | Finds candidate companies and shortlists the relevant ones | "N shortlisted" | At least one company shortlisted |
| 4 | Intelligence | Reviews each company's brief and decides: pursue, hold or skip | "N to review" or "N to pursue" | At least one company marked pursue |
| 5 | Contacts | Finds decision-makers for companies marked pursue | "N contacts" | At least one contact with an email |
| 6 | Pitch | Picks a concept, edits the pitch, approves it | "N to approve" or "N approved" | At least one approved pitch |
| 7 | Outreach | Sends approved pitches, logs calls and replies | "N sent, N replied" | None (last stage) |

Subtasks shown when a milestone is expanded:

1. **Profile:** business details; sources added; writing samples added.
2. **Ideal customer:** draft generated; reviewed; approved.
3. **Discover:** search run; candidates reviewed; companies shortlisted.
4. **Intelligence:** research complete; briefs reviewed; decisions made.
5. **Contacts:** role identified; contacts found; emails verified.
6. **Pitch:** concept chosen; pitch drafted; pitch approved.
7. **Outreach:** sent; follow-ups due; replies logged.

## 4. Journey bar

**Placement:** top of every signed-in page, directly below the header.

**Scope:** the currently selected profile. Switching profile re-renders the bar with that profile's data.

**Each milestone shows:**
- a state: complete, in progress, not started, or needs attention
- a marker: a tick icon when complete, otherwise the step number
- the label
- the live status line from the table in section 3

**Behaviour:**
- Clicking a built milestone navigates to its page.
- A separate small expand control opens that milestone's subtasks with their status. Navigating and expanding are different controls.
- A milestone with `built: false` shows "Coming soon", looks inactive, and is not clickable or expandable.
- The milestone for the page the user is on is visually marked as current.
- "Needs attention" is used when a later stage has work but an earlier requirement has been undone (for example the ideal customer profile was returned to draft), or when a provider call failed and needs a retry.

**Data:** one server-side function, `getJourneyStatus(profileId)`, returns the state, status line and subtask statuses for all seven milestones. It only reads the database. The Next action button uses the same function.

**Layout reference** (structure only; use the TiffanyAI palette, not these characters):

```
Profile: Northlight Media
 ✓ Profile    ✓ Ideal customer    3 Discover     4 Intelligence   5 Contacts   6 Pitch        7 Outreach
 Complete     Approved            18 shortlisted 6 to review      4 contacts   2 to approve   Not started
```

## 5. Next action button

At the bottom of every stage page, show:

- one line of plain text saying what to do in the next stage
- one primary button labelled `Next action ([next stage label])`

| On page | Button label | Line above the button |
|---|---|---|
| Profile | Next action (Ideal customer) | Review who Polaris thinks your best-fit customers are. |
| Ideal customer | Next action (Discover) | Find companies that match and shortlist the relevant ones. |
| Discover | Next action (Intelligence) | See how well each shortlisted company fits, and why. |
| Intelligence | Next action (Contacts) | Find the right people at the companies you chose to pursue. |
| Contacts | Next action (Pitch) | Choose a concept and shape the pitch. |
| Pitch | Next action (Outreach) | Send what you approved and track replies. |
| Outreach | View pipeline | See every prospect and what is due next. |

**Rules:**
- If the current stage's minimum (section 3) is not met, keep the button visible but, on click, show what is missing instead of navigating. Example: "Approve the ideal customer profile first."
- If the next stage has `built: false`, show the button inactive with the label `Next action ([stage label]) — coming soon`.
- The order comes from the shared milestone config. Do not hard-code it in pages.
- There is one primary button per page. Other actions on the page use the secondary style.

## 6. Per-prospect stage bar

On each company's detail page, show a smaller bar for that one prospect:

Researching → Ready to pitch → Contacted → Replied → Meeting booked

- Read the stage from the existing pipeline stage field on the prospect. Do not create a parallel field.
- "New lead" displays as not yet started. Won or Lost displays as an end label after the bar.
- Same accessibility rules as the journey bar.

## 7. The Intelligence stage

### 7.1 What it is for

Discover answers "which companies might fit?" with a quick relevance check. Intelligence answers "is this company worth pursuing, why, why now, and how?" with deeper research. It runs only on companies the user has shortlisted, so research cost stays proportional to real interest, and it runs before Contacts so contact credits are spent only on companies marked pursue.

Move any deep research and fit scoring currently planned inside Discover into this stage. Discover keeps only a light relevance summary.

### 7.2 Inputs

- The selected profile: positioning, services, audience, strengths, objectives.
- The approved ideal customer profile.
- The shortlisted company: name, domain, and anything Discover already saved.
- Apollo organization data, news and job postings where available.

### 7.3 Process

1. Runs as a background job per shortlisted company. Never block the page; show "Researching" with real status.
2. Research uses the `ResearchProvider` adapter (Claude web search). Read the pages found; do not rely on search snippets alone.
3. Save each finding as a `signals` row with its source URL, source date and retrieved time.
4. Produce the brief (7.4) as structured output that references signal IDs for every claim.
5. If research fails or finds too little, save the brief with status "Insufficient evidence" and say so on screen. Do not produce a score from thin evidence.
6. A brief older than 30 days shows its age and a "Refresh research" action. Refresh is user-triggered, never automatic.

### 7.4 The intelligence brief

One brief per prospect (a company within one profile's pipeline), shown on a single screen:

1. **Summary:** two or three sentences on who the company is and why it is or is not relevant to this profile.
2. **Fit score:** 0 to 100, with a band, built from the criteria in 7.5. Each criterion shows its rating, a one-line reason and its sources.
3. **Why now:** dated timing signals, such as a campaign, product launch, new market, relevant hire, funding or an existing sponsorship. Each has a source link and date. If there are none, say "No timing signals found".
4. **Risks and reasons against:** what could make this a poor fit, such as an exclusive partner already in place, a mismatch in audience, or recent cutbacks.
5. **Recommendation:** pursue, hold or skip, with a one-sentence reason and a suggested angle for the pitch.
6. **Who to approach:** the role or roles to target, with the reasoning. Roles only; named people come from the Contacts stage.
7. **Concept starters:** two or three partnership ideas tied to the evidence. These are passed to the Pitch stage as starting points.
8. **Sources:** the full list of sources with dates.

### 7.5 Fit score

The score must be explainable. Use five criteria, each rated 0 to 20 with a written reason and at least one source:

| Criterion | Question |
|---|---|
| Audience match | Does the company's target customer overlap with the profile's audience? |
| Category fit | Is the company in an industry or category the ideal customer profile names? |
| Partnership behaviour | Is there evidence it sponsors, advertises or partners in ways this profile could serve? |
| Timing | Are there recent signals that make outreach relevant now? |
| Practical fit | Do size, geography and budget signals suit the profile's offer? |

- A criterion with no evidence is rated "Unknown" and contributes 0. It is displayed as "Unknown", not as a low score, and the brief states how many criteria are unknown.
- If three or more criteria are unknown, show "Insufficient evidence" instead of a score.
- Bands: 70 and above "Strong fit"; 40 to 69 "Possible fit"; under 40 "Weak fit".
- Store the criteria, ratings, reasons and source references, not just the total.
- Keep the weights in one config so they can be tuned per profile type later. Do not build a tuning screen now.

### 7.6 The user's decision

- The brief shows Polaris's recommendation and three actions: Pursue, Hold, Skip.
- The user's choice is stored separately from the recommendation, with who decided and when. If it differs from the recommendation, ask for an optional short reason and store it.
- Only prospects with a user decision of pursue appear in the Contacts stage.
- Hold and Skip prospects stay visible in Intelligence under their own filters and can be changed later.
- Moving a prospect to pursue sets its pipeline stage to "Ready to pitch" only once it also has a contact; until then it stays "Researching".

### 7.7 Intelligence page layout

- **List view:** shortlisted companies for the selected profile with fit band, score, recommendation, the user's decision and brief age. Filters: To review, Pursue, Hold, Skip. Sort by score by default.
- **Brief view:** the eight sections in 7.4, the decision actions, and the per-prospect stage bar.
- **Empty state:** if nothing is shortlisted, explain that briefs appear once companies are shortlisted, with a button to Discover.
- **Status line for the journey bar:** "N to review" while any brief awaits a decision; otherwise "N to pursue".

### 7.8 Cost controls

- Research runs only for shortlisted companies, one job per company.
- Do not re-run research on page load. Only on shortlisting and on user-triggered refresh.
- Log tokens, searches and estimated cost per brief in `provider_calls`, and show the per-brief cost on an admin-only line.

## 8. Data model changes

Inspect the current schema first and adapt names to what exists. Proposed additions, all with `org_id` and row-level security like the other tables:

**New table `briefs`**
- prospect reference (one current brief per prospect; keep earlier versions)
- status: researching, ready, insufficient evidence, failed
- summary
- fit score (nullable), fit band (nullable)
- criteria: a list of criterion, rating or unknown, reason, signal references
- why now: a list of statement, signal reference
- risks: a list of statement, signal reference
- recommendation: pursue, hold or skip; recommendation reason; suggested angle
- target roles: a list of role, reason
- concept starters: a list of title, description, signal references
- researched at, model used, cost estimate

**Changes to `prospects`**
- shortlisted at
- decision: pursue, hold, skip or none; decided by; decided at; override reason

**Use of existing tables**
- `signals` holds every finding with its source URL, source date and retrieved time.
- `concepts` receives the concept starters when the user moves a prospect to Pitch.
- Existing `score` and `score reasons` on `prospects` are replaced by the brief's fit score and criteria. Do not keep two scores.

Do not add any column that stores journey progress.

## 9. Mobile (under 640px wide)

- The journey bar collapses to one line: "Step N of 7: [label]" with the status line beside it. Tapping expands the full list vertically.
- The Next action button is full width.
- The brief's sections stack in the order given in 7.4.

## 10. Accessibility

- Never signal state by colour alone. Use the tick icon, step numbers and a text status on every milestone, and a text band beside every score.
- Wrap the journey bar in `<nav aria-label="Progress">` with an ordered list. Mark the current page's milestone with `aria-current="step"`.
- All controls are reachable and operable by keyboard, with a visible focus ring.
- Source links have descriptive text (the page title or publisher), not "link".

## 11. Style and wording

- TiffanyAI palette: warm white background, light gold, magenta and soft sky-blue accents. Existing shadcn/ui components and Tailwind CSS. No new UI library.
- Sentence case for all labels and buttons.
- The milestone label is "Intelligence". The phrase "Polaris Intelligence" may appear as the page heading. Do not use "hyper" or similar words in the interface.
- Plain, specific wording. Say "No timing signals found", not a vague or promotional phrase.

## 12. Tests

- `getJourneyStatus`: a new empty profile; a profile with an approved ideal customer and no companies; a profile with prospects spread across several stages; a profile switched for another.
- Next action: shows the "missing" message when the stage minimum is not met; shows "coming soon" when the next stage is not built; the Outreach page shows "View pipeline".
- Milestone config: a milestone with `built: false` is not clickable and shows "Coming soon".
- Fit score: totals match the criteria; an unknown criterion contributes 0 and is labelled "Unknown"; three unknown criteria give "Insufficient evidence" and no score.
- Briefs: a finding without a source URL is rejected; a failed research job produces a "failed" status with a retry action, not an empty brief.
- Decisions: only pursue prospects appear in Contacts; an override stores who, when and the reason.
- Row-level security: a user in one organization cannot read another organization's briefs.

## 13. Build order

1. Milestone config, `getJourneyStatus` and the journey bar, with only the milestones that already work marked `built: true`.
2. Next action button on each existing stage page.
3. Per-prospect stage bar.
4. Schema changes for briefs and decisions, with row-level security.
5. Intelligence research job and brief generation behind the `ResearchProvider` adapter.
6. Intelligence list and brief pages, with decision actions.
7. Gate the Contacts stage on a pursue decision.
8. Mark Intelligence `built: true` only when a real company can go from shortlisted to a sourced brief to a stored decision.

## 14. When finished, report

- Which milestones are marked built and which are "Coming soon".
- Confirmation that no progress flags were added to the schema.
- The cost of one real brief, from `provider_calls`.
- Anything in this file that could not be built as written, and why.

## 15. Out of scope for this work

- A screen for tuning score weights.
- Automatic re-research on a schedule.
- Learning from reply outcomes to adjust scores (planned for later).
- Any change to sending, WhatsApp, calls or the approval gate.
