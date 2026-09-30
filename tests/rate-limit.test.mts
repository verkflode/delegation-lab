import { createLimiter, clientIp } from "../lib/rate-limit.ts";
let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { if (got !== want) { fails++; console.log("FAIL", name, "got", got, "want", want); } };
const req = (ip?: string, xff?: string) => new Request("http://x/api/claude", { method: "POST", headers: { ...(ip ? { "x-real-ip": ip } : {}), ...(xff ? { "x-forwarded-for": xff } : {}) } });
const t0 = 1_000_000;

// per-minute
{ const lim = createLimiter({ perMinute: 3, perHour: 100, globalPerHour: 100 });
  for (let i = 0; i < 3; i++) eq(`minute ok ${i}`, lim(req("1.1.1.1"), t0), null);
  eq("minute trips", lim(req("1.1.1.1"), t0), "ip_minute");
  eq("other ip unaffected", lim(req("2.2.2.2"), t0), null);
  eq("minute window resets", lim(req("1.1.1.1"), t0 + 60_000), null); }
// per-hour
{ const lim = createLimiter({ perMinute: 100, perHour: 5, globalPerHour: 100 });
  for (let i = 0; i < 5; i++) eq(`hour ok ${i}`, lim(req("1.1.1.1"), t0 + i * 61_000), null);
  eq("hour trips", lim(req("1.1.1.1"), t0 + 6 * 61_000), "ip_hour");
  eq("hour resets", lim(req("1.1.1.1"), t0 + 3_600_000 + 1), null); }
// global breaker, and blocked IPs don't consume it
{ const lim = createLimiter({ perMinute: 2, perHour: 100, globalPerHour: 5 });
  lim(req("9.9.9.9"), t0); lim(req("9.9.9.9"), t0);
  for (let i = 0; i < 50; i++) lim(req("9.9.9.9"), t0);           // noisy IP, rejected per-IP
  eq("noisy ip is blocked", lim(req("9.9.9.9"), t0), "ip_minute");
  for (let i = 0; i < 3; i++) eq(`global ok ${i}`, lim(req(`10.0.0.${i}`), t0), null); // 2 + 3 = 5 used
  eq("global trips", lim(req("10.0.0.99"), t0), "global_hour");
  eq("global resets", lim(req("10.0.0.99"), t0 + 3_600_000), null); }
// IP source
eq("x-real-ip used", clientIp(req("3.3.3.3", "6.6.6.6")), "3.3.3.3");
eq("xff ignored", clientIp(req(undefined, "6.6.6.6")), "unknown");
{ const lim = createLimiter({ perMinute: 2, perHour: 100, globalPerHour: 100 });
  lim(req("4.4.4.4", "a")); lim(req("4.4.4.4", "b"));
  eq("forged xff can't dodge", lim(req("4.4.4.4", "c")), "ip_minute"); }
console.log(fails ? `${fails} failed` : "all limiter tests passed");
process.exit(fails ? 1 : 0);
