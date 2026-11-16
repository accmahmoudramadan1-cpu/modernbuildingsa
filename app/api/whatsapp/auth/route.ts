import { NextRequest, NextResponse } from "next/server";
import {
  WHATSAPP_COOKIE_NAME,
  checkLoginRateLimit,
  clearFailedLoginAttempts,
  createWhatsAppSessionToken,
  getClientIp,
  getWhatsAppSession,
  getWhatsAppSessionMaxAge,
  recordFailedLoginAttempt,
  verifyWhatsAppCredentials,
} from "@/lib/whatsapp-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getWhatsAppSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, username: session.username });
}

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);

  try {
    const body = await request.json();
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");

    const ipKey = `ip:${clientIp}`;
    const userKey = `ip_user:${clientIp}:${username.toLowerCase()}`;

    const ipCheck = checkLoginRateLimit(ipKey);
    const userCheck = checkLoginRateLimit(userKey);

    if (!ipCheck.allowed || !userCheck.allowed) {
      const retryAfter = Math.max(ipCheck.retryAfterSeconds, userCheck.retryAfterSeconds);
      const mins = Math.max(1, Math.ceil(retryAfter / 60));
      return NextResponse.json(
        {
          success: false,
          error: `تم تجاوز الحد المسموح لمحاولات الدخول. يرجى الانتظار ${mins} دقيقة والمحاولة مجدداً.`,
          retryAfterSeconds: retryAfter,
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        }
      );
    }

    if (!verifyWhatsAppCredentials(username, password)) {
      const failIp = recordFailedLoginAttempt(ipKey);
      recordFailedLoginAttempt(userKey);

      const remText =
        failIp.remaining > 0
          ? ` (متبقي ${failIp.remaining} محاولات قبل الحظر المؤقت)`
          : " (تم قفل المحاولات مؤقتاً لمدة 15 دقيقة)";

      return NextResponse.json(
        {
          success: false,
          error: `اسم المستخدم أو كلمة المرور غير صحيحة${remText}`,
          remainingAttempts: failIp.remaining,
        },
        { status: failIp.remaining === 0 ? 429 : 401 }
      );
    }

    clearFailedLoginAttempts(ipKey);
    clearFailedLoginAttempts(userKey);

    const token = createWhatsAppSessionToken(username);
    const response = NextResponse.json({
      success: true,
      username: username.trim().toLowerCase(),
    });
    response.cookies.set(WHATSAPP_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: getWhatsAppSessionMaxAge(),
    });
    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "تعذر إتمام تسجيل الدخول." },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(WHATSAPP_COOKIE_NAME);
  return response;
}
