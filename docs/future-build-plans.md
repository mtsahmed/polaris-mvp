# Polaris future build plans

Ideas the owner wants to remember for later builds. Nothing here is scheduled yet; when an item is
picked up, move it into the roadmap (`docs/polaris-mvp-roadmap.md`) or its own plan.

## Business impact calculator (landing page)

Recorded 17 November 2026. The calculator is `src/components/impact-calculator.tsx`, its maths
`src/lib/impact/model.ts`.

- **"Use my real numbers":** for signed-in users, fill in the reply and meeting rates from their
  actual Outreach results.
- **Presets by business type** (agency, creator, B2B services), once each has real figures.
- **A one-page PDF of the scenario,** to take into investor or client meetings.
  *Built 17 November 2026* as the landing-page lead magnet (`src/components/impact-report-form.tsx`,
  `src/lib/impact/report-pdf.ts`, `/api/impact-report`); needs migration
  `20261125000000_impact_leads.sql` run in the SQL Editor.
- **An "Open Polaris with these numbers" button** that carries the scenario into sign-up.

## Impact report leads

- **A Leads page inside Polaris** for app admins, listing report requests, with a CSV export.
- **Email the PDF to the visitor** through the Hostinger SMTP setup, which also confirms the
  address is real.
- **A short privacy notice** linked from the report form before launch, since it collects emails.
