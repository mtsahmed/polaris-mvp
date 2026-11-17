# Polaris fit scoring plan

Agreed with the owner on 16 November 2026. Replaces the single-lens fit score in spec section 7.5 (`docs/polaris-journey-and-intelligence-spec.md`) once Phase 1 ships. Phase 1 is approved for build now; Phases 2 and 3 follow the first end-to-end outreach run.

In short: keep one fit score, but score each company against the kind of deal being pursued; show "why now" and "can we reach them" beside it rather than mixed in; turn the three into an A / B / C priority that says who to pitch this week; and check the tiers against real reply rates.

## 1. What is wrong with the current score

| Problem | Effect | Seen on |
|---|---|---|
| One partner-flavoured set of criteria ("Partnership behaviour") for every company | Good customer targets score Weak | Natura for RealWork Labs: 33 "Weak fit", yet the AI recommended Pursue |
| Unknown counts as 0 | Missing research looks like a bad fit | Thinly covered companies |
| 0–20 ratings with no anchors | The same evidence gets 8 in one run and 14 in another | Run-to-run noise |
| Fit, timing and practicality blended into one number | A perfect fit with no trigger looks like an average company in the news | List sorting |
| No hard disqualifiers | Wrong country, competitors or companies with an exclusive partner can still score "Possible" | Wasted contact searches |
| Score and recommendation decided separately | They can contradict each other | Natura |

## 2. How B2B prospecting teams work in practice

Outbound teams that perform well separate three questions and act on the combination:

1. **Fit:** would this company plausibly buy from or partner with us?
2. **Timing (why now):** is there a current trigger such as funding, hiring, a launch, a new executive, expansion or a campaign?
3. **Access:** can we reach a real decision-maker?

They work in tiers rather than exact numbers, use a few hard disqualifiers, and re-tune once replies come in. That matches Polaris's success metric: replies and meetings per 20 pitches.

## 3. Design

### 3.1 Deal goal per brief
Every brief is scored for one goal: **Customer, Partner, Referral or Co-marketing** (the deal types pitch concepts already use). **The AI suggests the goal** from the research and the ICP (owner's choice, 16 November 2026); the user can change it, which re-scores from the saved findings at no research cost.

### 3.2 Criteria per goal

| Customer | Partner, Co-marketing, Referral |
|---|---|
| Problem match: do they have the problem the profile solves? | Audience overlap |
| Category / industry in the ICP | Complementary offer (not a competitor) |
| Size and budget signals | Partnership or sponsorship track record |
| Geography and practicality | Brand and values fit |
| A buyer role exists (for example marketing head, operations lead) | Practical fit (size, geography) |

### 3.3 Anchored ratings
Each criterion is rated on five levels, 0 none, 5 weak, 10 some, 15 strong, 20 exact, with a written anchor per level and criterion in the prompt. This stays compatible with the existing 0–20 data.

### 3.4 Unknown no longer drags the score down
The score is computed over known criteria only and shown with its coverage: "Fit 72 · based on 4 of 5 criteria". Two or fewer known criteria give "Insufficient evidence". With exactly three known, the band is capped at "Possible".

### 3.5 Knockouts
Hard rules set on the ICP: excluded geographies, competitors, minimum size, and (Partner goal only) an existing exclusive partner. Any hit gives **"Not a fit: reason, with source"** whatever the score, so contact credits are not spent on dead ends. The fields start empty; the owner fills them per ICP.

### 3.6 Timing and Access (Phase 2)
- **Timing:** Hot (trigger in the last 90 days), Warm (6 months) or None, from dated findings the research already saves.
- **Access:** Good (named decision-maker with a confirmed email), Partial (only a general inbox or office line) or None, computed from Contacts with no AI cost.

### 3.7 Priority tier and recommendation

| Tier | Rule | Means |
|---|---|---|
| A | Strong fit + Hot or Warm timing | Pitch this week |
| B | Strong fit with no timing, or Possible fit + Hot timing | Pitch soon, watch for a trigger |
| C | Possible fit, no timing | Hold |
| Not a fit | Knockout or Weak fit | Skip |

In Phase 1 (before Timing exists) the recommendation follows fixed rules from fit and knockouts alone: knockout or Weak → skip; Strong → pursue; Possible → hold unless the brief's timing section names a current trigger, then pursue; Insufficient evidence → hold. The AI writes the reason and pitch angle; the user still decides and overrides keep their optional reason.

### 3.8 Learning from results (Phase 3)
After about 40 sent pitches, a small report shows reply and meeting rates by tier, goal and fit band. If A does not beat B, weights in `src/lib/intelligence/fit.ts` are adjusted by hand. No automatic learning (spec section 10).

## 4. Phases

| Phase | Scope | Size | Status |
|---|---|---|---|
| 1. Fix the score | Goal per brief (AI suggests), criteria per goal, anchored ratings, coverage-based scoring, knockouts on the ICP, rule-based recommendation, change goal / re-score from saved findings | 1–2 days | Approved 16 November 2026 |
| 2. Priority tiers | Timing and Access badges, A/B/C tier, Intelligence, Contacts and Outreach sorted by tier | about 1 day | After the first end-to-end outreach run |
| 3. Calibrate | Replies and meetings per tier report, weight tuning | about half a day | After about 40 pitches sent |
| Later | Separate ICPs per goal | Only if one ICP with goal tags proves too blunt | Not planned |

## 5. Open points

- Knockout values for RealWork Labs (excluded countries, competitors, minimum size): to be entered by the owner on the ICP.
- Re-scoring existing briefs: available as a button once Phase 1 ships; the owner runs it.
