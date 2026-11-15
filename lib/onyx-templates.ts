export type OnyxDocType =
  | "cash_invoice"
  | "credit_invoice"
  | "receipt_voucher"
  | "account_statement"
  | "price_quotation"
  | "purchase_order"
  | "customer_discount_notice"
  | "direct_alert";

export interface OnyxTemplateVariable {
  index: number;
  key: string;
  label: string;
  placeholder: string;
}

export interface OnyxTemplateDefinition {
  id: OnyxDocType;
  label: string;
  shortLabel: string;
  defaultMetaTemplateName: string;
  onyxScreenCode: string;
  badgeColor: string;
  hasAttachment: boolean;
  variables: OnyxTemplateVariable[];
}

export interface OnyxDocumentRecord {
  invoice_number: string;
  customer_name: string;
  customer_code?: string | null;
  phone: string;
  invoice_date: string;
  amount: number | string;
  currency?: string;
  remaining_balance?: number | string | null;
  payment_method?: string | null;
  details?: string;
  doc_type?: OnyxDocType;
  attachment_url?: string | null;
  onyx_form_code?: string | null;
}

export const ONYX_TEMPLATES: Record<OnyxDocType, OnyxTemplateDefinition> = {
  cash_invoice: {
    id: "cash_invoice",
    label: "فاتورة نقدية",
    shortLabel: "فاتورة نقدية",
    defaultMetaTemplateName: "cash_invoice",
    onyxScreenCode: "SI-CASH",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    hasAttachment: true,
    variables: [
      { index: 1, key: "invoice_number", label: "رقم الفاتورة", placeholder: "2601018135" },
      { index: 2, key: "invoice_date", label: "تاريخ الفاتورة", placeholder: "2026-11-11" },
      { index: 3, key: "amount", label: "المبلغ", placeholder: "3456.66 ر.س" },
    ],
  },
  credit_invoice: {
    id: "credit_invoice",
    label: "فاتورة آجلة",
    shortLabel: "فاتورة آجلة",
    defaultMetaTemplateName: "credit_invoice",
    onyxScreenCode: "SI-CREDIT",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    hasAttachment: true,
    variables: [
      { index: 1, key: "invoice_number", label: "رقم الفاتورة", placeholder: "2601018702" },
      { index: 2, key: "invoice_date", label: "تاريخ الفاتورة", placeholder: "2026-11-11" },
      { index: 3, key: "amount", label: "مبلغ الفاتورة", placeholder: "2026.09 ر.س" },
      { index: 4, key: "remaining_balance", label: "الرصيد المتبقي", placeholder: "5482.75 ر.س" },
    ],
  },
  receipt_voucher: {
    id: "receipt_voucher",
    label: "سند قبض",
    shortLabel: "سند قبض",
    defaultMetaTemplateName: "receipt_voucher",
    onyxScreenCode: "RV",
    badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
    hasAttachment: false,
    variables: [
      { index: 1, key: "amount", label: "المبلغ المستلم", placeholder: "1500.00 ر.س" },
      { index: 2, key: "payment_method", label: "طريقة الدفع", placeholder: "تحويل بنكي" },
      { index: 3, key: "invoice_date", label: "بتاريخ", placeholder: "2026-11-11" },
      { index: 4, key: "remaining_balance", label: "الرصيد المتبقي", placeholder: "2100.00 ر.س" },
    ],
  },
  account_statement: {
    id: "account_statement",
    label: "كشف حساب عميل",
    shortLabel: "كشف حساب",
    defaultMetaTemplateName: "account_statement",
    onyxScreenCode: "ALRTT002",
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
    hasAttachment: true,
    variables: [
      { index: 1, key: "customer_name", label: "اسم العميل (وليس الرقم)", placeholder: "امين عيظة العكة" },
      { index: 2, key: "invoice_date", label: "حتى تاريخ", placeholder: "2026-11-11" },
      { index: 3, key: "remaining_balance", label: "الرصيد الحالي", placeholder: "338.88" },
    ],
  },
  price_quotation: {
    id: "price_quotation",
    label: "عرض سعر",
    shortLabel: "عرض سعر",
    defaultMetaTemplateName: "price_quotation",
    onyxScreenCode: "QT",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
    hasAttachment: true,
    variables: [
      { index: 1, key: "invoice_number", label: "رقم عرض السعر", placeholder: "QT-2026-104" },
      { index: 2, key: "invoice_date", label: "تاريخ العرض", placeholder: "2026-11-11" },
      { index: 3, key: "amount", label: "إجمالي قيمة العرض", placeholder: "12500.00" },
    ],
  },
  purchase_order: {
    id: "purchase_order",
    label: "طلب شراء (موردين)",
    shortLabel: "طلب شراء",
    defaultMetaTemplateName: "purchase_order",
    onyxScreenCode: "PO",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
    hasAttachment: true,
    variables: [
      { index: 1, key: "customer_name", label: "اسم المورد", placeholder: "شركة مصانع الدهانات الحديثة" },
      { index: 2, key: "invoice_number", label: "رقم طلب الشراء", placeholder: "PO-2026-552" },
      { index: 3, key: "invoice_date", label: "تاريخ الطلب", placeholder: "2026-11-11" },
    ],
  },
  customer_discount_notice: {
    id: "customer_discount_notice",
    label: "خصم عميل (إشعارات العملاء)",
    shortLabel: "خصم عميل",
    defaultMetaTemplateName: "customer_discount_notice",
    onyxScreenCode: "ARST045",
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
    hasAttachment: false,
    variables: [
      { index: 1, key: "amount", label: "مبلغ الخصم", placeholder: "197.48 ر.س" },
      { index: 2, key: "invoice_date", label: "تاريخ الإشعار", placeholder: "2026-11-09" },
      { index: 3, key: "remaining_balance", label: "الرصيد المتبقي", placeholder: "3473.02 ر.س" },
    ],
  },
  direct_alert: {
    id: "direct_alert",
    label: "تنبيه مباشر (الرسائل المباشرة)",
    shortLabel: "تنبيه مباشر",
    defaultMetaTemplateName: "direct_alert",
    onyxScreenCode: "ALRTT002",
    badgeColor: "bg-orange-50 text-orange-700 border-orange-200",
    hasAttachment: true,
    variables: [
      { index: 1, key: "customer_name", label: "اسم العميل", placeholder: "مؤسسة المصباح المميز التجارية" },
      { index: 2, key: "details", label: "نص الرسالة / التنبيه", placeholder: "برجاء سداد المبالغ المستحقة" },
      { index: 3, key: "remaining_balance", label: "الرصيد الحالي", placeholder: "5283.08 ر.س" },
    ],
  },
};

