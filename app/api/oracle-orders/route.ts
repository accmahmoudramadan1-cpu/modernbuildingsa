import { NextRequest, NextResponse } from "next/server";
import { getOracleInvoices, upsertOracleInvoices } from "@/lib/oracle-invoices";

export const dynamic = "force-dynamic";

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

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${result.count} invoice(s) from OraNT.`,
      syncedCount: result.count,
    });
  } catch (error: any) {
    console.error("[API /api/oracle-orders POST] Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to process invoices" },
      { status: 500 }
    );
  }
}
