import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Sliding window rate limiter — shared across all serverless function instances
// via Upstash Redis. Lazy-initialized so a missing UPSTASH_* env doesn't crash
// the module on import (useful for build-time route discovery).
let cachedLimiter: Ratelimit | null = null;

function getLimiter(): Ratelimit | null {
  if (cachedLimiter) return cachedLimiter;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    // Fail open in environments without Upstash configured (e.g. local dev
    // without secrets). Production WILL have the env vars; if it doesn't,
    // that's a deploy misconfiguration to surface via observability, not
    // a reason to block legitimate requests.
    return null;
  }

  cachedLimiter = new Ratelimit({
    redis: new Redis({ url, token }),
    // 5 requests per 60 seconds, per identifier. Sliding window — counts the
    // 60s preceding "now" rather than fixed minute buckets.
    limiter: Ratelimit.slidingWindow(5, "60 s"),
    analytics: true,
    prefix: "sdnv:rl",
  });

  return cachedLimiter;
}

let cachedKioskLimiter: Ratelimit | null = null;

function getKioskLimiter(): Ratelimit | null {
  if (cachedKioskLimiter) return cachedKioskLimiter;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  cachedKioskLimiter = new Ratelimit({
    redis: new Redis({ url, token }),
    // Kiosk: 20/minute. Sales staff at a trade show can plausibly create
    // a new intake record every 3 seconds for back-to-back walk-ups.
    limiter: Ratelimit.slidingWindow(20, "60 s"),
    analytics: true,
    prefix: "sdnv:rl:kiosk",
  });

  return cachedKioskLimiter;
}

/**
 * Returns true if the request is within the rate limit and may proceed.
 * Returns false if it should be rejected with 429.
 *
 * Identifier should be stable and per-actor. For public endpoints use the
 * client IP from the x-forwarded-for header (Vercel-set). For token-gated
 * endpoints prefer the token itself — it's a more stable identity than IP
 * for a single user retrying.
 */
export async function checkRateLimit(identifier: string): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const limiter = getLimiter();
  if (!limiter) {
    // Unconfigured environment — fail open. See comment in getLimiter().
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

export async function checkKioskRateLimit(identifier: string): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const limiter = getKioskLimiter();
  if (!limiter) return { success: true, limit: 0, remaining: 0, reset: 0 };
  const r = await limiter.limit(identifier);
  return { success: r.success, limit: r.limit, remaining: r.remaining, reset: r.reset };
}

/**
 * Extract a client identifier from a Next.js request. Falls back to a string
 * literal ("unknown") if no IP header is present — which will cause all
 * unknown-IP callers to share a single rate-limit bucket. That's a feature,
 * not a bug: it means anonymous spam still gets throttled, just collectively.
 */
export function getClientIdentifier(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // x-forwarded-for can be "client, proxy1, proxy2" — first entry is client.
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xRealIp = req.headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();
  return "unknown";
}
