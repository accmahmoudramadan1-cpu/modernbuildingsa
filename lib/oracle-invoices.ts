import { createClient as createSupabaseServerClient } from "@/lib/supabase-server";
import type { OnyxDocType } from "@/lib/onyx-templates";

export interface OracleInvoice {
  id: string;
  invoice_number: string;
  doc_type: OnyxDocType;
  customer_code?: string | null;
  customer_name: string;
  phone: string;
  invoice_date: string;
  amount: number | string;
  currency: string;
  remaining_balance?: number | string | null;
  payment_method?: string | null;
  attachment_url?: string | null;
  onyx_form_code?: string | null;
  details?: string;
  status: "pending" | "sent" | "failed";
  whatsapp_message_id?: string | null;
  sent_at?: string | null;
  created_at: string;
  updated_at?: string;
}

const todayStr = new Date().toISOString().split("T")[0];

// In-memory fallback cache (used when Supabase table is not yet created or credentials missing)
let memoryInvoicesCache: OracleInvoice[] = [
  {
    id: "sample-arst045-1",
    invoice_number: "2601003076",
    doc_type: "customer_discount_notice",
    customer_code: "70714",
    customer_name: "قاسم حسن المؤيد",
    phone: "0554303422",
    invoice_date: "2026-11-09",
    amount: "197.48",
    currency: "ر.س",
    remaining_balance: "3473.02",
    payment_method: "خصم إضافي - خصم سداد",
    onyx_form_code: "ARST045",
    details: "خصم سداد (إشعارات العملاء المتعدد) - شاشة ARST045",
    status: "pending",
    whatsapp_message_id: null,
    sent_at: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "sample-alrtt002-1",
    invoice_number: "ALRT-10-702",
    doc_type: "account_statement",
    customer_code: "702",
    customer_name: "امين عيظة العكة",
    phone: "0557653323",
    invoice_date: "2026-11-11",
    amount: "338.88",
    currency: "ر.س",
    remaining_balance: "338.88",
    onyx_form_code: "ALRTT002",
    details: "كشف مطابقة رصيد - رسالة رقم 10 (شاشة الرسائل المباشرة ALRTT002)",
    status: "pending",
    whatsapp_message_id: null,
    sent_at: null,
    created_at: new Date(Date.now() - 1200000).toISOString(),
  },
  {
    id: "sample-alrtt002-2",
    invoice_number: "ALRT-10-703",
    doc_type: "direct_alert",
    customer_code: "703",
    customer_name: "مؤسسة المصباح المميز التجارية",
    phone: "0550408666",
    invoice_date: "2026-11-11",
    amount: "5283.08",
    currency: "ر.س",
    remaining_balance: "5283.08",
    onyx_form_code: "ALRTT002",
    details: "برجاء سداد المبالغ المستحقة - البناء الحديث",
    status: "pending",
    whatsapp_message_id: null,
    sent_at: null,
    created_at: new Date(Date.now() - 2400000).toISOString(),
  },
  {
    id: "sample-cash-1",
    invoice_number: "2601018135",
    doc_type: "cash_invoice",
    customer_code: "1001",
    customer_name: "مؤسسة البناء الحديث للمقاولات",
    phone: "0554303422",
    invoice_date: todayStr,
    amount: "3456.66",
    currency: "ر.س",
    remaining_balance: "0.00",
    payment_method: "نقداً",
    onyx_form_code: "SI-CASH",
    details: "فاتورة مبيعات نقدية - توريد مواد عزل وتشطيبات",
    status: "pending",
    whatsapp_message_id: null,
    sent_at: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "sample-credit-1",
    invoice_number: "2601018702",
    doc_type: "credit_invoice",
    customer_code: "705",
    customer_name: "يحيى عبدالله دكام الشريف",
    phone: "0505726500",
    invoice_date: todayStr,
    amount: "2026.09",
    currency: "ر.س",
    remaining_balance: "8951.57",
    payment_method: "آجل",
    onyx_form_code: "SI-CREDIT",
    details: "فاتورة مبيعات آجلة - سيراميك ومواد سباكة",
    status: "pending",
    whatsapp_message_id: null,
    sent_at: null,
    created_at: new Date(Date.now() - 4800000).toISOString(),
  },
  {
    id: "sample-rv-1",
    invoice_number: "RV-2026-412",
    doc_type: "receipt_voucher",
    customer_code: "7023",
    customer_name: "محمد العباسي",
    phone: "0554783338",
    invoice_date: todayStr,
    amount: "1500.00",
    currency: "ر.س",
    remaining_balance: "911.49",
    payment_method: "تحويل بنكي",
    onyx_form_code: "RV",
    details: "سند قبض سداد من الحساب الآجل",
    status: "pending",
    whatsapp_message_id: null,
    sent_at: null,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "sample-qt-1",
    invoice_number: "QT-2026-104",
    doc_type: "price_quotation",
    customer_code: "7047",
    customer_name: "عبدالله يحيى صوان",
    phone: "0557993232",
    invoice_date: todayStr,
    amount: "14500.00",
    currency: "ر.س",
    onyx_form_code: "QT",
    details: "عرض سعر توريد دهانات وأدوات كهربائية",
    status: "pending",
    whatsapp_message_id: null,
    sent_at: null,
    created_at: new Date(Date.now() - 10800000).toISOString(),
  },
  {
    id: "sample-po-1",
    invoice_number: "PO-2026-552",
    doc_type: "purchase_order",
    customer_code: "SUP-204",
    customer_name: "شركة مصانع الدهانات الوطنية",
    phone: "0501960009",
    invoice_date: todayStr,
    amount: "22400.00",
    currency: "ر.س",
    onyx_form_code: "PO",
    details: "طلب شراء أصناف دهانات خارجية وبرايمر",
    status: "sent",
    whatsapp_message_id: "wamid.SAMPLE_ID_PO_12345",
    sent_at: new Date(Date.now() - 40000000).toISOString(),
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

/**
 * Get all imported Oracle documents/invoices
 */
export async function getOracleInvoices(): Promise<OracleInvoice[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("oracle_invoices")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((row: any) => ({
        ...row,
        doc_type: (row.doc_type || "cash_invoice") as OnyxDocType,
      })) as OracleInvoice[];
    }
  } catch (err) {
    console.warn("[OracleInvoices] Supabase query skipped or failed, using memory cache.");
  }

  return memoryInvoicesCache;
}

