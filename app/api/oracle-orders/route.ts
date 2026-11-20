import { NextRequest, NextResponse } from "next/server";
import { getOracleInvoices, upsertOracleInvoices } from "@/lib/oracle-invoices";
import { autoDispatchOracleInvoice, isAutoSendEligible } from "@/lib/oracle-autosend";
import { getWhatsAppSession } from "@/lib/whatsapp-auth";
import { getAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/oracle-orders
 * Fetches all invoices imported from Oracle (OraNT)
 */
export async function GET() {
  const [waSession, adminSession] = await Promise.all([
    getWhatsAppSession(),
    getAdminSession(),
  ]);
  if (!waSession && !adminSession) {
    return NextResponse.json(
      { success: false, error: "يرجى تسجيل الدخول للوصول إلى بوابة الواتساب." },
      { status: 401 }
    );
  }

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
    const autoSentNumbers: string[] = [];

    if (autoSendEnabled && result.newlyInserted.length > 0) {
      const nonSuppressed = result.newlyInserted.filter(
        (doc) => !result.suppressAutoSendNumbers.has(doc.invoice_number)
      );
      const isBulkDump = nonSuppressed.length > 15;
      const eligibleDocs = nonSuppressed.filter((doc) => {
        const forceAutoSend = result.forceAutoSendNumbers.has(doc.invoice_number);
        if (!isAutoSendEligible(doc, { forceAutoSend })) return false;
        if (isBulkDump) {
          return doc.onyx_form_code === "ALRTT002" || forceAutoSend;
        }
        return true;
      });

      for (const doc of eligibleDocs) {
        try {
          const dispatch = await autoDispatchOracleInvoice(doc);
          if (dispatch.outcome === "sent") {
            autoSentCount += 1;
            autoSentNumbers.push(doc.invoice_number);
          } else if (dispatch.outcome === "failed") {
            autoFailedCount += 1;
            console.warn(
              `[API /api/oracle-orders AUTO-SEND] Failed for ${doc.invoice_number}:`,
              dispatch.error
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
      autoSentNumbers,
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
