"use client";

import { useEffect, useState } from "react";
import {
  ONYX_TEMPLATE_LIST,
  extractTemplateParameters,
  formatTemplatePreviewText,
  getOnyxTemplate,
  type OnyxDocType,
} from "@/lib/onyx-templates";
import type { RelatedOracleInvoice } from "./WhatsAppInboxHelpers";

interface WhatsAppInboxTemplateModalProps {
  isOpen: boolean;
  phone: string;
  customerName: string;
  relatedInvoices: RelatedOracleInvoice[];
  onClose: () => void;
  onSent: () => void;
  onUnauthorized: () => void;
}

export default function WhatsAppInboxTemplateModal({
  isOpen,
  phone,
  customerName,
  relatedInvoices,
  onClose,
  onSent,
  onUnauthorized,
}: WhatsAppInboxTemplateModalProps) {
  const [docType, setDocType] = useState<OnyxDocType>("direct_alert");
  const [templateName, setTemplateName] = useState("direct_alert");
  const [languageCode, setLanguageCode] = useState("ar");
  const [parameters, setParameters] = useState<string[]>([]);
  const [headerUrl, setHeaderUrl] = useState("");
  const [lockedInvoice, setLockedInvoice] = useState<RelatedOracleInvoice | null>(null);

  // Lookup by any Onyx invoice number & recent PDFs list
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupFeedback, setLookupFeedback] = useState<string>("");
  const [recentPdfInvoices, setRecentPdfInvoices] = useState<RelatedOracleInvoice[]>([]);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  function applyInvoice(inv: RelatedOracleInvoice) {
    const def = getOnyxTemplate(inv.doc_type);
    setLockedInvoice(inv);
    setDocType(def.id);
    setTemplateName(def.defaultMetaTemplateName);
    setHeaderUrl(inv.attachment_url || "");
    setInvoiceSearch(inv.invoice_number);
    setLookupFeedback("");
    setError("");
    setParameters(
      extractTemplateParameters(def.id, {
        ...inv,
        customer_name: inv.customer_name || customerName || "عميلنا العزيز",
      })
    );
  }

  function clearLockedInvoiceToFreeNotice() {
    const def = getOnyxTemplate("direct_alert");
    setLockedInvoice(null);
    setDocType(def.id);
    setTemplateName(def.defaultMetaTemplateName);
    setHeaderUrl("");
    setInvoiceSearch("");
    setLookupFeedback("");
    setError("");
    setParameters(
      extractTemplateParameters("direct_alert", {
        invoice_number: "-",
        customer_name: customerName || "عميلنا العزيز",
        phone,
        invoice_date: new Date().toISOString().slice(0, 10),
        amount: "0",
        currency: "ر.س",
      })
    );
  }

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setLookupFeedback("");

    const first = relatedInvoices[0];
    if (first) {
      applyInvoice(first);
    } else {
      clearLockedInvoiceToFreeNotice();
    }

    // Fetch recent exported Onyx PDF invoices automatically
    fetch("/api/whatsapp/inbox?pdfInvoices=1", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && Array.isArray(data.invoices)) {
          setRecentPdfInvoices(data.invoices);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, phone]);

  // Automatically recognize any exported Onyx invoice number as soon as typed
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = invoiceSearch.trim();
    if (!trimmed || lockedInvoice?.invoice_number === trimmed || trimmed.length < 4) {
      return;
    }
    const timer = setTimeout(() => {
      handleLookupInvoice(trimmed);
    }, 380);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceSearch, isOpen]);

  async function handleLookupInvoice(targetNum?: string) {
    const num = (targetNum ?? invoiceSearch).trim();
    if (!num) return;

    // First check local arrays immediately
    const localMatch =
      relatedInvoices.find((i) => i.invoice_number === num) ||
      recentPdfInvoices.find((i) => i.invoice_number === num);
    if (localMatch) {
      applyInvoice(localMatch);
      return;
    }

    setLookupLoading(true);
    setLookupFeedback("");
    setError("");
    try {
      const res = await fetch(
        `/api/whatsapp/inbox?lookupInvoice=${encodeURIComponent(num)}`,
        { cache: "no-store" }
      );
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = await res.json();
      if (data?.success && data.invoice) {
        applyInvoice(data.invoice);
      } else {
        setLookupFeedback(`لم يتم العثور على مستند برقم (${num}) في أونكس بعد.`);
      }
    } catch {
      setLookupFeedback("تعذر البحث عن رقم الفاتورة حالياً.");
    } finally {
      setLookupLoading(false);
    }
  }

  function handleDocTypeChange(nextType: OnyxDocType) {
    // Strictly block changing template type when an Onyx invoice is locked
    if (lockedInvoice && nextType !== getOnyxTemplate(lockedInvoice.doc_type).id) {
      return;
    }
    const def = getOnyxTemplate(nextType);
    setDocType(nextType);
    setTemplateName(def.defaultMetaTemplateName);
    setParameters((prev) =>
      def.variables.map((v, idx) =>
        v.key === "customer_name" && !prev[idx]
          ? customerName || "عميلنا العزيز"
          : prev[idx] || v.placeholder || "-"
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSending(true);

    try {
      const res = await fetch("/api/whatsapp/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber:
            lockedInvoice?.invoice_number || `MSG-${Date.now().toString().slice(-6)}`,
          phone,
          customerName,
          docType,
          sendMode: "template",
          templateName: templateName.trim(),
          languageCode: languageCode.trim() || "ar",
          customParameters: parameters,
          headerUrl: headerUrl.trim() || undefined,
        }),
      });

      if (res.status === 401) {
        onUnauthorized();
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "فشل إرسال القالب عبر واتساب.");
        setSending(false);
        return;
      }

      onSent();
      onClose();
    } catch {
      setError("حدث خطأ أثناء الاتصال بالسيرفر.");
    } finally {
      setSending(false);
    }
  }

  if (!isOpen) return null;

  const activeDef = getOnyxTemplate(docType);
  const preview = formatTemplatePreviewText(docType, parameters);
  const lockedExpectedId = lockedInvoice
    ? getOnyxTemplate(lockedInvoice.doc_type).id
    : null;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              إرسال قالب رسمي معتمد (Meta Template)
            </h2>
            <p className="text-xs font-bold text-slate-500">
              إلى: {customerName || phone} (<span dir="ltr">{phone}</span>) — يعمل في أي وقت حتى بعد الـ 24 ساعة
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Customer Invoices Quick Picker */}
          {relatedInvoices.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-black text-slate-700">
                فواتير ومستندات العميل من أونكس:
              </p>
              <div className="flex flex-wrap gap-2">
                {relatedInvoices.slice(0, 8).map((inv) => {
                  const invDef = getOnyxTemplate(inv.doc_type);
                  const isActive = lockedInvoice?.invoice_number === inv.invoice_number;
                  return (
                    <button
                      key={inv.invoice_number}
                      type="button"
                      onClick={() => applyInvoice(inv)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                        isActive
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500/30"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span>#{inv.invoice_number}</span>
                      <span className="text-[10px] text-slate-500">• {invDef.shortLabel}</span>
                      {inv.has_onyx_pdf && (
                        <span className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-[9px] font-black text-white">
                          PDF
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lookup Any Onyx Invoice / Auto-Detect Exported PDFs */}
          <div className="rounded-2xl border border-slate-200/80 bg-[#f8fafc] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-black text-slate-700">
                ربط برقم فاتورة / مستند أونكس (يجلب رابط الـ PDF ويحدد القالب تلقائياً):
              </label>
              {lockedInvoice && (
                <button
                  type="button"
                  onClick={clearLockedInvoiceToFreeNotice}
                  className="text-[11px] font-bold text-slate-500 underline hover:text-slate-800"
                >
                  إلغاء الربط (إشعار عام)
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                dir="ltr"
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleLookupInvoice();
                  }
                }}
                placeholder="مثال: 2601020005 أو ARST-..."
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs font-bold outline-none focus:border-emerald-600"
              />
              <button
                type="button"
                disabled={lookupLoading || !invoiceSearch.trim()}
                onClick={() => handleLookupInvoice()}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white transition hover:bg-emerald-700 disabled:opacity-40"
              >
                {lookupLoading ? "جاري البحث..." : "جلب الفاتورة"}
              </button>
            </div>

            {lookupFeedback && (
              <p className="text-[11px] font-bold text-amber-700">{lookupFeedback}</p>
            )}

            {recentPdfInvoices.length > 0 && (
              <div className="pt-1">
                <p className="mb-1.5 text-[10.5px] font-bold text-slate-500">
                  أحدث فواتير متصدرة بملف PDF جاهز في أونكس:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {recentPdfInvoices.slice(0, 5).map((pdfInv) => (
                    <button
                      key={pdfInv.invoice_number}
                      type="button"
                      onClick={() => applyInvoice(pdfInv)}
                      className={`rounded-lg border px-2 py-1 text-[10.5px] font-bold transition ${
                        lockedInvoice?.invoice_number === pdfInv.invoice_number
                          ? "border-emerald-600 bg-emerald-100 text-emerald-900"
                          : "border-slate-200 bg-white text-slate-700 hover:border-emerald-400"
                      }`}
                    >
                      <span dir="ltr">{pdfInv.invoice_number}</span> ({getOnyxTemplate(pdfInv.doc_type).shortLabel} • PDF)
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Template Selector (Strictly Locked when an Onyx Invoice is Selected) */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-black text-slate-700">نوع القالب المعتمد:</p>
              {lockedInvoice && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10.5px] font-black text-amber-900">
                  مقفل تلقائياً على ({activeDef.label}) فقط للمستند #{lockedInvoice.invoice_number}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ONYX_TEMPLATE_LIST.map((tpl) => {
                const isSelected = docType === tpl.id;
                const isLockedDisabled =
                  Boolean(lockedExpectedId) && tpl.id !== lockedExpectedId;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    disabled={isLockedDisabled}
                    onClick={() => handleDocTypeChange(tpl.id)}
                    title={
                      isLockedDisabled
                        ? `مقفل: لا يمكن إرسال هذا المستند إلا بقالب (${activeDef.label})`
                        : tpl.label
                    }
                    className={`rounded-xl border px-2.5 py-2 text-xs font-bold text-right transition ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500/30"
                        : isLockedDisabled
                          ? "border-slate-100 bg-slate-100/70 text-slate-300 cursor-not-allowed opacity-55"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {tpl.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-black text-slate-600">
                اسم القالب في Meta
              </label>
              <input
                type="text"
                dir="ltr"
                value={templateName}
                readOnly
                className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-mono font-bold text-slate-600 outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-black text-slate-600">كود اللغة</label>
              <input
                type="text"
                dir="ltr"
                value={languageCode}
                onChange={(e) => setLanguageCode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono font-bold outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          {activeDef.hasAttachment && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block text-xs font-black text-slate-700">
                  رابط ملف الـ PDF المرفق في الهيدر:
                </label>
                {headerUrl ? (
                  <a
                    href={headerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-black text-emerald-700 hover:underline"
                  >
                    ✓ تم جلب رابط PDF تلقائياً — معاينة ↗
                  </a>
                ) : (
                  <span className="text-[11px] font-bold text-slate-400">
                    لم يُرفع ملف PDF أصلي من أونكس لهذا الرقم بعد
                  </span>
                )}
              </div>
              <input
                type="url"
                dir="ltr"
                value={headerUrl}
                onChange={(e) => setHeaderUrl(e.target.value)}
                placeholder="https://www.modernbuildingsa.com/api/oracle-orders/pdf/..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono outline-none focus:border-emerald-600"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeDef.variables.map((variable, idx) => (
              <div key={variable.key}>
                <label className="mb-1 block text-xs font-bold text-slate-600">
                  {`{{${variable.index}}}`} {variable.label}
                </label>
                <input
                  type="text"
                  value={parameters[idx] || ""}
                  placeholder={variable.placeholder}
                  onChange={(e) =>
                    setParameters((prev) => {
                      const next = [...prev];
                      next[idx] = e.target.value;
                      return next;
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-600"
                />
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-[#ecfdf5] border border-emerald-200 p-4">
            <p className="mb-1.5 text-[11px] font-black text-emerald-800">معاينة نص الرسالة:</p>
            <p className="whitespace-pre-wrap text-xs leading-6 text-slate-800">{preview}</p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-bold text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={sending}
              className="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {sending ? "جاري الإرسال..." : `إرسال (${activeDef.shortLabel}) عبر واتساب`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
