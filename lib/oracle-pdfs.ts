import { isMysqlConfigured, queryRows } from "@/lib/mysql";
import { repairOnyxPdfFonts } from "@/lib/fix-onyx-pdf";

export interface RepairedOnyxPdf {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

/**
 * Extracts the decoded invoice/document number from an internal `/api/oracle-orders/pdf/<id>` URL.
 */
export function extractOraclePdfInvoiceNumber(rawUrl: string): string | null {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) return null;

  try {
    const pathname = trimmed.startsWith("/")
      ? trimmed.split("?")[0]
      : new URL(trimmed).pathname;
    const prefix = "/api/oracle-orders/pdf/";
    const idx = pathname.indexOf(prefix);
    if (idx === -1) return null;

    const rest = pathname.slice(idx + prefix.length).replace(/\/+$/, "");
    if (!rest) return null;

    const decoded = decodeURIComponent(rest).trim();
    return decoded || null;
  } catch {
    return null;
  }
}

/**
 * Fetches an Onyx PDF binary from MySQL `oracle_pdfs`, repairs embedded font encoding,
 * and returns a normalized Buffer and sanitized filename.
 */
export async function getRepairedOnyxPdf(
  invoiceNumber: string
): Promise<RepairedOnyxPdf | null> {
  const decodedInvoice = String(invoiceNumber || "").trim();
  if (!decodedInvoice || !isMysqlConfigured()) {
    return null;
  }

  const rows = await queryRows<any>(
    `SELECT filename, mime_type, pdf_data FROM oracle_pdfs WHERE invoice_number = ? LIMIT 1`,
    [decodedInvoice]
  );

  if (!rows.length || !rows[0].pdf_data) {
    return null;
  }

  const row = rows[0];
  const rawBuf = Buffer.isBuffer(row.pdf_data)
    ? row.pdf_data
    : Buffer.from(row.pdf_data);
  if (!rawBuf.length) {
    return null;
  }

  const buffer = repairOnyxPdfFonts(rawBuf);
  const filename = String(row.filename || `${decodedInvoice}.pdf`).replace(
    /[^A-Za-z0-9_.-]/g,
    "_"
  );
  const mimeType =
    String(row.mime_type || "application/pdf").trim() || "application/pdf";

  return { buffer, filename, mimeType };
}
