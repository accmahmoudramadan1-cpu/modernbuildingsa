import { NextRequest, NextResponse } from "next/server";
import {
  sendWhatsAppTemplate,
  sendWhatsAppMessage,
  formatPhoneNumber,
} from "@/lib/whatsapp";
import { updateInvoiceWhatsAppStatus } from "@/lib/oracle-invoices";
import { lookupOracleInvoiceWithPdf } from "@/lib/whatsapp-inbox";
import {
  extractTemplateParameters,
  formatTemplatePreviewText,
  getOnyxTemplate,
  type OnyxDocType,
} from "@/lib/onyx-templates";
import { getWhatsAppSession } from "@/lib/whatsapp-auth";
import { getAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/whatsapp/send-invoice
 * Dispatches either an approved WhatsApp Utility Template or Direct Text
 * using any of the 8 Onyx Pro ERP document templates.
 */
export async function POST(request: NextRequest) {
  const [waSession, adminSession] = await Promise.all([
    getWhatsAppSession(),
    getAdminSession(),
  ]);
  if (!waSession && !adminSession) {
    return NextResponse.json(
      { success: false, error: "غير مصرح: يرجى تسجيل الدخول أولاً." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    const {
      invoiceNumber,
      phone,
      customerName,
      amount,
      invoiceDate,
      currency = "ر.س",
      remainingBalance,
      paymentMethod,
      details,
      docType = "cash_invoice",
      sendMode = "template", // "template" | "text"
      templateName,
      languageCode = process.env.WHATSAPP_INVOICE_TEMPLATE_LANG || "ar",
      customParameters,
      headerUrl,
    } = body;

    if (!invoiceNumber || !phone) {
      return NextResponse.json(
        { success: false, error: "رقم المستند ورقم الهاتف حقول مطلوبة." },
        { status: 400 }
      );
    }

    const templateDef = getOnyxTemplate(docType);
    const resolvedDocType: OnyxDocType = templateDef.id;
    const resolvedTemplateName =
      (templateName && String(templateName).trim()) ||
      templateDef.defaultMetaTemplateName ||
      process.env.WHATSAPP_INVOICE_TEMPLATE_NAME ||
      "invoice_utility";

    // Authoritative Onyx DB enforcement: lock to the invoice's real doc_type & resolve PDF automatically
    const authoritativeInvoice = await lookupOracleInvoiceWithPdf(String(invoiceNumber));
    if (authoritativeInvoice) {
      const expectedDef = getOnyxTemplate(authoritativeInvoice.doc_type);
      if (resolvedDocType !== expectedDef.id) {
        return NextResponse.json(
          {
            success: false,
            error: `مرفوض: المستند رقم (${invoiceNumber}) نوعه (${expectedDef.label}) فقط، ولا يمكن إرساله بقالب (${templateDef.label}).`,
          },
          { status: 400 }
        );
      }
      if (
        sendMode === "template" &&
        resolvedTemplateName !== expectedDef.defaultMetaTemplateName
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `مرفوض: اسم القالب في Meta للمستند رقم (${invoiceNumber}) يجب أن يكون (${expectedDef.defaultMetaTemplateName}) فقط.`,
          },
          { status: 400 }
        );
      }
    }

    const effectiveHeaderUrl =
      (headerUrl && String(headerUrl).trim()) ||
      authoritativeInvoice?.attachment_url ||
      undefined;
    const effectiveCustomerName =
      (customerName && String(customerName).trim()) ||
      authoritativeInvoice?.customer_name ||
      undefined;

    const bodyParameters: string[] =
      Array.isArray(customParameters) && customParameters.length > 0
        ? customParameters.map((p: any) => String(p ?? "").trim())
        : extractTemplateParameters(resolvedDocType, {
            invoice_number: String(invoiceNumber),
            customer_name: customerName || "عميلنا العزيز",
            phone: String(phone),
            invoice_date: invoiceDate || new Date().toISOString().split("T")[0],
            amount: amount ?? "0",
            currency,
            remaining_balance: remainingBalance,
            payment_method: paymentMethod,
            details,
            doc_type: resolvedDocType,
          });

    let result: { success: boolean; messageId?: string; error?: any; details?: any };

    if (sendMode === "text") {
      let fullText = formatTemplatePreviewText(resolvedDocType, bodyParameters);
      if (effectiveHeaderUrl) {
        fullText += `\n\nرابط المرفق:\n${effectiveHeaderUrl}`;
      }
      result = await sendWhatsAppMessage(phone, fullText, {
        customerName: effectiveCustomerName,
      });
    } else {
      const publicBaseUrl =
        process.env.NEXT_PUBLIC_SITE_URL || "https://www.modernbuildingsa.com";
      const fallbackPdfUrl = `${publicBaseUrl}/api/whatsapp/invoice-pdf?invoiceNumber=${encodeURIComponent(
        String(invoiceNumber)
      )}`;

      result = await sendWhatsAppTemplate({
        to: phone,
        templateName: resolvedTemplateName,
        languageCode,
        bodyParameters,
        headerUrl: effectiveHeaderUrl,
        fallbackPdfUrl,
        documentFilename: `ModernBuilding_${String(invoiceNumber).replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`,
        customerName: effectiveCustomerName,
        previewText: formatTemplatePreviewText(resolvedDocType, bodyParameters),
      });
    }

    if (result.success) {
      await updateInvoiceWhatsAppStatus({
        invoiceNumber,
        status: "sent",
        messageId: result.messageId,
      });

      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        recipient: formatPhoneNumber(phone),
        docType: resolvedDocType,
        sendMode,
        message: `تم إرسال (${templateDef.label}) عبر واتساب بنجاح.`,
      });
    } else {
      await updateInvoiceWhatsAppStatus({
        invoiceNumber,
        status: "failed",
      });

      const errorMessage =
        typeof result.error === "string"
          ? result.error
          : result.error?.error?.message ||
            result.error?.message ||
            "فشل إرسال رسالة الواتساب عبر مزود الخدمة.";

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          details: result,
        },
        { status: 502 }
      );
    }
  } catch (error: any) {
    console.error("[API /api/whatsapp/send-invoice] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "حدث خطأ غير متوقع أثناء إرسال المستند.",
      },
      { status: 500 }
    );
  }
}