/**
 * Upsert documents/invoices imported from Oracle (OraNT / Onyx Pro)
 */
export async function upsertOracleInvoices(
  incomingInvoices: Partial<OracleInvoice>[]
): Promise<{ success: boolean; count: number; error?: string }> {
  if (!Array.isArray(incomingInvoices) || incomingInvoices.length === 0) {
    return { success: true, count: 0 };
  }

  const now = new Date().toISOString();
  const formatted: OracleInvoice[] = incomingInvoices.map((item, idx) => ({
    id: item.id || `ora-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
    invoice_number: String(item.invoice_number || "").trim() || `DOC-${Date.now()}-${idx}`,
    doc_type: (item.doc_type || "cash_invoice") as OnyxDocType,
    customer_code: item.customer_code ? String(item.customer_code).trim() : null,
    customer_name: String(item.customer_name || "عميل غير محدد").trim(),
    phone: String(item.phone || "").trim(),
    invoice_date: item.invoice_date || now.split("T")[0],
    amount: item.amount ?? 0,
    currency: item.currency || "ر.س",
    remaining_balance:
      item.remaining_balance !== undefined && item.remaining_balance !== null
        ? item.remaining_balance
        : null,
    payment_method: item.payment_method ? String(item.payment_method).trim() : null,
    attachment_url: item.attachment_url ? String(item.attachment_url).trim() : null,
    onyx_form_code: item.onyx_form_code ? String(item.onyx_form_code).trim() : null,
    details: item.details || "",
    status: item.status || "pending",
    whatsapp_message_id: item.whatsapp_message_id || null,
    sent_at: item.sent_at || null,
    created_at: item.created_at || now,
    updated_at: now,
  }));

  // Try saving to Supabase first
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("oracle_invoices")
      .upsert(formatted, { onConflict: "invoice_number" });

    if (!error) {
      for (const item of formatted) {
        const existingIdx = memoryInvoicesCache.findIndex(
          (x) => x.invoice_number === item.invoice_number
        );
        if (existingIdx >= 0) {
          memoryInvoicesCache[existingIdx] = { ...memoryInvoicesCache[existingIdx], ...item };
        } else {
          memoryInvoicesCache.unshift(item);
        }
      }
      return { success: true, count: formatted.length };
    }
  } catch (err: any) {
    console.warn("[OracleInvoices] Supabase upsert error, falling back to memory:", err?.message);
  }

  // Update memory cache
  for (const item of formatted) {
    const existingIdx = memoryInvoicesCache.findIndex(
      (x) => x.invoice_number === item.invoice_number
    );
    if (existingIdx >= 0) {
      memoryInvoicesCache[existingIdx] = { ...memoryInvoicesCache[existingIdx], ...item };
    } else {
      memoryInvoicesCache.unshift(item);
    }
  }

  return { success: true, count: formatted.length };
}

/**
 * Update invoice/document status after sending WhatsApp message
 */
export async function updateInvoiceWhatsAppStatus({
  invoiceNumber,
  status,
  messageId,
}: {
  invoiceNumber: string;
  status: "sent" | "failed" | "pending";
  messageId?: string;
}): Promise<boolean> {
  const now = new Date().toISOString();

  // Try updating in Supabase
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("oracle_invoices")
      .update({
        status,
        whatsapp_message_id: messageId || null,
        sent_at: status === "sent" ? now : null,
        updated_at: now,
      })
      .eq("invoice_number", invoiceNumber);

    if (!error) {
      const item = memoryInvoicesCache.find((x) => x.invoice_number === invoiceNumber);
      if (item) {
        item.status = status;
        item.whatsapp_message_id = messageId || null;
        item.sent_at = status === "sent" ? now : null;
      }
      return true;
    }
  } catch (err) {
    console.warn("[OracleInvoices] Supabase update status error, updating memory cache only.");
  }

  // Update memory cache
  const item = memoryInvoicesCache.find((x) => x.invoice_number === invoiceNumber);
  if (item) {
    item.status = status;
    item.whatsapp_message_id = messageId || null;
    item.sent_at = status === "sent" ? now : null;
    return true;
  }

  return false;
}
