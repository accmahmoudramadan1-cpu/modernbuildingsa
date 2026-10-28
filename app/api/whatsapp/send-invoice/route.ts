import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppTemplate, formatPhoneNumber } from "@/lib/whatsapp";
import { updateInvoiceWhatsAppStatus } from "@/lib/oracle-invoices";

export const dynamic = "force-dynamic";

/**
 * POST /api/whatsapp/send-invoice
 * Dispatches an approved WhatsApp Utility Template for an invoice imported from OraNT.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      invoiceNumber,
      phone,
      customerName,
      amount,
      invoiceDate,
      currency = "ر.س",
      templateName = process.env.WHATSAPP_INVOICE_TEMPLATE_NAME || "invoice_utility",
      languageCode = process.env.WHATSAPP_INVOICE_TEMPLATE_LANG || "ar",
      customParameters,
      headerUrl,
    } = body;

    if (!invoiceNumber || !phone) {
      return NextResponse.json(
        { success: false, error: "رقم الفاتورة ورقم الهاتف حقول مطلوبة." },
        { status: 400 }
      );
    }

    // Default parameters for standard invoice template:
    // {{1}} = Customer Name
    // {{2}} = Invoice Number
    // {{3}} = Amount + Currency
    // {{4}} = Date
    const bodyParameters: string[] =
      Array.isArray(customParameters) && customParameters.length > 0
        ? customParameters
        : [
            customerName || "عميلنا العزيز",
            String(invoiceNumber),
            `${amount || "0"} ${currency}`,
            invoiceDate || new Date().toISOString().split("T")[0],
          ];

    // Dispatch via Meta WhatsApp Cloud API
    const result = await sendWhatsAppTemplate({
      to: phone,
      templateName,
      languageCode,
      bodyParameters,
      headerUrl,
    });

    if (result.success) {
      // Update status in storage/database
      await updateInvoiceWhatsAppStatus({
        invoiceNumber,
        status: "sent",
        messageId: result.messageId,
      });

      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        recipient: formatPhoneNumber(phone),
        message: "تم إرسال إشعار الفاتورة عبر واتساب بنجاح.",
      });
    } else {
      // Record failure
      await updateInvoiceWhatsAppStatus({
        invoiceNumber,
        status: "failed",
      });

      return NextResponse.json(
        {
          success: false,
          error: result.error || "فشل إرسال رسالة الواتساب عبر مزود الخدمة.",
          details: result,
        },
        { status: 502 }
      );
    }
  } catch (error: any) {
    console.error("[API /api/whatsapp/send-invoice] Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "حدث خطأ غير متوقع أثناء إرسال الفاتورة." },
      { status: 500 }
    );
  }
}
