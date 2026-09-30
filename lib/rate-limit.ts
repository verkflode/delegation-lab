/**
 * In-memory rate limiting for the paid API routes (/api/claude, /api/voice).
 *
 * Two layers: per client IP (per minute and per hour), then a global hourly
 * ceiling across all clients, which acts as a circuit breaker against
 * distributed abuse. A caller rejected by its own per-IP limit does not use up
 * the global budget, so one noisy client can't lock everyone else out.
 *
 * This works on a single long-running server. On serverless platforms each
 * instance keeps its own counters, so it is best effort there. Either way, the
 * hard ceiling is the spend limit on the upstream API key, not this module.
 *
 * The client IP comes from X-Real-IP, which the reverse proxy sets from the
 * connection itself (Caddy: `header_up X-Real-IP {client_ip}`; Vercel sets it
 * too). X-Forwarded-For is deliberately not read: its first entry is whatever
 * the caller chose to send.
 *
 * Being limited is not an outage: the client falls back to the built-in text
 * bank (see lib/api.ts), so the game keeps working.
 */

type Window = { count: number; reset: number };

export type Limits = {
  perMinute: number;
  perHour: number;
  globalPerHour: number;
};

export type LimitReason = "ip_minute" | "ip_hour" | "global_hour";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function envInt(name: string, fallback: number): number {
  const v = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Limits from the environment (e.g. CLAUDE_RATE_PER_MINUTE), with defaults. */
export function limitsFromEnv(prefix: string, defaults: Limits): Limits {
  return {
    perMinute: envInt(`${prefix}_RATE_PER_MINUTE`, defaults.perMinute),
    perHour: envInt(`${prefix}_RATE_PER_HOUR`, defaults.perHour),
    globalPerHour: envInt(`${prefix}_RATE_GLOBAL_PER_HOUR`, defaults.globalPerHour),
  };
}

export function clientIp(req: Request): string {
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Counts one hit against `map[key]`; returns true when the hit exceeds `limit`. */
function over(map: Map<string, Window>, key: string, limit: number, windowMs: number, now: number): boolean {
  const w = map.get(key);
  if (!w || now >= w.reset) {
    map.set(key, { count: 1, reset: now + windowMs });
    return limit < 1;
  }
  w.count += 1;
  return w.count > limit;
}

export function createLimiter(limits: Limits) {
  const perMinute = new Map<string, Window>();
  const perHour = new Map<string, Window>();
  const global: Window = { count: 0, reset: 0 };
  let lastPrune = 0;

  function prune(now: number) {
    if (now - lastPrune < MINUTE) return;
    lastPrune = now;
    for (const map of [perMinute, perHour]) {
      for (const [k, w] of map) if (now >= w.reset) map.delete(k);
    }
  }

  /** Returns why the request is limited, or null if it may proceed. */
  return function limited(req: Request, now = Date.now()): LimitReason | null {
    prune(now);
    const ip = clientIp(req);
    // Evaluate both per-IP windows so each keeps counting, then decide.
    const minuteOver = over(perMinute, ip, limits.perMinute, MINUTE, now);
    const hourOver = over(perHour, ip, limits.perHour, HOUR, now);
    if (minuteOver) return "ip_minute";
    if (hourOver) return "ip_hour";

    if (now >= global.reset) {
      global.count = 0;
      global.reset = now + HOUR;
    }
    if (global.count >= limits.globalPerHour) return "global_hour";
    global.count += 1;
    return null;
  };
}
