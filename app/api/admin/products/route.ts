import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { executeSql, isMysqlConfigured, queryRows } from "@/lib/mysql";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMysqlConfigured()) return NextResponse.json({ categories: [], products: [] });

  try {
    const [categories, products] = await Promise.all([
      queryRows<any>("SELECT id, name FROM categories ORDER BY name ASC"),
      queryRows<any>(
        `SELECT id, category_id, name, description, price, currency, show_price,
                image_url, available, created_at
         FROM products ORDER BY created_at DESC`
      ),
    ]);

    const normalizedProducts = products.map((p: any) => ({
      ...p,
      price: p.price !== null && p.price !== undefined ? Number(p.price) : null,
      show_price: Boolean(p.show_price),
      available: Boolean(p.available),
    }));

    return NextResponse.json({ categories, products: normalizedProducts });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to load products" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const id = crypto.randomUUID();
    const name = String(body?.name || "").trim();
    if (!name) return NextResponse.json({ error: "Product name is required" }, { status: 400 });

    await executeSql(
      `INSERT INTO products (id, category_id, name, description, price, currency, show_price, image_url, available, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
      [
        id,
        body?.category_id || null,
        name,
        body?.description ? String(body.description).trim() : null,
        body?.price !== null && body?.price !== undefined ? Number(body.price) : null,
        body?.currency ? String(body.currency).trim() : null,
        body?.show_price ? 1 : 0,
        body?.image_url || null,
        body?.available !== false ? 1 : 0,
      ]
    );

    const additionalUrls: string[] = Array.isArray(body?.additional_images)
      ? body.additional_images
      : [];
    for (const imgUrl of additionalUrls) {
      if (!imgUrl) continue;
      await executeSql(
        "INSERT INTO product_images (id, product_id, image_url, created_at) VALUES (?, ?, ?, NOW(3))",
        [crypto.randomUUID(), id, String(imgUrl)]
      );
    }

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to add product" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const id = request.nextUrl.searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await executeSql("DELETE FROM product_images WHERE product_id = ?", [id]);
    await executeSql("DELETE FROM products WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to delete product" }, { status: 500 });
  }
}