export const ONYX_TEMPLATE_LIST: OnyxTemplateDefinition[] = Object.values(ONYX_TEMPLATES);

export function getOnyxTemplate(docType?: string | null): OnyxTemplateDefinition {
  if (docType && docType in ONYX_TEMPLATES) {
    return ONYX_TEMPLATES[docType as OnyxDocType];
  }
  return ONYX_TEMPLATES.cash_invoice;
}

function formatAmountWithCurrency(
  value: number | string | null | undefined,
  currency: string = "ر.س",
  includeCurrency: boolean = true
): string {
  const numStr = String(value ?? "0").trim();
  if (!includeCurrency) return numStr;
  return numStr.includes(currency) || numStr.includes("ريال") || numStr.includes("SAR")
    ? numStr
    : `${numStr} ${currency}`;
}

/**
 * استخراج مصفوفة المتغيرات المطلوبة لقالب واتساب حسب نوع العملية من أونكس
 */
export function extractTemplateParameters(
  docType: OnyxDocType,
  record: OnyxDocumentRecord
): string[] {
  const currency = record.currency || "ر.س";
  const dateVal = record.invoice_date || new Date().toISOString().split("T")[0];
  const docNo = String(record.invoice_number || "").trim();
  const custName = String(record.customer_name || "عميلنا العزيز").trim();
  const amountWithCurr = formatAmountWithCurrency(record.amount, currency, true);
  const amountRaw = formatAmountWithCurrency(record.amount, currency, false);
  const balanceVal =
    record.remaining_balance !== undefined && record.remaining_balance !== null && String(record.remaining_balance).trim() !== ""
      ? formatAmountWithCurrency(record.remaining_balance, currency, true)
      : amountWithCurr;
  const balanceRaw =
    record.remaining_balance !== undefined && record.remaining_balance !== null && String(record.remaining_balance).trim() !== ""
      ? formatAmountWithCurrency(record.remaining_balance, currency, false)
      : amountRaw;

  switch (docType) {
    case "cash_invoice":
      return [docNo, dateVal, amountWithCurr];

    case "credit_invoice":
      return [docNo, dateVal, amountWithCurr, balanceVal];

    case "receipt_voucher":
      return [
        amountWithCurr,
        String(record.payment_method || "نقداً / تحويل بنكي").trim(),
        dateVal,
        balanceVal,
      ];

    case "account_statement":
      return [custName, dateVal, balanceRaw];

    case "price_quotation":
      return [docNo, dateVal, amountRaw];

    case "purchase_order":
      return [custName, docNo, dateVal];

    case "customer_discount_notice":
      return [amountWithCurr, dateVal, balanceVal];

    case "direct_alert":
      return [
        custName,
        String(record.details || "برجاء سداد المبالغ المستحقة").trim(),
        balanceVal,
      ];

    default:
      return [docNo, dateVal, amountWithCurr];
  }
}

