import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { brand } from "@/config/brand";
import { seo, siteUrl } from "@/config/seo";
import "./globals.css";

// TiffanyAI brand type: Space Grotesk headings, Inter body, JetBrains Mono labels.
const sans = Inter({ variable: "--font-brand-sans", subsets: ["latin"] });
const display = Space_Grotesk({ variable: "--font-brand-display", subsets: ["latin"], weight: ["500", "600", "700"] });
const mono = JetBrains_Mono({ variable: "--font-brand-mono", subsets: ["latin"] });

// Site-wide search and sharing defaults (docs/seo-plan.md). Pages behind sign-in override robots
// with noindex in src/app/(app)/layout.tsx.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: seo.title, template: `%s · ${brand.productName}` },
  description: seo.description,
  applicationName: brand.fullName,
  keywords: [...seo.keywords],
  authors: [{ name: brand.companyName, url: brand.website }],
  creator: brand.companyName,
  publisher: brand.companyName,
  category: "business",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: brand.fullName,
    title: seo.title,
    description: seo.description,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: seo.title, description: seo.description },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
  formatDetection: { telephone: false, email: false, address: false },
  // Favicons from scripts/favicons/make-favicons.mjs: a light and a dark version, picked by the
  // browser's colour scheme. src/app/favicon.ico is added by Next.js. The Apple icon is declared
  // here, because Next.js drops a file-based apple-icon once the layout lists its own icons.
  icons: {
    icon: [
      { url: "/icons/favicon-light.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
      { url: "/icons/favicon-dark.svg", type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
      { url: "/icons/favicon-light-32.png", type: "image/png", sizes: "32x32", media: "(prefers-color-scheme: light)" },
      { url: "/icons/favicon-dark-32.png", type: "image/png", sizes: "32x32", media: "(prefers-color-scheme: dark)" },
    ],
    apple: [{ url: "/icons/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${display.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        {/* Full-strength TiffanyAI brand gradient for section icons.
            userSpaceOnUse in the icons' 24x24 grid, so straight lines are painted too. */}
        <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute">
          <defs>
            <linearGradient id="brand-icon-gradient" gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="22" y2="22">
              <stop offset="0%" stopColor="#c4006a" />
              <stop offset="58%" stopColor="#ff7a3d" />
              <stop offset="100%" stopColor="#ffd700" />
            </linearGradient>
          </defs>
        </svg>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
