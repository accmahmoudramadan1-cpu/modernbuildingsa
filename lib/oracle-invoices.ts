import crypto from "crypto";
import { executeSql, isMysqlConfigured, queryRows } from "@/lib/mysql";
import { normalizePaymentMethod, type OnyxDocType } from "@/lib/onyx-templates";

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

function toMysqlDateTime(isoOrDate?: string | null): string {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  const valid = Number.isNaN(d.getTime()) ? new Date() : d;
  return valid.toISOString().slice(0, 23).replace("T", " ");
}

/**
 * Get all imported Oracle documents/invoices
 */
export async function getOracleInvoices(): Promise<OracleInvoice[]> {
  if (isMysqlConfigured()) {
    try {
      const publicBase =
        (process.env.NEXT_PUBLIC_SITE_URL || "https://www.modernbuildingsa.com").replace(/\/+$/, "");
      const rows = await queryRows<any>(
        `SELECT o.id, o.invoice_number, o.doc_type, o.customer_code, o.customer_name, o.phone,
                o.invoice_date, o.amount, o.currency, o.remaining_balance, o.payment_method,
                o.attachment_url, o.onyx_form_code, o.details, o.status, o.whatsapp_message_id,
                o.sent_at, o.created_at, o.updated_at,
                (p.invoice_number IS NOT NULL) AS has_pdf_blob
         FROM oracle_invoices o
         LEFT JOIN oracle_pdfs p ON p.invoice_number = o.invoice_number
         ORDER BY o.created_at DESC`
      );
      if (rows.length > 0) {
        return rows.map((row: any) => {
          const invNum = String(row.invoice_number || "").trim();
          const explicitUrl = row.attachment_url ? String(row.attachment_url).trim() : "";
          const resolvedUrl =
            explicitUrl ||
            (Number(row.has_pdf_blob || 0) && invNum
              ? `${publicBase}/api/oracle-orders/pdf/${encodeURIComponent(invNum)}`
              : null);
          return {
            ...row,
            attachment_url: resolvedUrl,
            amount: Number(row.amount ?? 0),
            remaining_balance:
              row.remaining_balance !== null && row.remaining_balance !== undefined
                ? Number(row.remaining_balance)
                : null,
            doc_type: (row.doc_type || "cash_invoice") as OnyxDocType,
            payment_method: normalizePaymentMethod(row.payment_method),
          };
        }) as OracleInvoice[];
      }
      return [];
    } catch (err) {
      console.warn("[OracleInvoices] MySQL query failed, using memory cache:", err);
    }
  }

  return memoryInvoicesCache.map((row) => ({
    ...row,
    payment_method: normalizePaymentMethod(row.payment_method),
  }));
}

