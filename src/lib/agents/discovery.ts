import { brand } from "@/config/brand";
import { seo, siteUrl } from "@/config/seo";

// Files for AI agents and agent registries (docs/seo-plan.md; Lighthouse "Agentic Browsing").

// llms.txt (llmstxt.org): H1, blockquote summary, then H2 sections of markdown links.
export function llmsTxt(): string {
  return `# ${brand.fullName}

> ${seo.description}

Polaris turns a business or talent profile into an ideal customer profile, discovers companies that fit, researches each one with cited sources, finds decision-makers and drafts outreach that a person approves before it is sent. The app itself is behind sign-in; the pages below are public.

## Pages

- [Home](${siteUrl}/): What Polaris does, the step-by-step route map and a pipeline impact calculator
- [How Polaris works](${siteUrl}/how-it-works.html): Interactive route map from sign-up to a booked meeting
- [Sign in or create an account](${siteUrl}/login)

## Legal

- [Privacy policy](${siteUrl}/privacy)
- [Terms of service](${siteUrl}/terms)

## Company

- [${brand.companyName}](${brand.website}): Corporate website of ${brand.legalName}
- [Contact](mailto:${brand.contactEmail})
`;
}

// Agentic Resource Discovery manifest (ARD, ai-catalog schema 1.0). Polaris has no MCP server or
// public API yet, so the one entry is the llms.txt guide.
export function agentCatalog() {
  const host = new URL(siteUrl).hostname;
  return {
    specVersion: "1.0",
    host: {
      displayName: brand.legalName,
      documentationUrl: `${siteUrl}/llms.txt`,
    },
    entries: [
      {
        identifier: `urn:air:${host}:docs:llms-txt`,
        displayName: `${brand.fullName} guide for AI agents`,
        type: "text/markdown",
        url: `${siteUrl}/llms.txt`,
        description: seo.description,
      },
    ],
  };
}
