const buckets = globalThis.__challengeCourtRateLimits || new Map()

if (!globalThis.__challengeCourtRateLimits) {
  globalThis.__challengeCourtRateLimits = buckets
}

function purgeExpiredBuckets(now) {
  for (const [key, entry] of buckets.entries()) {
    if (entry.resetAt <= now) {
      buckets.delete(key)
    }
  }
}

export function consumeRateLimit({ key, limit, windowMs }) {
  const now = Date.now()

  purgeExpiredBuckets(now)

  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    })

    return {
      allowed: true,
      retryAfterSeconds: 0,
    }
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  existing.count += 1

  return {
    allowed: true,
    retryAfterSeconds: 0,
  }
}
