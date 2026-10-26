import "server-only";

interface RateLimitOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
}

export function createRateLimiter({ limit, windowMs, now = Date.now }: RateLimitOptions) {
  const entries = new Map<string, { count: number; resetAt: number }>();

  return {
    check(key: string) {
      const current = now();
      const entry = entries.get(key);
      if (!entry || entry.resetAt <= current) {
        if (entries.size >= 10_000) entries.delete(entries.keys().next().value!);
        entries.set(key, { count: 1, resetAt: current + windowMs });
        return { allowed: true, retryAfterSeconds: 0 };
      }
      entry.count += 1;
      return { allowed: entry.count <= limit, retryAfterSeconds: Math.ceil((entry.resetAt - current) / 1000) };
    },
  };
}

function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "anonymous";
}

const tripLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
const locationLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

// shortcut: limits are per process and trust proxy headers; use a gateway or shared store when running multiple instances.

export function limitTripRequest(request: Request) {
  return tripLimiter.check(clientKey(request));
}

export function limitLocationRequest(request: Request) {
  return locationLimiter.check(clientKey(request));
}
