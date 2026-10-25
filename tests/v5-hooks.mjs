// Lets `node --test` import the v5 engine as Next bundles it: extensionless and directory imports, JSON
// imports without attributes, and the two VAOM Guardian packages, vendored in vendor/vaom-guardian
// (the same aliases as next.config.ts and tsconfig.json).
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ALIASES = {
  "@verkflode/vaom-guardian-core": new URL("../vendor/vaom-guardian/core/src/index.ts", import.meta.url).href,
  "@verkflode/vaom-guardian-acs": new URL("../vendor/vaom-guardian/acs/src/translate.ts", import.meta.url).href,
};

registerHooks({
  resolve(spec, ctx, next) {
    if (spec in ALIASES) return { url: ALIASES[spec], shortCircuit: true };
    if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL?.startsWith("file:") && !/\.(m?[jt]sx?|json)$/.test(spec)) {
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        const url = new URL(spec + ext, ctx.parentURL);
        if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
      }
    }
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    if (url.endsWith(".json")) return { format: "module", source: `export default ${readFileSync(fileURLToPath(url), "utf8")};`, shortCircuit: true };
    return next(url, ctx);
  },
});
