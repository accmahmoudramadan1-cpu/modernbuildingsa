import { NextRequest } from "next/server";
import { isMysqlConfigured, queryRows } from "@/lib/mysql";
import { repairOnyxPdfFonts } from "@/lib/fix-onyx-pdf";

export const dynamic = "force-dynamic";

/**
 * GET /api/oracle-orders/pdf/[invoiceNumber]
 * Serves stored Onyx Pro PDF binaries from Hostinger MySQL to Meta WhatsApp Cloud API or browsers.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ invoiceNumber: string }> }
) {
  const { invoiceNumber } = await context.params;
  const decodedInvoice = decodeURIComponent(invoiceNumber || "").trim();

  if (!decodedInvoice || !isMysqlConfigured()) {
    return new Response("PDF Not Found", { status: 404 });
  }

  try {
    const rows = await queryRows<any>(
      `SELECT filename, mime_type, pdf_data FROM oracle_pdfs WHERE invoice_number = ? LIMIT 1`,
      [decodedInvoice]
    );

    if (!rows.length || !rows[0].pdf_data) {
      return new Response("PDF Not Found", { status: 404 });
    }

    const row = rows[0];
    const rawBuf = Buffer.isBuffer(row.pdf_data)
      ? row.pdf_data
      : Buffer.from(row.pdf_data);
    const buf = repairOnyxPdfFonts(rawBuf);

    const safeFilename = String(row.filename || `${decodedInvoice}.pdf`).replace(/[^A-Za-z0-9_.-]/g, "_");

    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": row.mime_type || "application/pdf",
        "Content-Disposition": `inline; filename="${safeFilename}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[API /api/oracle-orders/pdf] Error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
