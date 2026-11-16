import crypto from "crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export const WHATSAPP_COOKIE_NAME = "mb_whatsapp_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days for installed PWA convenience
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

declare global {
  var __waLoginRateLimits: Map<string, RateLimitBucket> | undefined;
}

function getRateLimitMap(): Map<string, RateLimitBucket> {
  if (!globalThis.__waLoginRateLimits) {
    globalThis.__waLoginRateLimits = new Map();
  }
  return globalThis.__waLoginRateLimits;
}

export function getClientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function checkLoginRateLimit(key: string): {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
} {
  const map = getRateLimitMap();
  const now = Date.now();

  // Opportunistic cleanup of expired buckets
  if (map.size > 500) {
    for (const [k, b] of map.entries()) {
      if (now >= b.resetAt) map.delete(k);
    }
  }

  const bucket = map.get(key);
  if (!bucket || now >= bucket.resetAt) {
    return {
      allowed: true,
      remaining: MAX_FAILED_ATTEMPTS,
      retryAfterSeconds: 0,
    };
  }

  if (bucket.count >= MAX_FAILED_ATTEMPTS) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, MAX_FAILED_ATTEMPTS - bucket.count),
    retryAfterSeconds: 0,
  };
}

export function recordFailedLoginAttempt(key: string): {
  remaining: number;
  retryAfterSeconds: number;
} {
  const map = getRateLimitMap();
  const now = Date.now();
  const existing = map.get(key);

  if (!existing || now >= existing.resetAt) {
    map.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return {
      remaining: MAX_FAILED_ATTEMPTS - 1,
      retryAfterSeconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
    };
  }

  existing.count += 1;
  map.set(key, existing);
  return {
    remaining: Math.max(0, MAX_FAILED_ATTEMPTS - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

export function clearFailedLoginAttempts(key: string): void {
  getRateLimitMap().delete(key);
}

function getSessionSecret(): string {
  return (
    process.env.WHATSAPP_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ORACLE_SYNC_API_KEY ||
    process.env.MYSQL_PASSWORD ||
    "modern_building_wa_session_fallback_2026"
  );
}

function sha256Equal(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest();
  const hb = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function verifyWhatsAppCredentials(username: string, password: string): boolean {
  const configuredUser = (process.env.WHATSAPP_PORTAL_USER || "modernbuilding")
    .trim()
    .toLowerCase();
  const configuredPass = process.env.WHATSAPP_PORTAL_PASSWORD || "01072025";

  const inputUser = String(username || "").trim().toLowerCase();
  const inputPass = String(password || "");

  return sha256Equal(inputUser, configuredUser) && sha256Equal(inputPass, configuredPass);
}

export function createWhatsAppSessionToken(username: string): string {
  const payload = JSON.stringify({
    username: username.trim().toLowerCase(),
    scope: "whatsapp_portal",
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  });
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSessionSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyWhatsAppSessionToken(
  token: string | undefined
): { username: string } | null {
  if (!token) return null;
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0) return null;

  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expectedSig = crypto
    .createHmac("sha256", getSessionSecret())
    .update(encoded)
    .digest("base64url");

  if (!sha256Equal(sig, expectedSig)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (
      !parsed?.username ||
      parsed?.scope !== "whatsapp_portal" ||
      typeof parsed.exp !== "number" ||
      Date.now() > parsed.exp
    ) {
      return null;
    }
    return { username: String(parsed.username) };
  } catch {
    return null;
  }
}

export async function getWhatsAppSession(): Promise<{ username: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(WHATSAPP_COOKIE_NAME)?.value;
  return verifyWhatsAppSessionToken(token);
}

export function getWhatsAppSessionMaxAge(): number {
  return SESSION_MAX_AGE_SECONDS;
}
