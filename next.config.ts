import type { NextConfig } from "next";

// The VAOM Guardian's core and its ACS translation are vendored (vendor/vaom-guardian, pinned to a commit;
// see scripts/vendor-guardian.mjs) and imported under their package names.
const nextConfig: NextConfig = {
  // Self-contained server build for the container image (see Dockerfile).
  // Vercel builds work unchanged with it.
  output: "standalone",
  turbopack: {
    resolveAlias: {
      "@verkflode/vaom-guardian-core": "./vendor/vaom-guardian/core/src/index.ts",
      // Translation only: the ACS endpoint and its validators stay out of the bundle.
      "@verkflode/vaom-guardian-acs": "./vendor/vaom-guardian/acs/src/translate.ts",
    },
  },
};

export default nextConfig;
