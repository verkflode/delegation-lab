import type { MetadataRoute } from "next";

// Served at /robots.txt. The API routes are for the game, not for crawlers.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: "https://lab.vaom.ai/sitemap.xml",
  };
}
