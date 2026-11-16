import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { executeSql, isMysqlConfigured, queryRows } from "@/lib/mysql";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMysqlConfigured()) return NextResponse.json({ data: null });

  try {
    const rows = await queryRows<any>(
      `SELECT company_name, phone_1, phone_2, landline, whatsapp, address,
              description, maps_url, whatsapp_business, instagram_url
       FROM site_settings WHERE id = 1 LIMIT 1`
    );
    return NextResponse.json({ data: rows[0] || {} });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    await executeSql(
      `INSERT INTO site_settings (
         id, company_name, phone_1, phone_2, landline, whatsapp, address,
         description, maps_url, whatsapp_business, instagram_url, updated_at
       ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE
         company_name = VALUES(company_name),
         phone_1 = VALUES(phone_1),
         phone_2 = VALUES(phone_2),
         landline = VALUES(landline),
         whatsapp = VALUES(whatsapp),
         address = VALUES(address),
         description = VALUES(description),
         maps_url = VALUES(maps_url),
         whatsapp_business = VALUES(whatsapp_business),
         instagram_url = VALUES(instagram_url),
         updated_at = NOW(3)`,
      [
        String(body?.company_name || "").trim(),
        String(body?.phone_1 || "").trim(),
        String(body?.phone_2 || "").trim(),
        String(body?.landline || "").trim(),
        String(body?.whatsapp || "").trim(),
        String(body?.address || "").trim(),
        String(body?.description || "").trim(),
        String(body?.maps_url || "").trim(),
        String(body?.whatsapp_business || "").trim(),
        String(body?.instagram_url || "").trim(),
      ]
    );
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to save settings" }, { status: 500 });
  }
}
