import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (secret !== "modern_building_setup_2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_SUPABASE_URL" },
      { status: 500 }
    );
  }

  const email = "ahmed.king201255@gmail.com";
  const password = "Ahmed1234";

  // 1. Try with Service Role Key (Admin API)
  if (serviceRoleKey) {
    try {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (error) {
        // If user already exists, update their password
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existing = listData?.users.find((u) => u.email === email);
        if (existing) {
          const { data: updateData, error: updateError } =
            await supabaseAdmin.auth.admin.updateUserById(existing.id, {
              password,
              email_confirm: true,
            });
          if (updateError) {
            return NextResponse.json(
              { error: updateError.message },
              { status: 400 }
            );
          }
          return NextResponse.json({
            success: true,
            message: "User password updated successfully",
            user: updateData.user,
          });
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: "User created and confirmed successfully",
        user: data.user,
      });
    } catch (err: any) {
      console.error("Admin user creation error:", err);
    }
  }

  // 2. Fallback: Normal SignUp using Anon Key
  if (anonKey) {
    const supabase = createClient(supabaseUrl, anonKey);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "User signed up successfully via Anon key",
      user: data.user,
    });
  }

  return NextResponse.json(
    { error: "No Supabase keys available in environment" },
    { status: 500 }
  );
}
