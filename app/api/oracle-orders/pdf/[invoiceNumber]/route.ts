import { NextRequest } from "next/server";
import { getRepairedOnyxPdf } from "@/lib/oracle-pdfs";

export const dynamic = "force-dynamic";

/**
 * GET /api/oracle-orders/pdf/[invoiceNumber]
 * Serves stored Onyx Pro PDF binaries from Hostinger MySQL to Meta WhatsApp Cloud API or browsers.
 */
async function buildPdfResponse(
  invoiceNumber: string,
  includeBody: boolean
): Promise<Response> {
  const decodedInvoice = decodeURIComponent(invoiceNumber || "").trim();
  if (!decodedInvoice) {
    return new Response(includeBody ? "PDF Not Found" : null, { status: 404 });
  }

  try {
    const pdf = await getRepairedOnyxPdf(decodedInvoice);
    if (!pdf) {
      return new Response(includeBody ? "PDF Not Found" : null, { status: 404 });
    }

    return new Response(includeBody ? new Uint8Array(pdf.buffer) : null, {
      status: 200,
      headers: {
        "Content-Type": pdf.mimeType,
        "Content-Length": String(pdf.buffer.length),
        "Accept-Ranges": "bytes",
        "Content-Disposition": `inline; filename="${pdf.filename}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[API /api/oracle-orders/pdf] Error:", err);
    return new Response(includeBody ? "Internal Server Error" : null, {
      status: 500,
    });
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ invoiceNumber: string }> }
) {
  const { invoiceNumber } = await context.params;
  return buildPdfResponse(invoiceNumber, true);
}

export async function HEAD(
  _request: NextRequest,
  context: { params: Promise<{ invoiceNumber: string }> }
) {
  const { invoiceNumber } = await context.params;
  return buildPdfResponse(invoiceNumber, false);
}