/**
 * توليد نص الرسالة الكامل المطابق لملف الـ Word المرسل من العميل
 */
export function formatTemplatePreviewText(
  docType: OnyxDocType,
  params: string[]
): string {
  const p = (idx: number, fallback: string = "—") => {
    const v = params[idx];
    return v !== undefined && String(v).trim() !== "" ? String(v).trim() : fallback;
  };

  switch (docType) {
    case "cash_invoice":
      return [
        "عميلنا العزيز",
        `مرفق لكم فاتورة مبيعات نقدية رقم (${p(0)})`,
        `تاريخ الفاتورة (${p(1)})`,
        `بمبلغ (${p(2)})`,
        "Modern Building",
      ].join("\n");

    case "credit_invoice":
      return [
        "عميلنا العزيز",
        `مرفق لكم فاتورة مبيعات اجلة رقم (${p(0)})`,
        `تاريخ الفاتورة (${p(1)})`,
        `بمبلغ (${p(2)})`,
        `الرصيد المتبقي (${p(3)})`,
        "Modern Building",
      ].join("\n");

    case "receipt_voucher":
      return [
        "عميلنا العزيز",
        `تم استلام مبلغ (${p(0)}) من حسابكم الاجل`,
        `طريقة الدفع (${p(1)})`,
        `بتاريخ (${p(2)})`,
        `الرصيد المتبقي (${p(3)})`,
        "Modern Building",
      ].join("\n");

    case "account_statement":
      return [
        "عميلنا العزيز",
        `مرفق لكم كشف حساب العميل (${p(0)})`,
        `حتى تاريخ (${p(1)})`,
        `الرصيد الحالي (${p(2)}) ريال`,
        "Modern Building",
      ].join("\n");

    case "price_quotation":
      return [
        "عميلنا العزيز",
        `مرفق لكم عرض سعر رقم (${p(0)})`,
        `بتاريخ (${p(1)})`,
        `اجمالي قيمة العرض (${p(2)}) ريال`,
        "في حالة وجود أي استفسار يرجى التواصل مع فريق المبيعات",
        "إبراهيم 0558689100",
        "بندر 0501960009",
        "0175420300",
        "Modern Building",
      ].join("\n");

    case "purchase_order":
      return [
        `السادة (${p(0)}) المحترمين`,
        `مرفق لكم طلب شراء رقم (${p(1)})`,
        `بتاريخ (${p(2)})`,
        "نرجو مراجعة الطلب وافادتنا بعرض سعر بالأسعار المتاحة لكل صنف واجمالي قيمة الطلب",
        "Modern Building",
      ].join("\n");

    case "customer_discount_notice":
      return [
        "عميلنا العزيز",
        `تم خصم مبلغ (${p(0)}) من حسابكم الاجل`,
        `بتاريخ (${p(1)})`,
        `الرصيد المتبقي (${p(2)})`,
        "Modern Building",
      ].join("\n");

    case "direct_alert":
      return [
        `عميلنا العزيز (${p(0)})`,
        p(1, "برجاء سداد المبالغ المستحقة"),
        `الرصيد الحالي (${p(2)})`,
        "Modern Building",
      ].join("\n");

    default:
      return [
        "عميلنا العزيز",
        `مستند رقم (${p(0)}) بتاريخ (${p(1)}) بمبلغ (${p(2)})`,
        "Modern Building",
      ].join("\n");
  }
}
