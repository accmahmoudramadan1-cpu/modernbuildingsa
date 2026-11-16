import crypto from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "mb_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSessionSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ORACLE_SYNC_API_KEY ||
    process.env.MYSQL_PASSWORD ||
    "modern_building_session_fallback_key"
  );
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifyAdminCredentials(email: string, password: string): boolean {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword) {
    return false;
  }

  const configuredEmail = (process.env.ADMIN_EMAIL || "admin@modernbuildingsa.com")
    .trim()
    .toLowerCase();
  const inputEmail = email.trim().toLowerCase();

  return safeEqual(inputEmail, configuredEmail) && safeEqual(password, configuredPassword);
}

export function createAdminSessionToken(email: string): string {
  const payload = JSON.stringify({
    email: email.trim().toLowerCase(),
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  });
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSessionSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyAdminSessionToken(token: string | undefined): { email: string } | null {
  if (!token) return null;
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0) return null;

  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expectedSig = crypto
    .createHmac("sha256", getSessionSecret())
    .update(encoded)
    .digest("base64url");

  if (!safeEqual(sig, expectedSig)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!parsed?.email || typeof parsed.exp !== "number" || Date.now() > parsed.exp) {
      return null;
    }
    return { email: String(parsed.email) };
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<{ email: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token);
}
