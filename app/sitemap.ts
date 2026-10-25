import type { MetadataRoute } from "next";

// Served at /sitemap.xml. The game is one page; the privacy page is the only other.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://lab.vaom.ai/", lastModified: "2026-10-25", changeFrequency: "monthly", priority: 1 },
    { url: "https://lab.vaom.ai/privacy", lastModified: "2026-10-25", changeFrequency: "yearly", priority: 0.3 },
  ];
}
