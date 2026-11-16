import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppSession } from "@/lib/whatsapp-auth";
import {
  deleteConversation,
  deleteSelectedMessages,
  getConversationDetail,
  getInboxConversations,
  getRecentOnyxPdfInvoices,
  lookupOracleInvoiceWithPdf,
} from "@/lib/whatsapp-inbox";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getWhatsAppSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "يرجى تسجيل الدخول للوصول إلى صندوق الوارد." },
      { status: 401 }
    );
  }

  try {
    const lookupInvoice = request.nextUrl.searchParams.get("lookupInvoice");
    if (lookupInvoice !== null) {
      const invoice = await lookupOracleInvoiceWithPdf(lookupInvoice);
      return NextResponse.json({
        success: true,
        invoice,
      });
    }

    if (request.nextUrl.searchParams.get("pdfInvoices") === "1") {
      const invoices = await getRecentOnyxPdfInvoices(25);
      return NextResponse.json({
        success: true,
        invoices,
      });
    }

    const phone = request.nextUrl.searchParams.get("phone");
    const search = request.nextUrl.searchParams.get("q") || undefined;

    if (phone) {
      const detail = await getConversationDetail(phone);
      return NextResponse.json({
        success: true,
        ...detail,
      });
    }

    const conversations = await getInboxConversations(search);
    return NextResponse.json({
      success: true,
      conversations,
    });
  } catch (err: any) {
    console.error("[API /api/whatsapp/inbox GET] Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to load inbox" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getWhatsAppSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "غير مصرح" },
      { status: 401 }
    );
  }

  try {
    const phoneParam = request.nextUrl.searchParams.get("phone");
    let body: any = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }

    const phone = body?.phone || phoneParam;
    const messageIds = Array.isArray(body?.messageIds) ? body.messageIds : null;

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "رقم الهاتف مطلوب." },
        { status: 400 }
      );
    }

    if (messageIds && messageIds.length > 0) {
      await deleteSelectedMessages(phone, messageIds.map(String));
    } else {
      await deleteConversation(phone);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[API /api/whatsapp/inbox DELETE] Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to delete" },
      { status: 500 }
    );
  }
}
