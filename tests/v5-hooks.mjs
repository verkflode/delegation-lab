// Lets `node --test` import the v5 engine as Next bundles it: extensionless relative imports, JSON
// imports without attributes, and the two VAOM Guardian packages (the ACS one is an alias to its
// translation module, as in next.config.ts).
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const acs = new URL("../../../ACS project/packages/acs/src/translate.ts", import.meta.url).href;

registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "@verkflode/vaom-guardian-acs") return { url: acs, shortCircuit: true };
    if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL?.startsWith("file:") && !/\.(m?[jt]sx?|json)$/.test(spec)) {
      for (const ext of [".ts", ".tsx"]) {
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
