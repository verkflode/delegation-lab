import type { ReactNode } from "react";
import { DM_Serif_Display, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./v5.css";

// VAOM v5 type: next/font self-hosts the files at build time, so visitors never call Google.
const serif = DM_Serif_Display({ subsets: ["latin", "latin-ext"], weight: "400", variable: "--font-v5-serif" });
const sans = Plus_Jakarta_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-v5-sans" });
const mono = JetBrains_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-v5-mono" });

export const metadata = { title: "Delegation Lab v5 spike" };

export default function SpikeLayout({ children }: { children: ReactNode }) {
  return <div className={`v5 ${serif.variable} ${sans.variable} ${mono.variable}`}>{children}</div>;
}
