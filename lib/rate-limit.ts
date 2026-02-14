/**
 * Rate Limiter with Upstash Redis support.
 *
 * Uses Upstash Redis for distributed rate limiting when configured.
 * Falls back to in-memory token bucket for dev / single-instance deployments.
 *
 * Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars to enable Redis.
 *
 * Usage:
 *   const result = await consumeRateLimit(paymentLimiter, clientIP);
 */

type RateLimiterConfig = {
  /** Maximum tokens (burst capacity) */
  maxTokens: number;
  /** Tokens added per refill */
  refillRate: number;
  /** Refill interval in ms */
  refillInterval: number;
};

type Bucket = {
  tokens: number;
  lastRefill: number;
};

export type ConsumeResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

const GC_INTERVAL = 5 * 60_000;
const STALE_THRESHOLD = 10 * 60_000;
const MAX_BUCKETS = 10_000; // Cap in-memory buckets to prevent OOM under DDoS

// ============================================================================
// UPSTASH REDIS DETECTION
// ============================================================================

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_REDIS = !!(UPSTASH_URL && UPSTASH_TOKEN);

// ============================================================================
// IN-MEMORY FALLBACK (single-instance only)
// ============================================================================

function createInMemoryLimiter(config: RateLimiterConfig) {
  const buckets = new Map<string, Bucket>();
  let lastGC = Date.now();

  function gc() {
    const now = Date.now();
    if (now - lastGC < GC_INTERVAL) return;
    lastGC = now;

    for (const [key, bucket] of buckets) {
      if (now - bucket.lastRefill > STALE_THRESHOLD) {
        buckets.delete(key);
      }
    }

    // Hard cap: evict oldest if over limit (DDoS memory protection)
    if (buckets.size > MAX_BUCKETS) {
      const entries = [...buckets.entries()].sort(
        (a, b) => a[1].lastRefill - b[1].lastRefill
      );
      const toRemove = entries.slice(0, buckets.size - MAX_BUCKETS);
      for (const [key] of toRemove) {
        buckets.delete(key);
      }
    }
  }

  function consume(key: string, tokens = 1): ConsumeResult {
    gc();
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { tokens: config.maxTokens, lastRefill: now };
      buckets.set(key, bucket);
    }

    const elapsed = now - bucket.lastRefill;
    const refills = Math.floor(elapsed / config.refillInterval);
    if (refills > 0) {
      bucket.tokens = Math.min(
        config.maxTokens,
        bucket.tokens + refills * config.refillRate
      );
      bucket.lastRefill += refills * config.refillInterval;
    }

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return { allowed: true, remaining: bucket.tokens, retryAfterMs: 0 };
    }

    const deficit = tokens - bucket.tokens;
    const refillsNeeded = Math.ceil(deficit / config.refillRate);
    const retryAfterMs = refillsNeeded * config.refillInterval;

    return { allowed: false, remaining: 0, retryAfterMs };
  }

  return { consume };
}

// ============================================================================
// UPSTASH REDIS SLIDING WINDOW COUNTER
// ============================================================================

async function upstashConsume(
  key: string,
  config: RateLimiterConfig
): Promise<ConsumeResult> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return { allowed: true, remaining: config.maxTokens, retryAfterMs: 0 };
  }

  const windowMs = config.refillInterval;
  const now = Date.now();
  const windowKey = `rl:${key}:${Math.floor(now / windowMs)}`;

  try {
    const response = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", windowKey],
        ["PEXPIRE", windowKey, String(windowMs * 2)],
      ]),
    });

    if (!response.ok) {
      console.error("[RateLimiter] Upstash error:", response.status);
      // Fail open: allow request if Redis is down
      return { allowed: true, remaining: config.maxTokens, retryAfterMs: 0 };
    }

    const results = (await response.json()) as { result: number }[];
    const count = results[0]?.result ?? 1;

    if (count <= config.maxTokens) {
      return {
        allowed: true,
        remaining: config.maxTokens - count,
        retryAfterMs: 0,
      };
    }

    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: windowMs - (now % windowMs),
    };
  } catch (err) {
    console.error("[RateLimiter] Upstash fetch error:", err);
    // Fail open
    return { allowed: true, remaining: config.maxTokens, retryAfterMs: 0 };
  }
}

// ============================================================================
// UNIFIED FACTORY
// ============================================================================

function createRateLimiter(config: RateLimiterConfig) {
  const memoryLimiter = createInMemoryLimiter(config);

  return {
    consume(key: string, tokens = 1): ConsumeResult | Promise<ConsumeResult> {
      if (USE_REDIS) {
        return upstashConsume(key, config);
      }
      return memoryLimiter.consume(key, tokens);
    },
  };
}

// ============================================================================
// PRE-CONFIGURED LIMITERS
// ============================================================================

/** Payment initiation: 5 requests per minute per IP */
export const paymentLimiter = createRateLimiter({
  maxTokens: 5,
  refillRate: 5,
  refillInterval: 60_000,
});

/** Invoice creation: 30 requests per minute per key */
export const invoiceCreateLimiter = createRateLimiter({
  maxTokens: 30,
  refillRate: 30,
  refillInterval: 60_000,
});

/** Public endpoint reads: 60 requests per minute per IP */
export const publicReadLimiter = createRateLimiter({
  maxTokens: 60,
  refillRate: 60,
  refillInterval: 60_000,
});

/** Private CRUD operations: 120 requests per minute per user/IP */
export const privateCrudLimiter = createRateLimiter({
  maxTokens: 120,
  refillRate: 120,
  refillInterval: 60_000,
});

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract client IP from a NextRequest.
 * Uses the rightmost (proxy-appended) IP from x-forwarded-for to prevent
 * spoofing via user-controlled X-Forwarded-For headers.
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    return parts[parts.length - 1] || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * Consume a rate limiter (handles both sync in-memory and async Redis).
 */
export async function consumeRateLimit(
  limiter: ReturnType<typeof createRateLimiter>,
  key: string
): Promise<ConsumeResult> {
  const result = limiter.consume(key);
  return result instanceof Promise ? result : result;
}
