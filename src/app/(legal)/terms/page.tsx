import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";
import { DraftNotice } from "../draft-notice";

export const metadata: Metadata = {
  title: "Terms of service",
  description: `The terms for using ${brand.fullName}.`,
  alternates: { canonical: "/terms" },
};

// Written 19 November 2026 for the owner's review (End to end Review, item 5). Not legal advice;
// have a lawyer check it before relying on it. Set DRAFT to false in ../draft-notice.tsx once approved.
export default function TermsPage() {
  const email = brand.contactEmail;
  return (
    <>
      <DraftNotice />
      <h1>Terms of service</h1>
      <p className="text-sm! text-sidebar-foreground/70!">Last updated 19 November 2026</p>

      <p>
        These terms are an agreement between you and {brand.legalName} (&ldquo;{brand.companyName}&rdquo;,
        &ldquo;we&rdquo;) for the use of {brand.fullName} (&ldquo;Polaris&rdquo;). If you use Polaris for a company,
        you accept these terms for that company and confirm you may do so. If you do not agree, do not use Polaris.
      </p>

      <h2>1. Your account</h2>
      <ul>
        <li>You must be at least 18 and give accurate details when you sign up.</li>
        <li>Keep your password safe. You are responsible for what happens under your account; tell us at once at{" "}
          <a href={`mailto:${email}`}>{email}</a> if you think someone else has used it.</li>
        <li>Workspace owners and admins control who belongs to their workspace and can delete it.</li>
      </ul>

      <h2>2. What Polaris does</h2>
      <p>
        Polaris helps you build a business profile and ideal customer profile, discover and research companies, find
        business contacts, draft pitch concepts and outreach, and track your pipeline. Polaris recommends; you decide.
        Polaris does not send messages itself: every email, call or message is approved by a person in your workspace
        and sent by you.
      </p>

      <h2>3. Acceptable use</h2>
      <p>You agree not to use Polaris to:</p>
      <ul>
        <li>send spam or outreach that breaks the law, including anti-spam, telemarketing and privacy laws such as
          CAN-SPAM, the Telephone Consumer Protection Act and state equivalents;</li>
        <li>harass, deceive or impersonate anyone, or misuse personal information about the people you research;</li>
        <li>break the law, infringe others&apos; rights, or upload content you have no right to use;</li>
        <li>interfere with, probe or overload Polaris, get around its limits, or access other workspaces;</li>
        <li>resell Polaris or copy it to build a competing product.</li>
      </ul>
      <p>
        You are responsible for the outreach you send and for having a lawful basis to contact the people you reach,
        including honouring opt-out requests.
      </p>

      <h2>4. AI output and third-party data</h2>
      <p>
        Polaris uses AI models and public and third-party sources. Research, scores, contact details and drafts can be
        incomplete, out of date or wrong. Polaris shows the source behind each finding and marks unconfirmed details;
        check anything important before you rely on it or send it. Contact data from providers such as Apollo.io is
        subject to those providers&apos; terms.
      </p>

      <h2>5. Your content</h2>
      <p>
        You keep ownership of what you put into Polaris and of the drafts it produces for you. You give us permission
        to store and process your content only to run Polaris for you, as described in our{" "}
        <Link href="/privacy">Privacy policy</Link>. You confirm you have the right to upload what you add.
      </p>

      <h2>6. Our service</h2>
      <p>
        Polaris, its software, design and brand belong to {brand.companyName}. We give you a limited, non-transferable
        right to use it under these terms. Polaris is in active development: features may change, and we may
        suspend parts of it for maintenance. Ideas you send us may be used to improve Polaris without obligation to
        you.
      </p>

      <h2>7. Fees</h2>
      <p>
        Polaris is offered without charge during its early-access period. If we introduce paid plans, we will show the
        prices and terms before you are charged, and you can choose not to continue.
      </p>

      <h2>8. Suspension and ending</h2>
      <p>
        You can stop using Polaris at any time and ask us to delete your account. We may suspend or end access if you
        break these terms or the law, or if needed to protect Polaris or others; where reasonable we will tell you
        first. Sections that by their nature should continue (such as 9 to 11) survive.
      </p>

      <h2>9. Disclaimer</h2>
      <p>
        Polaris is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. To the extent the law allows, we make
        no warranties, express or implied, including of merchantability, fitness for a purpose, accuracy or
        uninterrupted service, and we do not promise any business result such as replies, meetings or revenue.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the extent the law allows, {brand.companyName} is not liable for indirect, incidental, special,
        consequential or punitive damages, or for lost profits, revenue, data or goodwill. Our total liability for any
        claim about Polaris is limited to the greater of the amount you paid us in the 12 months before the claim and
        US$100.
      </p>

      <h2>11. Indemnity</h2>
      <p>
        You will defend and compensate {brand.companyName} against claims arising from your content, your outreach or
        your breach of these terms or the law.
      </p>

      <h2>12. Governing law</h2>
      <p>
        These terms are governed by the laws of the State of Texas, United States, without regard to its conflict-of-law
        rules. Disputes will be heard in the state or federal courts located in Texas, and both parties consent to
        their jurisdiction.
      </p>

      <h2>13. Changes</h2>
      <p>
        We may update these terms. We will post the new version here with a new date and tell account holders by email
        about significant changes. Continuing to use Polaris after a change means you accept it.
      </p>

      <h2>14. Contact</h2>
      <p>
        {brand.legalName}, Texas, United States. Email <a href={`mailto:${email}`}>{email}</a>.
      </p>
    </>
  );
}
