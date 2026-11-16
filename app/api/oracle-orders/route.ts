import { NextRequest, NextResponse } from "next/server";
import {
  getOracleInvoices,
  upsertOracleInvoices,
  updateInvoiceWhatsAppStatus,
} from "@/lib/oracle-invoices";
import { sendWhatsAppTemplate, formatPhoneNumber } from "@/lib/whatsapp";
import { extractTemplateParameters, getOnyxTemplate } from "@/lib/onyx-templates";

export const dynamic = "force-dynamic";

function isWithinRecentDays(dateStr: string | undefined | null, maxDays: number): boolean {
  if (!dateStr) return true;
  const parsed = Date.parse(dateStr);
  if (Number.isNaN(parsed)) return false;
  // Allow +1 day buffer for timezone ahead of UTC (e.g. KSA UTC+3)
  const diffMs = Date.now() - parsed;
  return diffMs <= maxDays * 86400 * 1000 && diffMs >= -2 * 86400 * 1000;
}

/**
 * GET /api/oracle-orders
 * Fetches all invoices imported from Oracle (OraNT)
 */
export async function GET() {
  try {
    const invoices = await getOracleInvoices();
    return NextResponse.json({
      success: true,
      count: invoices.length,
      invoices,
    });
  } catch (error: any) {
    console.error("[API /api/oracle-orders GET] Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load invoices" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/oracle-orders
 * Endpoint called by the external Python script on the OraNT machine to push invoices.
 * Authenticated via Bearer token: ORACLE_SYNC_API_KEY
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify Authentication Token
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

    // 2. Parse Incoming Invoices
    const body = await request.json();
    let invoicesToInsert: any[] = [];

    if (Array.isArray(body)) {
      invoicesToInsert = body;
    } else if (body && Array.isArray(body.invoices)) {
      invoicesToInsert = body.invoices;
    } else if (body && typeof body === "object") {
      invoicesToInsert = [body];
    }

    if (invoicesToInsert.length === 0) {
      return NextResponse.json(
        { success: false, error: "No invoice records provided in request body." },
        { status: 400 }
      );
    }

    // 3. Upsert into Storage
    const result = await upsertOracleInvoices(invoicesToInsert);

    // 4. Automatic WhatsApp dispatch for newly recorded Onyx Pro operations
    const autoSendEnabled = process.env.WHATSAPP_AUTO_SEND_ENABLED !== "false";
    let autoSentCount = 0;
    let autoFailedCount = 0;

    if (autoSendEnabled && result.newlyInserted.length > 0) {
      const isBulkDump = result.newlyInserted.length > 15;
      const eligibleDocs = result.newlyInserted.filter((doc) => {
        if (doc.status !== "pending") return false;
        const formattedPhone = formatPhoneNumber(doc.phone);
        if (!formattedPhone || formattedPhone.length < 9) return false;

        const isAlrtt002 = doc.onyx_form_code === "ALRTT002";
        const isRecent = isWithinRecentDays(doc.invoice_date, 3);

        if (isBulkDump) {
          // On large initial sync dumps, only auto-send recent ALRTT002 alerts to prevent blasting old history
          return isAlrtt002 && isRecent;
        }
        return isRecent || isAlrtt002;
      });

      const publicBaseUrl =
        process.env.NEXT_PUBLIC_SITE_URL || "https://www.modernbuildingsa.com";
      const languageCode = process.env.WHATSAPP_INVOICE_TEMPLATE_LANG || "ar";

      for (const doc of eligibleDocs) {
        try {
          const templateDef = getOnyxTemplate(doc.doc_type);
          const bodyParameters = extractTemplateParameters(templateDef.id, doc);
          const fallbackPdfUrl = `${publicBaseUrl}/api/whatsapp/invoice-pdf?invoiceNumber=${encodeURIComponent(
            doc.invoice_number
          )}`;

          const sendRes = await sendWhatsAppTemplate({
            to: doc.phone,
            templateName: templateDef.defaultMetaTemplateName,
            languageCode,
            bodyParameters,
            headerUrl: doc.attachment_url || undefined,
            fallbackPdfUrl,
            documentFilename: `ModernBuilding_${doc.invoice_number.replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`,
          });

          await updateInvoiceWhatsAppStatus({
            invoiceNumber: doc.invoice_number,
            status: sendRes.success ? "sent" : "failed",
            messageId: sendRes.messageId,
          });

          if (sendRes.success) {
            autoSentCount += 1;
          } else {
            autoFailedCount += 1;
            console.warn(
              `[API /api/oracle-orders AUTO-SEND] Failed for ${doc.invoice_number}:`,
              sendRes.error
            );
          }
        } catch (dispatchErr: any) {
          autoFailedCount += 1;
          console.error(
            `[API /api/oracle-orders AUTO-SEND] Exception for ${doc.invoice_number}:`,
            dispatchErr?.message || dispatchErr
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${result.count} invoice(s) from OraNT.`,
      syncedCount: result.count,
      newlyInsertedCount: result.newlyInserted.length,
      autoSentCount,
      autoFailedCount,
    });
  } catch (error: any) {
    console.error("[API /api/oracle-orders POST] Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to process invoices" },
      { status: 500 }
    );
  }
}
