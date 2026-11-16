import { NextRequest } from "next/server";
import { isMysqlConfigured, queryRows } from "@/lib/mysql";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id || !isMysqlConfigured()) {
    return new Response("Not Found", { status: 404 });
  }

  try {
    const rows = await queryRows<any>(
      "SELECT filename, mime_type, file_data FROM media_files WHERE id = ? LIMIT 1",
      [id]
    );
    if (!rows.length || !rows[0].file_data) {
      return new Response("Not Found", { status: 404 });
    }

    const row = rows[0];
    const buf = Buffer.isBuffer(row.file_data)
      ? row.file_data
      : Buffer.from(row.file_data);

    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": row.mime_type || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("[API /api/media] Error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
