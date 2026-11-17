# Polaris design guide

Rules for keeping the Polaris by TiffanyAI interface consistent. Colours and gradients are
defined once in `src/app/globals.css`; use the tokens and classes below, never hard-coded hex
values in components.

## Buttons

Three levels, chosen by how much the action matters on that screen. All buttons are pills
(`rounded-full`) and come from `src/components/ui/button.tsx` (`<Button>`, `buttonVariants()`
on a `<Link>`, or `<SubmitButton>` from `src/components/action-form.tsx` inside forms).

| Level | Variant | Look | Use for | Examples |
|---|---|---|---|---|
| Primary | `default` (alias `brand`) | Solid brand gradient (`bg-brand-gradient-button`), dark ink text, pink shadow | The one main next step on a screen or card, usually the first run of a step | Start research, Draft concepts, Write email, Approve, New pitch |
| Secondary | `gradient-outline` | 2px brand-gradient border, card-coloured fill, foreground text, magenta icons, light pink tint on hover | Actions that matter but are not the next step: re-running a step, saving, choosing, copying | Refresh research, Redraft concepts, Rewrite both, Save notes, Save edits, Use this concept, Copy approved email |
| Quiet | `ghost` or `link` | No border or fill | Small in-place actions inside a form or card | Save changes inside a concept card |

Other variants:

- `outline` (plain grey border): only for neutral utility controls that should not draw the eye. Do not use it for a step's actions, because it reads as disabled.
- `destructive`: deleting or removing. Deletes go through `ConfirmSubmit` so the user confirms first.

Rules:

- One primary (gradient) button per page: the Next action button at the bottom, which moves the user to the next journey milestone. Actions inside the page use `gradient-outline`.
- One primary button per card or step. When a step already has content, its action button turns from `default` to `gradient-outline`. For example, Draft concepts becomes Redraft concepts: `variant={concepts?.length ? "gradient-outline" : "default"}`.
- Button labels fit on one line: a verb plus at most two words.
- Icons come from `lucide-react` and sit before the label. In `gradient-outline` buttons they turn magenta automatically.
- The gradient outline is the `.gradient-outline` class in `globals.css`. It uses two background layers (fill clipped to the padding box, gradient to the border box). Do not rename it to anything starting with `border-`: the class merger (`tailwind-merge`) then treats it as a border colour and drops the transparent border, so a grey border shows instead of the gradient.

## Text styles

| Element | Style | Example |
|---|---|---|
| Kicker above a heading | `.kicker` (mono, uppercase, brand colour, wide tracking) | STEP 1, PITCH FOR REALWORK LABS |
| Side note, metadata or timing hint | `text-[13px] italic text-muted-foreground/75` | "Researched Nov 13 … with GPT 6.1 Sol", "Send 3–5 business days after the first email if there is no reply." |
| Field hint | `Field` component `hint` (`text-sm text-muted-foreground`) | Hints under form fields |
| Label that introduces a group of tags | `text-sm font-semibold text-emerald-700 dark:text-emerald-400` | "Pitch concept tags:" |
| Highlighted phrase | `.text-gradient` | Hero headlines only, one phrase at a time |

## Tags and badges

- Deal type on a concept: solid brand badge (`bg-brand font-semibold text-white dark:text-brand-ink`, `h-7 px-3 text-sm`), followed by the angle as an outlined brand badge (`border-brand/40 text-brand`). Both sit after the green "Pitch concept tags:" label.
- Research signal labels (R1, R2…): `bg-brand/10 font-mono text-brand`.
- Signal type, stage and location: `outline` or `secondary` badges.

## AI research text

- Source links are always smaller than the text around them: `SourceChip` uses 11px text (`text-[11px] leading-4`) and a 14px site icon, wherever it appears. Do not override its size; if a page needs a source link, use `SourceChip` (or `RichText`) rather than a styled `<a>`.
- Citations render as `SourceChip` (the site's own favicon plus its host, linking out, full URL on hover), never as raw URLs or markdown links.
- People's names render as `PersonName`: semibold on a soft gold highlight (`bg-gold/25`). Names stand apart from links (magenta) and from body text.
- Use the `RichText` component for any AI text that may contain citations or `**Name**` markers.

## Layout

- Cards in a row use the full width: size the grid to the number of items (two items give two equal columns, three give three on wide screens), so no empty column is left.
- Step cards: kicker, icon, title, then a description at full width with no `max-w` limit.
- Open questions and unverified items sit in a dashed-border panel and are labelled as not facts.

## Data tables

Agreed 16 November 2026 on the Contacts table (`src/app/(app)/contacts/page.tsx`).

- Thin, light grid lines between rows and columns (`border-border/40`), a light header row (`bg-muted/30`) and a rounded outer border (`border-border/60`).
- Email addresses are `mailto:` links in blue (`text-blue-600 dark:text-blue-400`, underline on hover). This is the one place links are blue instead of magenta.
- Sources in a dense table are an info icon (`Info`, 16px). Hover shows the source and its full link; clicking opens the page. This replaces `SourceChip` inside tables only.
- Row actions are icon-only (`Trash2` for delete) with a hover title and screen-reader text. Delete still asks for confirmation (`ConfirmSubmit`).
- Empty cells show a muted dash.

## Polaris is working

Agreed 17 November 2026 (owner review). Site-wide rule: whenever Polaris does its own work in the
background or makes the user wait (research, finding companies or contacts, drafting, scoring,
writing emails), show the rotating Polaris star and say in one line what is happening. Components
are in `src/components/polaris-working.tsx`.

- **Buttons:** `<SubmitButton working pendingLabel="Finding companies…">`. While the request runs the
  star spins before the label. Plain saves, approvals and deletes keep their short "Saving…" label
  without the star.
- **Long waits inside a form** (about a minute or more): add `<PolarisWorkingWhilePending>` with one
  sentence on what Polaris is doing and how long it takes. It shows only while the form is submitting.
- **Background work the page waits for** (Intelligence research, contact search): `<PolarisWorking panel>`,
  a dashed brand-tinted panel with a larger star. The text uses the side-note style (13px, italic, grey)
  and says when it started, how long it usually takes and that the page updates by itself.
- **In a list** (a company still researching): `<SpinningStar />` before the status word.
- The star rotates once every 2.4 seconds. With the system's reduce-motion setting it pulses instead
  (`.polaris-spin` in `globals.css`).
