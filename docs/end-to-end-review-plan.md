# Plan: changes from the end-to-end review

Source: `docs/End to end Review.md` (owner's review, 17 November 2026). Status: **batches 1, 3 and 4 built and checked by the owner (17 Nov 2026); batch 2 in progress.** Owner follow-ups also built: logo links to the landing page, Discovery inner scroll hands over to the page, Shortlisted and Other contacts rows collapse, Dashboard link under Workspace with #527AF8 stage headings.
Nine points (point 9 dropped), grouped into four batches so each can be checked in the browser before the next.

## Batch 1: step-by-step flow and quick layout fixes

**1. Profile tabs go one step at a time (review point 1).**
Today every profile tab except Ideal customer ends with "Next action (Ideal customer)", so Sources and
Insights get skipped. Change: inside a profile the button follows the tabs in order.

| Tab | Button at the bottom |
|---|---|
| Profile | Next action (Sources) |
| Sources | Next action (Insights) |
| Insights | Next action (Ideal customer) |
| Ideal customer | Next action (Discover), as today |

The journey bar keeps its seven milestones; only the bottom button changes. If a tab's minimum is not
met (for example no source added), the button still says what is missing, as it does now.
Files: `src/app/(app)/profiles/[id]/page.tsx`, a small tab-order helper with a unit test.

**3. Shorter Discovery blocks (point 3).**
"Find companies", "What the search uses" and "Suggestions" get a fixed maximum height and scroll inside
the block, so the page itself stays short. Shortlisted stays as it is. File: `discovery/page.tsx`.

**6. Outreach cards collapsed by default (point 6).**
Each company becomes a one-line row: company name, stage, and the next thing to do or what is due
("Follow-up due Nov 20", "Mark first email as sent"). A down arrow opens the full card. Native
`<details>`, so it needs no extra code and works with the keyboard. File: `outreach/page.tsx`.

**8. Logging a reply is easy to find (point 8).**
Logging already exists, but it is hidden in the collapsed "Log a reply, call or meeting" section at the
bottom of each Outreach card. Logging "Reply received" there already moves the company to Replied and
clears the follow-up reminder. Change: once the first email is sent, the card shows a visible
**Mark as replied** button (one click, today's date, optional note), and the full log stays below for
calls, meetings and bounces. The collapsed row from point 6 also shows "Replied" once logged.

## Batch 2: the rotating Polaris star, everywhere work runs (points 2 and 5, second part)

- **New component `PolarisWorking`:** the Polaris star from the logo, slowly rotating, plus one line
  saying what is happening ("Finding companies…", "Writing the email…"). It respects the system's
  reduce-motion setting (the star pulses instead of spinning).
- **Used on every AI or background step:** draft profile insights, draft ICP, Find companies,
  Intelligence research and re-score, contact search, draft concepts, write emails. Inside the button
  while the request runs, and as a larger panel where the page waits for background work (Intelligence
  "Researching", contact search in progress).
- **The Intelligence "Researching since…" line** becomes the agreed side-note style: italic, grey,
  1px smaller (13px), next to the rotating star.
- **Site-wide rule** added to `docs/design-guide.md`: any wait on Polaris's own work shows the rotating
  star and says what is happening. Plain saves keep their short "Saving…" label.

## Batch 3: un-shortlist, and Contacts focused on one company (points 4 and 5)

**4. Move a company back from Shortlisted to Suggestions.**
A small icon next to the company name in Shortlisted (hover text "Back to suggestions"), with the
usual confirm step. It sets the company back to a suggestion, so it leaves Intelligence and the
journey counts. Saved research is kept, so shortlisting again later costs nothing.
Rule: if the company is already marked Pursue, has contacts or has a sent email, the icon is not shown
and the hover text says why, so outreach history is never orphaned.

**5. Contacts shows the company you are pursuing.**
"Next action (Contacts)" on a company's Intelligence brief opens `/contacts?company=<id>`. That company
is shown on its own at the top. Every other pursued company moves into a collapsed block below:

> **Other contacts** ▾
> *Contacts of previously contacted companies*

Opening Contacts from the sidebar with no company chosen shows the most recently pursued company on
top, with the rest in Other contacts. File: `contacts/page.tsx`, plus the brief page's Next action
link (`intelligence/[id]/page.tsx`, `lib/journey`).

## Batch 4: Pipeline becomes Dashboard (point 7)

- Renamed **Dashboard** everywhere: sidebar, journey "View pipeline" button, page title. `/pipeline`
  redirects to the new `/dashboard`, so old links still work.
- **Two rows of four blocks:** New lead, Researching, Ready to pitch, Contacted on top; Replied,
  Meeting booked, Won, Lost below. No sideways scrolling.
- **Each block:** the stage name, the total number of companies as a large whole number, then up to
  five most recently updated companies by name, each with its next due date if any. "View all (12)"
  opens the full list for that stage when there are more than five.
- **Smaller, calmer type** (14px names, 13px details) and tighter spacing, in the style of the
  GoHighLevel pipeline dashboard. Moving a company between stages stays in the full list and on
  Outreach, so the blocks stay readable.
- A one-line summary above the blocks keeps "N follow-ups due today".

## Checks for every batch

`npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, then a look in Chrome. One commit per
batch. No database migration is needed (un-shortlisting uses the existing `status` and
`shortlisted_at` columns).

## Owner decisions (17 November 2026)

- **Mindmap (point 9):** dropped; the existing route map already covers it.
- **Un-shortlist (point 4):** blocked once a company is Pursue, has contacts or has a sent email.
- **Dashboard (point 7):** no drag-and-drop; stages are moved on the full list and on Outreach.
