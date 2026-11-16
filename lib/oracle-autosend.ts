import {
  extractTemplateParameters,
  formatTemplatePreviewText,
  getOnyxTemplate,
  type OnyxDocType,
} from "@/lib/onyx-templates";
import { updateInvoiceWhatsAppStatus } from "@/lib/oracle-invoices";
import { formatPhoneNumber, sendWhatsAppTemplate } from "@/lib/whatsapp";
import { lookupOracleInvoiceWithPdf } from "@/lib/whatsapp-inbox";

export interface AutoSendCandidate {
  invoice_number: string;
  doc_type: OnyxDocType | string;
  customer_name: string;
  phone: string;
  invoice_date: string;
  amount: number | string;
  currency?: string;
  remaining_balance?: number | string | null;
  payment_method?: string | null;
  attachment_url?: string | null;
  onyx_form_code?: string | null;
  details?: string;
  status: string;
}

export function isWithinRecentDays(
  dateStr: string | undefined | null,
  maxDays: number
): boolean {
  if (!dateStr) return true;
  const parsed = Date.parse(dateStr);
  if (Number.isNaN(parsed)) return false;
  // Allow +2 days buffer for timezone ahead of UTC (e.g. KSA UTC+3)
  const diffMs = Date.now() - parsed;
  return diffMs <= maxDays * 86400 * 1000 && diffMs >= -2 * 86400 * 1000;
}

export function isAutoSendEligible(doc: AutoSendCandidate): boolean {
  if (process.env.WHATSAPP_AUTO_SEND_ENABLED === "false") return false;
  if (doc.status !== "pending") return false;
  // Purchase orders must NEVER be auto-sent; user triggers them manually in the portal
  if (doc.doc_type === "purchase_order") return false;

  const formattedPhone = formatPhoneNumber(doc.phone);
  if (!formattedPhone || formattedPhone.length < 9) return false;

  const isAlrtt002 = doc.onyx_form_code === "ALRTT002";
  return isWithinRecentDays(doc.invoice_date, 3) || isAlrtt002;
}

/**
 * Dispatches an eligible Onyx document using ONLY its authentic exported Onyx PDF.
 * Never falls back to fabricated placeholder PDFs; holds document as 'pending' if PDF isn't ready yet.
 */
export async function autoDispatchOracleInvoice(doc: AutoSendCandidate): Promise<{
  outcome: "sent" | "failed" | "waiting_pdf";
  messageId?: string;
  error?: string;
}> {
  const templateDef = getOnyxTemplate(doc.doc_type);
  const requiresOnyxPdf = templateDef.hasAttachment && doc.doc_type !== "direct_alert";

  let resolvedPdfUrl = doc.attachment_url ? String(doc.attachment_url).trim() : "";
  if (!resolvedPdfUrl && requiresOnyxPdf) {
    const dbMatch = await lookupOracleInvoiceWithPdf(doc.invoice_number);
    if (dbMatch?.attachment_url) {
      resolvedPdfUrl = dbMatch.attachment_url;
    }
  }

  // Wait for authentic Onyx PDF rather than sending without attachment or using placeholder PDFs
  if (requiresOnyxPdf && !resolvedPdfUrl) {
    return { outcome: "waiting_pdf" };
  }

  const languageCode = process.env.WHATSAPP_INVOICE_TEMPLATE_LANG || "ar";
  const normalizedDoc = { ...doc, doc_type: templateDef.id };
  const bodyParameters = extractTemplateParameters(templateDef.id, normalizedDoc);

  const sendRes = await sendWhatsAppTemplate({
    to: doc.phone,
    templateName: templateDef.defaultMetaTemplateName,
    languageCode,
    bodyParameters,
    headerUrl: resolvedPdfUrl || undefined,
    documentFilename: `ModernBuilding_${doc.invoice_number.replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`,
    customerName: doc.customer_name,
    previewText: formatTemplatePreviewText(templateDef.id, bodyParameters),
  });

  await updateInvoiceWhatsAppStatus({
    invoiceNumber: doc.invoice_number,
    status: sendRes.success ? "sent" : "failed",
    messageId: sendRes.messageId,
  });

  if (sendRes.success) {
    return { outcome: "sent", messageId: sendRes.messageId };
  }

  return {
    outcome: "failed",
    error: typeof sendRes.error === "string" ? sendRes.error : JSON.stringify(sendRes.error),
  };
}