function sanitizeNumeric(val: unknown, fallback: number): number;
function sanitizeNumeric(val: unknown, fallback: null): number | null;
function sanitizeNumeric(val: unknown, fallback: number | null): number | null {
  if (val === undefined || val === null || String(val).trim() === "") {
    return fallback;
  }
  const num = Number(String(val).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(num) ? num : fallback;
}

/**
 * Upsert documents/invoices imported from Oracle (OraNT / Onyx Pro)
 */
export async function upsertOracleInvoices(
  incomingInvoices: Partial<OracleInvoice>[]
): Promise<{
  success: boolean;
  count: number;
  newlyInserted: OracleInvoice[];
  forceAutoSendNumbers: Set<string>;
  suppressAutoSendNumbers: Set<string>;
  error?: string;
}> {
  if (!Array.isArray(incomingInvoices) || incomingInvoices.length === 0) {
    return {
      success: true,
      count: 0,
      newlyInserted: [],
      forceAutoSendNumbers: new Set(),
      suppressAutoSendNumbers: new Set(),
    };
  }

  const now = new Date().toISOString();
  const formattedRaw: OracleInvoice[] = incomingInvoices.map((item, idx) => ({
    id: item.id || crypto.randomUUID(),
    invoice_number: String(item.invoice_number || "").trim() || `DOC-${Date.now()}-${idx}`,
    doc_type: (item.doc_type || "cash_invoice") as OnyxDocType,
    customer_code: item.customer_code ? String(item.customer_code).trim() : null,
    customer_name: String(item.customer_name || "عميل غير محدد").trim(),
    phone: String(item.phone || "").trim(),
    invoice_date: item.invoice_date || now.split("T")[0],
    amount: sanitizeNumeric(item.amount, 0),
    currency: item.currency || "ر.س",
    remaining_balance: sanitizeNumeric(item.remaining_balance, null),
    payment_method: normalizePaymentMethod(item.payment_method),
    attachment_url: item.attachment_url ? String(item.attachment_url).trim() : null,
    onyx_form_code: item.onyx_form_code ? String(item.onyx_form_code).trim() : null,
    details: item.details || "",
    status: item.status || "pending",
    whatsapp_message_id: item.whatsapp_message_id || null,
    sent_at: item.sent_at || null,
    created_at: item.created_at || now,
    updated_at: now,
  }));

  // Deduplicate incoming batch by invoice_number and track explicit force_auto_send / suppress_auto_send flags
  const forceAutoSendNumbers = new Set<string>();
  const suppressAutoSendNumbers = new Set<string>();
  const dedupedMap = new Map<string, OracleInvoice>();
  incomingInvoices.forEach((raw, idx) => {
    const f = formattedRaw[idx];
    if ((raw as any)?.force_auto_send === true) {
      forceAutoSendNumbers.add(f.invoice_number);
    }
    if ((raw as any)?.suppress_auto_send === true) {
      suppressAutoSendNumbers.add(f.invoice_number);
    }
    dedupedMap.set(f.invoice_number, f);
  });
  const formatted = Array.from(dedupedMap.values());
  const incomingNumbers = formatted.map((f) => f.invoice_number);

  // Check existing records in memory cache and MySQL so already-sent invoices stay "sent"
  const existingMap = new Map<
    string,
    { status: OracleInvoice["status"]; whatsapp_message_id?: string | null; sent_at?: string | null }
  >();
  for (const cached of memoryInvoicesCache) {
    if (incomingNumbers.includes(cached.invoice_number)) {
      existingMap.set(cached.invoice_number, {
        status: cached.status,
        whatsapp_message_id: cached.whatsapp_message_id ?? null,
        sent_at: cached.sent_at ?? null,
      });
    }
  }

  const mysqlReady = isMysqlConfigured();
  if (mysqlReady) {
    try {
      for (let i = 0; i < incomingNumbers.length; i += 200) {
        const chunk = incomingNumbers.slice(i, i + 200);
        const placeholders = chunk.map(() => "?").join(", ");
        const existingRows = await queryRows<any>(
          `SELECT invoice_number, status, whatsapp_message_id, sent_at
           FROM oracle_invoices
           WHERE invoice_number IN (${placeholders})`,
          chunk
        );
        for (const row of existingRows) {
          existingMap.set(String(row.invoice_number), {
            status: (row.status || "pending") as OracleInvoice["status"],
            whatsapp_message_id: row.whatsapp_message_id ?? null,
            sent_at: row.sent_at ?? null,
          });
        }
      }
    } catch (err: any) {
      console.warn("[OracleInvoices] MySQL pre-upsert lookup skipped:", err?.message);
    }
  }

  const newlyInserted: OracleInvoice[] = [];
  for (const item of formatted) {
    const existing = existingMap.get(item.invoice_number);
    const forceAutoSend = forceAutoSendNumbers.has(item.invoice_number);

    if (forceAutoSend) {
      newlyInserted.push(item);
    } else if (existing?.status === "sent") {
      item.status = "sent";
      item.whatsapp_message_id = existing.whatsapp_message_id ?? null;
      item.sent_at = existing.sent_at ?? null;
    } else if (!existing) {
      newlyInserted.push(item);
    }
  }

  if (mysqlReady) {
    try {
      const mysqlNow = toMysqlDateTime(now);
      for (const item of formatted) {
        await executeSql(
          `INSERT INTO oracle_invoices (
             id, invoice_number, doc_type, customer_code, customer_name, phone,
             invoice_date, amount, currency, remaining_balance, payment_method,
             attachment_url, onyx_form_code, details, status, whatsapp_message_id,
             sent_at, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             doc_type = VALUES(doc_type),
             customer_code = VALUES(customer_code),
             customer_name = VALUES(customer_name),
             phone = VALUES(phone),
             invoice_date = VALUES(invoice_date),
             amount = VALUES(amount),
             currency = VALUES(currency),
             remaining_balance = VALUES(remaining_balance),
             payment_method = VALUES(payment_method),
             attachment_url = COALESCE(VALUES(attachment_url), attachment_url),
             onyx_form_code = VALUES(onyx_form_code),
             details = VALUES(details),
             status = IF(status = 'sent', 'sent', VALUES(status)),
             whatsapp_message_id = IF(status = 'sent', whatsapp_message_id, VALUES(whatsapp_message_id)),
             sent_at = IF(status = 'sent', sent_at, VALUES(sent_at)),
             updated_at = VALUES(updated_at)`,
          [
            item.id,
            item.invoice_number,
            item.doc_type,
            item.customer_code ?? null,
            item.customer_name,
            item.phone,
            item.invoice_date,
            Number(item.amount ?? 0),
            item.currency,
            item.remaining_balance === null || item.remaining_balance === undefined
              ? null
              : Number(item.remaining_balance),
            item.payment_method ?? null,
            item.attachment_url ?? null,
            item.onyx_form_code ?? null,
            item.details ?? "",
            item.status,
            item.whatsapp_message_id ?? null,
            item.sent_at ?? null,
            toMysqlDateTime(item.created_at),
            mysqlNow,
          ]
        );
      }
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
      return {
        success: true,
        count: formatted.length,
        newlyInserted,
        forceAutoSendNumbers,
        suppressAutoSendNumbers,
      };
    } catch (err: any) {
      console.warn("[OracleInvoices] MySQL upsert error, falling back to memory:", err?.message);
    }
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

  return {
    success: true,
    count: formatted.length,
    newlyInserted,
    forceAutoSendNumbers,
    suppressAutoSendNumbers,
  };
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

  if (isMysqlConfigured()) {
    try {
      await executeSql(
        `UPDATE oracle_invoices
         SET status = ?,
             whatsapp_message_id = ?,
             sent_at = ?,
             updated_at = ?
         WHERE invoice_number = ?`,
        [
          status,
          messageId || null,
          status === "sent" ? now : null,
          toMysqlDateTime(now),
          invoiceNumber,
        ]
      );
      const item = memoryInvoicesCache.find((x) => x.invoice_number === invoiceNumber);
      if (item) {
        item.status = status;
        item.whatsapp_message_id = messageId || null;
        item.sent_at = status === "sent" ? now : null;
      }
      return true;
    } catch (err) {
      console.warn("[OracleInvoices] MySQL update status error, updating memory cache only:", err);
    }
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
