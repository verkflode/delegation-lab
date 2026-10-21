import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// VAOM v5 type. next/font self-hosts the files at build time, so visitors never call Google.
const sans = Plus_Jakarta_Sans({ variable: "--font-v5-sans", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700", "800"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-v5-mono", subsets: ["latin", "latin-ext"], weight: ["400", "500", "700"], display: "swap" });
const serif = DM_Serif_Display({ variable: "--font-v5-serif", subsets: ["latin", "latin-ext"], weight: "400", display: "swap" });

export const metadata: Metadata = {
  title: "Delegation Lab: the Verkflöde Agent Operating Model (VAOM) by play",
  description:
    "Take the helm as Head of AI Operations. Write the delegation matrix, run the workflow under the VAOM Guardian, and learn the Verkflöde Agent Operating Model (VAOM), Verkflöde's open framework for AI delegation, by play.",
  metadataBase: new URL("https://lab.vaom.ai"),
  openGraph: {
    title: "Delegation Lab: the Verkflöde Agent Operating Model (VAOM) by play",
    description:
      "A flight simulator for AI governance, built on the Verkflöde Agent Operating Model (VAOM). Four rounds. One delegation design.",
    url: "https://lab.vaom.ai",
    siteName: "Verkflöde Delegation Lab",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Delegation Lab: the Verkflöde Agent Operating Model (VAOM) by play",
    description:
      "A flight simulator for AI governance, built on the Verkflöde Agent Operating Model (VAOM). Four rounds.",
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

// Ties the Lab to the framework's canonical entity on vaom.ai (the same @ids as that site's structured data),
// so search engines and assistants read "VAOM" here as the Verkflöde Agent Operating Model.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "@id": "https://lab.vaom.ai/#lab",
  name: "Delegation Lab",
  url: "https://lab.vaom.ai",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Any (web browser)",
  inLanguage: "en",
  isAccessibleForFree: true,
  description: "A browser simulation that teaches the Verkflöde Agent Operating Model (VAOM) by play: the player writes a delegation matrix and every agent decision is made by the VAOM Guardian.",
  about: { "@type": "TechArticle", "@id": "https://vaom.ai/#vaom", name: "The Verkflöde Agent Operating Model (VAOM)", url: "https://vaom.ai", sameAs: ["https://verkflode.com/vaom"] },
  publisher: { "@type": "Organization", "@id": "https://verkflode.com/#org", name: "Verkflöde AB", url: "https://verkflode.com" },
};

export const viewport: Viewport = {
  themeColor: "#F7F5F0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} ${serif.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }} />
        {children}
      </body>
    </html>
  );
}
