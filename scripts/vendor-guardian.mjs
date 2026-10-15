// Copy the VAOM Guardian's core and its ACS translation into vendor/vaom-guardian, pinned to a commit.
//
//   node scripts/vendor-guardian.mjs <path to a vaom-guardian checkout>
//
// The Lab runs the Guardian's own decision code in the browser. It is vendored rather than installed so the
// Lab builds anywhere (the container, Vercel) from this repository alone, and so the exact version that
// runs is visible in vendor/vaom-guardian/VENDORED.md. Refuses a checkout with uncommitted changes: the
// copy must be a commit someone can look up.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const src = process.argv[2];
if (!src) { console.error("usage: node scripts/vendor-guardian.mjs <path to a vaom-guardian checkout>"); process.exit(2); }
const repo = resolve(src);
const git = (...args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

if (git("status", "--porcelain", "--", "packages/core", "packages/acs/src/translate.ts", "LICENSE", "NOTICE")) {
  console.error(`${repo} has uncommitted changes in the vendored paths; commit them first`);
  process.exit(1);
}
const commit = git("rev-parse", "HEAD");
const date = git("log", "-1", "--format=%cs");
const tag = (() => { try { return git("describe", "--tags", "--exact-match"); } catch { return null; } })();

const out = resolve(import.meta.dirname, "..", "vendor", "vaom-guardian");
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "acs", "src"), { recursive: true });
cpSync(join(repo, "packages", "core", "src"), join(out, "core", "src"), { recursive: true });
cpSync(join(repo, "packages", "acs", "src", "translate.ts"), join(out, "acs", "src", "translate.ts"));
for (const f of ["LICENSE", "NOTICE"]) if (existsSync(join(repo, f))) cpSync(join(repo, f), join(out, f));

writeFileSync(join(out, "VENDORED.md"), `# VAOM Guardian, vendored

The VAOM Guardian's pure core and its OWASP ACS translation, copied unchanged from
[verkflode/vaom-guardian](https://github.com/verkflode/vaom-guardian) by \`scripts/vendor-guardian.mjs\`.
Apache-2.0: see LICENSE and NOTICE in this folder. Don't edit these files here; change them in the
Guardian and vendor again.

- Commit: \`${commit}\`${tag ? `\n- Tag: \`${tag}\`` : ""}
- Commit date: ${date}
- Copied: \`packages/core/src\` and \`packages/acs/src/translate.ts\`

The Lab imports them as \`@verkflode/vaom-guardian-core\` and \`@verkflode/vaom-guardian-acs\`
(aliases in tsconfig.json, next.config.ts and tests/v5-hooks.mjs).
`);
console.log(`vendored ${commit.slice(0, 12)}${tag ? ` (${tag})` : ""} from ${date} into vendor/vaom-guardian`);
