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
  const [docType, setDocType] = useState<OnyxDocType>("cash_invoice");
  const [templateName, setTemplateName] = useState("cash_invoice");
  const [languageCode, setLanguageCode] = useState("ar");
  const [parameters, setParameters] = useState<string[]>([]);
  const [headerUrl, setHeaderUrl] = useState("");
  const [selectedInvoiceNum, setSelectedInvoiceNum] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    const first = relatedInvoices[0];
    if (first) {
      applyInvoice(first);
    } else {
      const def = getOnyxTemplate("cash_invoice");
      setDocType(def.id);
      setTemplateName(def.defaultMetaTemplateName);
      setHeaderUrl("");
      setSelectedInvoiceNum("");
      setParameters(
        extractTemplateParameters("cash_invoice", {
          invoice_number: "-",
          customer_name: customerName || "عميلنا العزيز",
          phone,
          invoice_date: new Date().toISOString().slice(0, 10),
          amount: "0",
          currency: "ر.س",
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, phone]);

  function applyInvoice(inv: RelatedOracleInvoice) {
    const def = getOnyxTemplate(inv.doc_type);
    setDocType(def.id);
    setTemplateName(def.defaultMetaTemplateName);
    setHeaderUrl(inv.attachment_url || "");
    setSelectedInvoiceNum(inv.invoice_number);
    setParameters(extractTemplateParameters(def.id, inv));
  }

  function handleDocTypeChange(nextType: OnyxDocType) {
    const def = getOnyxTemplate(nextType);
    setDocType(nextType);
    setTemplateName(def.defaultMetaTemplateName);
    const matching = relatedInvoices.find((i) => i.doc_type === nextType);
    if (matching) {
      applyInvoice(matching);
      return;
    }
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
          invoiceNumber: selectedInvoiceNum || `MSG-${Date.now().toString().slice(-6)}`,
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

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">إرسال قالب رسمي معتمد (Meta Template)</h2>
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
          {relatedInvoices.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-black text-slate-700">مستندات أونكس المرتبطة بهذا الرقم:</p>
              <div className="flex flex-wrap gap-2">
                {relatedInvoices.slice(0, 6).map((inv) => (
                  <button
                    key={inv.invoice_number}
                    type="button"
                    onClick={() => applyInvoice(inv)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                      selectedInvoiceNum === inv.invoice_number
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    #{inv.invoice_number} • {inv.amount} {inv.currency}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-black text-slate-700">اختر نوع القالب:</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ONYX_TEMPLATE_LIST.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleDocTypeChange(tpl.id)}
                  className={`rounded-xl border px-2.5 py-2 text-xs font-bold text-right transition ${
                    docType === tpl.id
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {tpl.shortLabel}
                </button>
              ))}
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
                onChange={(e) => setTemplateName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono font-bold outline-none focus:border-emerald-600"
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
            <div>
              <label className="mb-1 block text-xs font-black text-slate-600">
                رابط ملف الـ PDF المرفق في الهيدر (اختياري)
              </label>
              <input
                type="url"
                dir="ltr"
                value={headerUrl}
                onChange={(e) => setHeaderUrl(e.target.value)}
                placeholder="https://www.modernbuildingsa.com/api/media/..."
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
              {sending ? "جاري الإرسال..." : "إرسال القالب عبر واتساب"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
