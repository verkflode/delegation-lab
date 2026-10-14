import type { NextConfig } from "next";
import { join } from "node:path";

// SPIKE (v5): the Guardian core is linked from the sibling repo with a file: dependency, and the ACS
// package is aliased to its source. Both ship TypeScript, so Next transpiles them. The Turbopack root is
// widened to ~/Development so it can read them. Replaced by normal package dependencies once the
// Guardian repo is public.
const acs = "../../ACS project/packages/acs/src/translate.ts"; // translation only: the endpoint and its validators stay out of the bundle

const nextConfig: NextConfig = {
  // Self-contained server build for the container image (see Dockerfile).
  // Vercel builds work unchanged with it.
  output: "standalone",
  transpilePackages: ["@verkflode/vaom-guardian-core"],
  turbopack: {
    root: join(import.meta.dirname, "..", ".."),
    resolveAlias: { "@verkflode/vaom-guardian-acs": acs },
  },
};

export default nextConfig;
