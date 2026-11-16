import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { executeSql, isMysqlConfigured, queryRows } from "@/lib/mysql";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMysqlConfigured()) return NextResponse.json({ data: [] });

  try {
    const orders = await queryRows<any>(
      "SELECT id, customer_name, phone, whatsapp, address, notes, status, created_at FROM orders ORDER BY created_at DESC"
    );
    let items: any[] = [];
    if (orders.length > 0) {
      const ids = orders.map((o) => o.id);
      const placeholders = ids.map(() => "?").join(", ");
      items = await queryRows<any>(
        `SELECT id, order_id, product_name, quantity, price, currency
         FROM order_items WHERE order_id IN (${placeholders})`,
        ids
      );
    }

    const combined = orders.map((order) => ({
      ...order,
      items: items.filter((item) => item.order_id === order.id),
    }));

    return NextResponse.json({ data: combined });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to load orders" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const id = String(body?.id || "").trim();
    const status = String(body?.status || "").trim();
    if (!id || !status) return NextResponse.json({ error: "Missing id or status" }, { status: 400 });

    await executeSql("UPDATE orders SET status = ? WHERE id = ?", [status, id]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update order" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const id = request.nextUrl.searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await executeSql("DELETE FROM order_items WHERE order_id = ?", [id]);
    await executeSql("DELETE FROM orders WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to delete order" }, { status: 500 });
  }
}
