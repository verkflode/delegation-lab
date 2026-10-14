import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// VAOM v5 type. next/font self-hosts the files at build time, so visitors never call Google.
const sans = Plus_Jakarta_Sans({ variable: "--font-v5-sans", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700", "800"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-v5-mono", subsets: ["latin", "latin-ext"], weight: ["400", "500", "700"], display: "swap" });
const serif = DM_Serif_Display({ variable: "--font-v5-serif", subsets: ["latin", "latin-ext"], weight: "400", display: "swap" });

export const metadata: Metadata = {
  title: "Delegation Lab — A VAOM Simulation",
  description:
    "Take the helm as Head of AI Operations. Design the delegation policy, run the simulation, and discover the Verkflöde Agent Operating Model by play.",
  metadataBase: new URL("https://verkflode.eu"),
  openGraph: {
    title: "Delegation Lab — A VAOM Simulation",
    description:
      "A flight simulator for AI governance. Three rounds. One delegation philosophy. By Verkflöde.",
    url: "https://verkflode.eu",
    siteName: "Verkflöde Delegation Lab",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Delegation Lab — A VAOM Simulation",
    description:
      "A flight simulator for AI governance. Three rounds. One delegation philosophy.",
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
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
      <body className="min-h-full">{children}</body>
    </html>
  );
}
