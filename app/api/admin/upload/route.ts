import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { executeSql, isMysqlConfigured } from "@/lib/mysql";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isMysqlConfigured()) {
    return NextResponse.json({ success: false, error: "MySQL is not configured." }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "No image file provided." }, { status: 400 });
    }

    if (!file.type.startsWith("image/") || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { success: false, error: "ملف غير صالح أو يتجاوز 5 ميجابايت." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const id = crypto.randomUUID();
    const safeName = file.name.replace(/[^A-Za-z0-9_.-]/g, "_") || `${id}.jpg`;

    await executeSql(
      `INSERT INTO media_files (id, filename, mime_type, file_data, size_bytes, created_at)
       VALUES (?, ?, ?, ?, ?, NOW(3))`,
      [id, safeName, file.type, buffer, buffer.length]
    );

    return NextResponse.json({
      success: true,
      id,
      url: `/api/media/${id}`,
    });
  } catch (err: any) {
    console.error("[API /api/admin/upload] Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to upload image" },
      { status: 500 }
    );
  }
}
