import type { Metadata } from "next";
import Link from "next/link";
import { OptOut } from "./OptOut";

export const metadata: Metadata = {
  title: "Privacy · Delegation Lab",
  description: "What the Delegation Lab collects (anonymous visit statistics, no cookies), what it sends to its AI model (nothing about you), and where it runs.",
  alternates: { canonical: "/privacy" },
};

// Keep this page true to the code and the server: lib/analytics.ts and app/layout.tsx (what's counted),
// lib/v5/prompts.ts (what the model is sent), infra's compose.yaml and Caddyfile (where it all runs).
// Change the date below whenever the substance changes.
const UPDATED = "25 October 2026";

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="font-serif text-[24px] text-mint leading-tight mt-10 mb-3">{children}</h2>;
}

export default function Privacy() {
  return (
    <main className="min-h-screen px-6 py-16">
      <article className="mx-auto w-full max-w-2xl text-[15px] leading-[1.75] text-muted [&_p]:mt-3 [&_li]:mt-1.5 [&_a]:text-cyan [&_a]:underline [&_strong]:text-ink">
        <Link href="/" className="font-mono text-[11px] uppercase tracking-[0.2em] text-cyan font-bold no-underline">
          ← Delegation Lab
        </Link>
        <h1 className="font-serif text-[40px] md:text-[48px] leading-[1.05] tracking-tight text-mint mt-6">Privacy</h1>
        <p className="font-mono text-[11px] text-muted-2">Last updated {UPDATED}</p>

        <p>
          The Delegation Lab at lab.vaom.ai is run by Verkflöde AB (reg. 559538-5708), Sweden, which is responsible for
          the processing described here. Questions: <a href="mailto:hello@verkflode.com">hello@verkflode.com</a>.
        </p>

        <H>The short version</H>
        <ul className="list-disc pl-5">
          <li>No cookies, no accounts, no sign-up.</li>
          <li>The game runs in your browser. What you choose in it stays there; the files you export are made there too.</li>
          <li>We count visits anonymously with our own analytics, on our own server. No IP addresses are stored.</li>
          <li>The AI model that writes VAOM&apos;s briefings is sent nothing about you or your game.</li>
          <li>The Lab and its analytics run on a server in France.</li>
        </ul>

        <H>Visit statistics</H>
        <p>
          We use <a href="https://umami.is" target="_blank" rel="noreferrer">Umami</a>, an open-source analytics tool that
          we run ourselves on the Lab&apos;s server; no analytics company receives your data. For each visit it records the
          page, the referring site, browser, operating system, device type, screen size, language and approximate location
          (the country, sometimes a region or city), and how far the game got: started, each round finished, completed,
          and which export files were saved, with the scenario played. It uses no cookies. To tell one visit&apos;s steps
          apart it derives an anonymous ID from your IP address and browser together with a secret that changes every
          month; the IP address itself is not stored, and the ID can&apos;t be turned back into it.
        </p>
        <p>
          We use these statistics to see whether the Lab works and where players stop, which is our legitimate interest
          under Article 6(1)(f) GDPR. They stay in our analytics database while the Lab runs, and in encrypted backups on
          our own equipment for up to 13 months.
        </p>
        <p>
          Browsers that send a Do Not Track signal aren&apos;t counted. You can also switch counting off for this browser
          here; that is the only thing the Lab ever stores in your browser, and only if you ask:
        </p>
        <OptOut />

        <H>The AI model</H>
        <p>
          VAOM&apos;s round briefings are written by a model from Mistral AI (France), which our server calls through
          Mistral&apos;s EU endpoint, where Mistral processes requests in data centres in the EU and EFTA countries. Each
          request contains only the fixed text for that round: nothing you chose or typed, and nothing that identifies
          you. Mistral sees our server, not your browser. If the model doesn&apos;t answer in time, you get the
          Lab&apos;s own scripted text; the debriefs and your final profile are always scripted from your game, in your
          browser.
        </p>

        <H>Where the Lab runs</H>
        <p>
          The Lab&apos;s server is at OVHcloud in Gravelines, France. Cloudflare sits in front of it to provide the
          encrypted connection and protect it against attacks, so Cloudflare handles your IP address and requests on the
          way, at the data centre nearest you, which may be outside the EU (see{" "}
          <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">Cloudflare&apos;s privacy policy</a>).
          Our server keeps no access logs. To stop abuse of the AI model, it remembers how often an IP address asked for a
          briefing, in memory only and for at most an hour. Fonts and everything else the page needs come from our own
          server: your browser contacts no other company to show the Lab.
        </p>

        <H>Your rights</H>
        <p>
          You have the right to access, correct and erase personal data about you, and to object to its use. The
          statistics aren&apos;t linked to a name or an address we could look up, so we usually can&apos;t find
          &ldquo;your&rdquo; records, but write to us and we will help as far as we can. You can also complain to the
          Swedish Authority for Privacy Protection (<a href="https://www.imy.se/en/" target="_blank" rel="noreferrer">IMY</a>).
        </p>

        <p className="mt-10 text-[13px] text-muted-2">
          This page covers the Lab. The VAOM framework at <a href="https://vaom.ai">vaom.ai</a> and{" "}
          <a href="https://verkflode.com/privacy">verkflode.com</a> have their own.
        </p>
      </article>
    </main>
  );
}
