import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { executeSql, isMysqlConfigured, queryRows } from "@/lib/mysql";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMysqlConfigured()) return NextResponse.json({ data: [] });

  try {
    const data = await queryRows<any>(
      "SELECT id, name, description, image_url, created_at FROM categories ORDER BY created_at DESC"
    );
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to load categories" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const id = crypto.randomUUID();
    const name = String(body?.name || "").trim();
    const description = body?.description ? String(body.description).trim() : null;
    const imageUrl = body?.image_url ? String(body.image_url).trim() : null;

    if (!name) return NextResponse.json({ error: "Category name required" }, { status: 400 });

    await executeSql(
      "INSERT INTO categories (id, name, description, image_url, created_at) VALUES (?, ?, ?, ?, NOW(3))",
      [id, name, description, imageUrl]
    );
    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to create category" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const id = String(body?.id || "").trim();
    const name = String(body?.name || "").trim();
    const description = body?.description ? String(body.description).trim() : null;
    const imageUrl = body?.image_url ? String(body.image_url).trim() : null;

    if (!id || !name) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    await executeSql(
      "UPDATE categories SET name = ?, description = ?, image_url = ? WHERE id = ?",
      [name, description, imageUrl, id]
    );
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const id = request.nextUrl.searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await executeSql("DELETE FROM categories WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to delete category" }, { status: 500 });
  }
}
