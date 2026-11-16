import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  verifyAdminCredentials,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body?.email || "").trim();
    const password = String(body?.password || "");

    if (!process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        {
          success: false,
          error: "متغير ADMIN_PASSWORD غير مضبوط في إعدادات السيرفر.",
        },
        { status: 500 }
      );
    }

    if (!verifyAdminCredentials(email, password)) {
      return NextResponse.json(
        { success: false, error: "الإيميل أو كلمة المرور غير صحيحة" },
        { status: 401 }
      );
    }

    const token = createAdminSessionToken(email);
    const response = NextResponse.json({ success: true });
    response.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "تعذر تسجيل الدخول." },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(ADMIN_COOKIE_NAME);
  return response;
}
