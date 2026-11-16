import { NextRequest, NextResponse } from "next/server";
import { executeSql, isMysqlConfigured, queryRows } from "@/lib/mysql";
import { repairOnyxPdfFonts } from "@/lib/fix-onyx-pdf";
import { autoDispatchOracleInvoice, isAutoSendEligible } from "@/lib/oracle-autosend";

export const dynamic = "force-dynamic";

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB limit for WhatsApp Document API
const RETENTION_DAYS = 7;

/**
 * POST /api/oracle-orders/upload-pdf
 * Stores authentic Onyx Pro PDF files directly inside Hostinger MySQL (`oracle_pdfs`)
 * and returns a public HTTPS URL (/api/oracle-orders/pdf/<invoiceNumber>) for Meta Cloud API.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const configuredApiKey = process.env.ORACLE_SYNC_API_KEY;

    if (configuredApiKey) {
      const token = authHeader?.replace(/^Bearer\s+/i, "");
      if (token !== configuredApiKey) {
        return NextResponse.json(
          { success: false, error: "Unauthorized: Invalid or missing API key" },
          { status: 401 }
        );
      }
    }

    const body = await request.json();
    const invoiceNumber = String(body?.invoiceNumber || "").trim();
    const filename = String(body?.filename || "").trim() || `${invoiceNumber}.pdf`;
    const contentBase64 = String(body?.contentBase64 || "").trim();

    if (!invoiceNumber || !contentBase64) {
      return NextResponse.json(
        { success: false, error: "invoiceNumber and contentBase64 are required." },
        { status: 400 }
      );
    }

    const cleanBase64 = contentBase64.replace(/^data:application\/pdf;base64,/i, "");
    const rawPdfBuffer = Buffer.from(cleanBase64, "base64");

    if (rawPdfBuffer.length === 0 || rawPdfBuffer.length > MAX_PDF_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `PDF size invalid (${rawPdfBuffer.length} bytes). Max allowed is 10 MB.`,
        },
        { status: 400 }
      );
    }

    if (!rawPdfBuffer.subarray(0, 8).toString("ascii").includes("%PDF-")) {
      return NextResponse.json(
        { success: false, error: "Uploaded content is not a valid PDF binary (%PDF- header missing)." },
        { status: 400 }
      );
    }

    if (!isMysqlConfigured()) {
      return NextResponse.json(
        { success: false, error: "MySQL database is not configured on the server." },
        { status: 500 }
      );
    }

    const pdfBuffer = repairOnyxPdfFonts(rawPdfBuffer);
    const safeName = filename.replace(/[^A-Za-z0-9_.-]/g, "_") || `${invoiceNumber}.pdf`;

    await executeSql(
      `INSERT INTO oracle_pdfs (invoice_number, filename, mime_type, pdf_data, size_bytes, created_at)
       VALUES (?, ?, 'application/pdf', ?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE
         filename = VALUES(filename),
         pdf_data = VALUES(pdf_data),
         size_bytes = VALUES(size_bytes),
         created_at = NOW(3)`,
      [invoiceNumber, safeName, pdfBuffer, pdfBuffer.length]
    );

    // Opportunistically clean up PDFs older than 7 days to keep Hostinger MySQL lean
    await executeSql(
      `DELETE FROM oracle_pdfs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [RETENTION_DAYS]
    ).catch((err) => console.warn("[Upload PDF] Retention cleanup warning:", err));

    const publicBaseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://www.modernbuildingsa.com";
    const publicUrl = `${publicBaseUrl}/api/oracle-orders/pdf/${encodeURIComponent(invoiceNumber)}`;

    // Sync attachment_url onto existing oracle_invoices row if it already exists
    await executeSql(
      `UPDATE oracle_invoices SET attachment_url = ?, updated_at = NOW(3) WHERE invoice_number = ?`,
      [publicUrl, invoiceNumber]
    ).catch((err) => console.warn("[Upload PDF] Invoice attachment_url sync warning:", err));

    // If this invoice was waiting in 'pending' status for its authentic Onyx PDF, dispatch now!
    let autoDispatched = false;
    try {
      const invRows = await queryRows<any>(
        `SELECT invoice_number, doc_type, customer_name, phone, invoice_date, amount,
                currency, remaining_balance, payment_method, attachment_url,
                onyx_form_code, details, status
         FROM oracle_invoices
         WHERE invoice_number = ?
         LIMIT 1`,
        [invoiceNumber]
      );
      if (invRows.length > 0) {
        const doc = { ...invRows[0], attachment_url: publicUrl };
        if (isAutoSendEligible(doc)) {
          const dispatch = await autoDispatchOracleInvoice(doc);
          autoDispatched = dispatch.outcome === "sent";
        }
      }
    } catch (dispatchErr) {
      console.warn("[Upload PDF] Late auto-dispatch check failed:", dispatchErr);
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      sizeBytes: pdfBuffer.length,
      autoDispatched,
    });
  } catch (error: any) {
    console.error("[API /api/oracle-orders/upload-pdf] Exception:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to upload Onyx PDF" },
      { status: 500 }
    );
  }
}
