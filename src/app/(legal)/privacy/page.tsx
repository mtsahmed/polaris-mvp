import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { DraftNotice } from "../draft-notice";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `How ${brand.fullName} collects, uses and protects personal information.`,
  alternates: { canonical: "/privacy" },
};

// Based on the TiffanyAI privacy policy (app.tiffanyaisys.com/privacy-policy-23), extended for what
// Polaris does: AI research, contact data about business people, outreach drafts and usage logs.
// Owner review pending (19 November 2026); set DRAFT to false in ../draft-notice.tsx once approved.
export default function PrivacyPage() {
  const email = brand.contactEmail;
  return (
    <>
      <DraftNotice />
      <h1>Privacy policy</h1>
      <p className="text-sm! text-sidebar-foreground/70!">Last updated 19 November 2026</p>

      <p>
        This policy explains how {brand.legalName} (&ldquo;{brand.companyName}&rdquo;, &ldquo;we&rdquo;) handles
        personal information in {brand.fullName} (&ldquo;Polaris&rdquo;), our web app for B2B partnership and
        customer prospecting, and on this website. Questions: <a href={`mailto:${email}`}>{email}</a>.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your name, email address and password (stored only as a secure hash by
          our authentication provider), and the workspaces you belong to and your role in them.
        </li>
        <li>
          <strong>Workspace content you add:</strong> business or talent profiles, links, uploaded files, questionnaire
          answers, ideal customer profiles, notes, pitch drafts, approvals and the outreach you record (emails marked
          as sent, replies, calls, meetings).
        </li>
        <li>
          <strong>Business contact information about other people:</strong> to help you reach decision-makers,
          Polaris finds and stores names, job titles, business email addresses and phone numbers of people at
          companies you research. These come from public web pages (including the company&apos;s own website), from
          contact-data providers such as Apollo.io, or from you when you add a contact by hand. Each item keeps its
          source.
        </li>
        <li>
          <strong>Report requests:</strong> if you ask for the impact report on our landing page, your name, email,
          optional company and goal.
        </li>
        <li>
          <strong>Usage and technical data:</strong> a log of the AI and data-provider calls you start (what ran, when,
          and its cost), and standard server logs (such as IP address, browser type and time of request) kept by our
          hosting provider.
        </li>
      </ul>

      <h2>2. How we use it</h2>
      <ul>
        <li>To provide Polaris: sign you in, keep your workspace, research companies, score fit, find contacts and draft
          outreach for your approval.</li>
        <li>To send account emails, such as confirming your address and resetting your password.</li>
        <li>To show you and your workspace admins the usage and cost of the work you run.</li>
        <li>To reply to your questions and, if you asked for it, send the impact report.</li>
        <li>To keep the service secure, prevent abuse and fix problems.</li>
      </ul>
      <p>
        We do not sell personal information, and we do not use it for advertising. Polaris never sends a message on
        its own: a named person in your workspace approves each one, and you send it from your own email or phone.
      </p>

      <h2>3. AI processing</h2>
      <p>
        Polaris uses AI models from Anthropic (Claude) and, as a fallback, OpenAI to read sources, research companies
        and draft text. The content needed for each task, such as your profile, a company&apos;s public pages or a
        draft, is sent to the provider you or your workspace selected and processed under that provider&apos;s
        business API terms. AI output can be wrong; Polaris shows the source behind each finding so you can check it.
      </p>

      <h2>4. Service providers we share information with</h2>
      <p>We share information only with providers that run Polaris for us, under their data-processing terms:</p>
      <ul>
        <li>Supabase: database, sign-in and file storage.</li>
        <li>Vercel: hosting of the website and app.</li>
        <li>Anthropic and OpenAI: AI processing, as described above.</li>
        <li>Apollo.io: business contact lookups, when your workspace uses it.</li>
        <li>Hostinger: delivery of account emails from our mailbox.</li>
      </ul>
      <p>
        We may also disclose information if the law requires it, or to protect our rights, users or the public. If
        {" "}{brand.companyName} is involved in a merger or sale, information may transfer to the new owner under this
        policy.
      </p>

      <h2>5. Text messages</h2>
      <p>
        Polaris does not send SMS or WhatsApp messages. Message and call links in the app open your own phone or app,
        and you decide whether to use them.
      </p>

      <h2>6. Cookies and local storage</h2>
      <p>
        We use only cookies needed for the app to work: your sign-in session, the workspace and profile you have open,
        the AI model you picked and whether the sidebar is collapsed. The landing page remembers your light or dark
        choice in your browser&apos;s local storage. We do not use advertising or third-party tracking cookies.
      </p>

      <h2>7. How long we keep it</h2>
      <p>
        We keep workspace content until it is deleted. Owners and admins can delete a whole workspace at any time, and
        we can delete your account on request: workspaces only you belong to are deleted with everything in them, and
        your work in shared workspaces passes to that workspace&apos;s owner. Usage and cost records in shared
        workspaces are kept without your name so the workspace&apos;s totals stay correct. Report requests are kept
        until you ask us to remove them. Backups held by our providers expire on their own schedule.
      </p>

      <h2>8. Your rights</h2>
      <p>
        You can ask to see, correct, export or delete your personal information, or withdraw a consent you gave, by
        emailing <a href={`mailto:${email}`}>{email}</a>. If Polaris holds your business contact details because a user
        researched your company, you can ask us to remove them in the same way.
      </p>

      <h2>9. Security</h2>
      <p>
        Data is encrypted in transit (HTTPS), each workspace&apos;s data is separated by database access rules so
        members see only their own workspaces, and access to administrative tools is limited. No system is perfectly
        secure, so we cannot guarantee absolute security; if a breach affects you, we will tell you as the law
        requires.
      </p>

      <h2>10. Where data is processed</h2>
      <p>
        {brand.legalName} is based in Texas, United States, and our providers process data mainly in the United States.
        If you use Polaris from elsewhere, your information is transferred to and processed in the United States.
      </p>

      <h2>11. Children</h2>
      <p>Polaris is a business tool for people aged 18 and over. We do not knowingly collect information from children.</p>

      <h2>12. Changes</h2>
      <p>
        We will post any change to this policy on this page with a new date, and tell account holders by email about
        significant changes.
      </p>

      <h2>13. Contact</h2>
      <p>
        {brand.legalName}, Texas, United States. Email <a href={`mailto:${email}`}>{email}</a> or visit{" "}
        <a href={brand.website}>{brand.website.replace(/^https?:\/\//, "")}</a>.
      </p>
    </>
  );
}
