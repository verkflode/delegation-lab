import type { Metadata, Viewport } from "next";
import { DM_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

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
  themeColor: "#0D1B2A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
