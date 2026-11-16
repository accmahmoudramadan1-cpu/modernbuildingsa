"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import WhatsAppLoginForm from "@/components/WhatsAppLoginForm";
import WhatsAppInstallBanner from "@/components/WhatsAppInstallBanner";
import {
  WhatsAppIcon,
  RefreshIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  InvoiceDocumentIcon,
  SendPlaneIcon,
  BoltIcon,
  ExternalLinkIcon,
  CloseIcon,
  BuildingIcon,
  DoubleCheckIcon,
  SearchIcon,
  TagIcon,
  PaperclipIcon,
  FilterIcon,
} from "./Icons";
import {
  ONYX_TEMPLATES,
  ONYX_TEMPLATE_LIST,
  extractTemplateParameters,
  formatTemplatePreviewText,
  getOnyxTemplate,
  type OnyxDocType,
} from "@/lib/onyx-templates";

interface OracleInvoice {
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
}

export default function WhatsAppInvoicesPage() {
  const [authStatus, setAuthStatus] = useState<"checking" | "authenticated" | "unauthenticated">("checking");
  const [authUser, setAuthUser] = useState<string>("");
  const [showInstallPopup, setShowInstallPopup] = useState(false);

  const [invoices, setInvoices] = useState<OracleInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "sent" | "failed">("all");
  const [docTypeFilter, setDocTypeFilter] = useState<"all" | OnyxDocType>("all");

  // Send Modal states
  const [selectedInvoice, setSelectedInvoice] = useState<OracleInvoice | null>(null);
  const [activeDocType, setActiveDocType] = useState<OnyxDocType>("cash_invoice");
  const [sendMode, setSendMode] = useState<"template" | "text">("template");
  const [templateName, setTemplateName] = useState("cash_invoice");
  const [languageCode, setLanguageCode] = useState("ar");
  const [parameters, setParameters] = useState<string[]>([]);
  const [headerUrl, setHeaderUrl] = useState("");
  const [sending, setSending] = useState(false);

  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Load Invoices from API
  async function loadInvoices() {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/oracle-orders", { cache: "no-store" });
      if (res.status === 401) {
        setAuthStatus("unauthenticated");
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.invoices)) {
        setInvoices(data.invoices);
      } else {
        setActionMessage({
          type: "error",
          text: data.error || "حدث خطأ أثناء تحميل المستندات.",
        });
      }
    } catch {
      setActionMessage({
        type: "error",
        text: "تعذر الاتصال بالخادم لجلب بيانات المستندات.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/whatsapp/auth", { method: "DELETE" }).catch(() => {});
    setAuthUser("");
    setInvoices([]);
    setSelectedInvoice(null);
    setAuthStatus("unauthenticated");
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/whatsapp/auth", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && data.authenticated) {
          setAuthUser(data.username || "modernbuilding");
          setAuthStatus("authenticated");
          loadInvoices();
        } else {
          setAuthStatus("unauthenticated");
          setLoading(false);
        }
      } catch {
        if (!active) return;
        setAuthStatus("unauthenticated");
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Open Template Send Modal for a record
  function openSendModal(inv: OracleInvoice) {
    const templateDef = getOnyxTemplate(inv.doc_type);
    setSelectedInvoice(inv);
    setActiveDocType(templateDef.id);
    setTemplateName(templateDef.defaultMetaTemplateName);
    setHeaderUrl(inv.attachment_url || "");
    setParameters(extractTemplateParameters(templateDef.id, inv));
    setActionMessage(null);
  }

  // Switch template type inside modal
  function handleModalDocTypeChange(newType: OnyxDocType) {
    setActiveDocType(newType);
    const templateDef = getOnyxTemplate(newType);
    setTemplateName(templateDef.defaultMetaTemplateName);
    if (selectedInvoice) {
      setParameters(extractTemplateParameters(newType, selectedInvoice));
    }
  }

  // Update a single variable value
  function handleParamChange(index: number, value: string) {
    setParameters((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  // Submit Send via API
  async function handleSendTemplate() {
    if (!selectedInvoice) return;
    setSending(true);
    setActionMessage(null);

    try {
      const res = await fetch("/api/whatsapp/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: selectedInvoice.invoice_number,
          phone: selectedInvoice.phone,
          customerName: selectedInvoice.customer_name,
          amount: selectedInvoice.amount,
          invoiceDate: selectedInvoice.invoice_date,
          currency: selectedInvoice.currency || "ر.س",
          remainingBalance: selectedInvoice.remaining_balance,
          paymentMethod: selectedInvoice.payment_method,
          details: selectedInvoice.details,
          docType: activeDocType,
          sendMode,
          templateName: templateName.trim(),
          languageCode: languageCode.trim(),
          customParameters: parameters,
          headerUrl: headerUrl.trim() || undefined,
        }),
      });

      if (res.status === 401) {
        setAuthStatus("unauthenticated");
        setSending(false);
        return;
      }

      const result = await res.json();

      if (res.ok && result.success) {
        const label = getOnyxTemplate(activeDocType).label;
        setActionMessage({
          type: "success",
          text: `تم إرسال (${label}) رقم (${selectedInvoice.invoice_number}) إلى ${selectedInvoice.phone} بنجاح.`,
        });

        setInvoices((prev) =>
          prev.map((item) =>
            item.invoice_number === selectedInvoice.invoice_number
              ? {
                  ...item,
                  status: "sent",
                  whatsapp_message_id: result.messageId,
                  sent_at: new Date().toISOString(),
                }
              : item
          )
        );

        setSelectedInvoice(null);
      } else {
        setActionMessage({
          type: "error",
          text: `فشل الإرسال: ${result.error || "تأكد من اعتماد القالب ومفتاح Meta في السيرفر"}`,
        });
      }
    } catch (error: any) {
      setActionMessage({
        type: "error",
        text: `حدث خطأ أثناء محاولة الإرسال: ${error?.message || error}`,
      });
    } finally {
      setSending(false);
    }
  }

  // Filter & Search
  const filteredInvoices = invoices.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.invoice_number.toLowerCase().includes(q) ||
      item.customer_name.toLowerCase().includes(q) ||
      (item.customer_code || "").toLowerCase().includes(q) ||
      item.phone.includes(q);

    const matchesStatus = statusFilter === "all" ? true : item.status === statusFilter;
    const matchesDocType =
      docTypeFilter === "all" ? true : (item.doc_type || "cash_invoice") === docTypeFilter;

    return matchesSearch && matchesStatus && matchesDocType;
  });

  const totalCount = invoices.length;
  const pendingCount = invoices.filter((i) => i.status === "pending").length;
  const sentCount = invoices.filter((i) => i.status === "sent").length;
  const failedCount = invoices.filter((i) => i.status === "failed").length;

  const activeTemplateDef = getOnyxTemplate(activeDocType);
  const livePreviewText = formatTemplatePreviewText(activeDocType, parameters);

  if (authStatus === "checking") {
    return (
      <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#f4f7f6] px-4">
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-white p-8 shadow-lg border border-black/5">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-sm font-bold text-gray-600">جاري التحقق من جلسة الدخول...</p>
        </div>
      </main>
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <WhatsAppLoginForm
        onSuccess={(u) => {
          setAuthUser(u);
          setAuthStatus("authenticated");
          loadInvoices();
        }}
      />
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f5f5f3] px-4 py-8 sm:px-6 lg:px-10">
      <WhatsAppInstallBanner
        forceOpen={showInstallPopup}
        onClose={() => setShowInstallPopup(false)}
      />
      <div className="mx-auto max-w-7xl">
        {/* Navigation & Header */}
        <div className="flex flex-col gap-4 border-b border-black/10 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-600 text-white shadow-sm">
                <WhatsAppIcon className="h-6 w-6 fill-current" />
              </span>
              <div>
                <h1 className="text-2xl font-black text-gray-900 sm:text-3xl">
                  بوابة واتساب نظام أونكس (Onyx Pro / OraNT)
                </h1>
                <p className="text-sm font-semibold text-gray-500">
                  استقبال الفواتير، سندات القبض، كشوف الحساب، عروض الأسعار، طلبات الشراء وإشعارات العملاء
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3.5 py-2 text-xs font-bold text-green-800">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              <span>الإرسال التلقائي من أونكس: مفعّل</span>
            </span>

            <Link
              href="/whatsapp/inbox"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700"
            >
              <WhatsAppIcon className="h-4 w-4 fill-current" />
              <span>صندوق الوارد والمحادثات</span>
            </Link>

            <button
              type="button"
              onClick={() => setShowInstallPopup(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-bold text-emerald-800 shadow-xs transition hover:bg-emerald-50"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
              </svg>
              <span>تثبيت التطبيق</span>
            </button>

            <button
              onClick={loadInvoices}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-50"
            >
              <RefreshIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "جاري التحديث..." : "تحديث البيانات"}</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              title={`تسجيل الخروج (${authUser || "modernbuilding"})`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-black text-red-700 transition hover:bg-red-100"
            >
              <span>خروج</span>
            </button>
          </div>
        </div>

        {/* Action Alert Banner */}
        {actionMessage && (
          <div
            className={`mt-6 flex items-center gap-3 rounded-2xl p-4 text-sm font-bold shadow-sm ${
              actionMessage.type === "success"
                ? "border border-green-200 bg-green-50 text-green-800"
                : "border border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {actionMessage.type === "success" ? (
              <CheckCircleIcon className="h-5 w-5 shrink-0 text-green-600" />
            ) : (
              <AlertCircleIcon className="h-5 w-5 shrink-0 text-red-600" />
            )}
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs font-bold text-gray-400">إجمالي المستندات المستوردة</p>
            <p className="mt-2 text-3xl font-black text-gray-900">{totalCount}</p>
            <p className="mt-1 text-xs text-gray-500">من شاشات Onyx Pro ERP</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs font-bold text-amber-500">بانتظار الإرسال</p>
            <p className="mt-2 text-3xl font-black text-amber-600">{pendingCount}</p>
            <p className="mt-1 text-xs text-gray-500">جاهزة للإرسال بالواتساب</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs font-bold text-green-600">تم الإرسال بنجاح</p>
            <p className="mt-2 text-3xl font-black text-green-600">{sentCount}</p>
            <p className="mt-1 text-xs text-gray-500">عبر Meta WhatsApp API</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs font-bold text-red-500">فشل الإرسال</p>
            <p className="mt-2 text-3xl font-black text-red-600">{failedCount}</p>
            <p className="mt-1 text-xs text-gray-500">بحاجة للمراجعة</p>
          </div>
        </div>

        {/* Document Type (Template) Filter Bar */}
        <div className="mt-6 rounded-3xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-xs font-black text-gray-500">
            <TagIcon className="h-4 w-4 text-orange-500" />
            <span>تصفية حسب نوع القالب / شاشة أونكس:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setDocTypeFilter("all")}
              className={`rounded-xl px-3.5 py-2 text-xs font-black transition ${
                docTypeFilter === "all"
                  ? "bg-black text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              جميع القوالب ({totalCount})
            </button>
            {ONYX_TEMPLATE_LIST.map((tpl) => {
              const count = invoices.filter(
                (i) => (i.doc_type || "cash_invoice") === tpl.id
              ).length;
              return (
                <button
                  key={tpl.id}
                  onClick={() => setDocTypeFilter(tpl.id)}
                  className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    docTypeFilter === tpl.id
                      ? "bg-orange-600 text-white shadow-sm"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <span>{tpl.shortLabel}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${
                      docTypeFilter === tpl.id
                        ? "bg-white/20 text-white"
                        : "bg-white text-gray-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search & Status Filter Bar */}
        <div className="mt-4 flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <SearchIcon className="absolute right-4 top-3.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="ابحث برقم المستند، كود العميل، اسم العميل/المورد، أو رقم الجوال..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-[#f8f8f6] py-3 pr-11 pl-4 text-sm font-bold text-gray-800 outline-none focus:border-orange-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <FilterIcon className="ml-1 hidden h-4 w-4 text-gray-400 sm:block" />
            <button
              onClick={() => setStatusFilter("all")}
              className={`rounded-xl px-4 py-2.5 text-xs font-black transition ${
                statusFilter === "all"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              الكل ({totalCount})
            </button>
            <button
              onClick={() => setStatusFilter("pending")}
              className={`rounded-xl px-4 py-2.5 text-xs font-black transition ${
                statusFilter === "pending"
                  ? "bg-amber-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              بانتظار الإرسال ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter("sent")}
              className={`rounded-xl px-4 py-2.5 text-xs font-black transition ${
                statusFilter === "sent"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              تم الإرسال ({sentCount})
            </button>
            <button
              onClick={() => setStatusFilter("failed")}
              className={`rounded-xl px-4 py-2.5 text-xs font-black transition ${
                statusFilter === "failed"
                  ? "bg-red-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              فشل ({failedCount})
            </button>
          </div>
        </div>

        {/* Documents List / Table */}
        <div className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm">
          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
              <p className="mt-4 font-bold text-gray-500">جاري تحميل العمليات...</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="py-20 text-center">
              <InvoiceDocumentIcon className="mx-auto h-16 w-16 text-gray-300" />
              <h3 className="mt-4 text-lg font-black text-gray-800">لا توجد عمليات مطابقة</h3>
              <p className="mt-1 text-sm text-gray-500">
                تأكد من تشغيل خدمة المزامنة التلقائية مع نظام أونكس أو اضغط تحديث البيانات.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="border-b border-gray-100 bg-gray-50/70 text-xs font-black text-gray-500">
                  <tr>
                    <th className="px-5 py-4">رقم المستند</th>
                    <th className="px-5 py-4">نوع القالب / الشاشة</th>
                    <th className="px-5 py-4">العميل / المورد</th>
                    <th className="px-5 py-4">رقم الجوال</th>
                    <th className="px-5 py-4">المبلغ والرصيد</th>
                    <th className="px-5 py-4">التاريخ</th>
                    <th className="px-5 py-4">الحالة</th>
                    <th className="px-5 py-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredInvoices.map((inv) => {
                    const tpl = getOnyxTemplate(inv.doc_type);
                    return (
                      <tr key={inv.id} className="transition hover:bg-gray-50/50">
                        <td className="px-5 py-4">
                          <p className="font-mono font-black text-gray-900" dir="ltr">
                            {inv.invoice_number}
                          </p>
                          {inv.customer_code && (
                            <p className="mt-0.5 text-[11px] font-bold text-gray-400">
                              كود: {inv.customer_code}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-black ${tpl.badgeColor}`}
                          >
                            {tpl.shortLabel}
                          </span>
                          <p className="mt-1 font-mono text-[10px] font-bold text-gray-400">
                            {inv.onyx_form_code || tpl.onyxScreenCode}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {inv.attachment_url && (
                              <a
                                href={inv.attachment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-1.5 py-0.5 text-[10px] font-black text-orange-700 hover:bg-orange-100"
                              >
                                <PaperclipIcon className="h-2.5 w-2.5" />
                                <span>PDF أونكس</span>
                              </a>
                            )}
                            {inv.doc_type === "purchase_order" && inv.status === "pending" && (
                              <span className="inline-flex items-center rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">
                                إرسال يدوي فقط
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-bold text-gray-900">{inv.customer_name}</p>
                          {inv.details && (
                            <p className="mt-0.5 text-xs text-gray-400 line-clamp-1">
                              {inv.details}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4 font-mono font-bold text-gray-700" dir="ltr">
                          {inv.phone}
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-black text-orange-600">
                            {inv.amount} {inv.currency || "ر.س"}
                          </p>
                          {inv.remaining_balance !== undefined &&
                            inv.remaining_balance !== null &&
                            String(inv.remaining_balance).trim() !== "" && (
                              <p className="mt-0.5 text-[11px] font-bold text-gray-500">
                                الرصيد: {inv.remaining_balance} {inv.currency || "ر.س"}
                              </p>
                            )}
                          {inv.payment_method && (
                            <p className="mt-0.5 text-[10px] font-semibold text-gray-400">
                              {inv.payment_method}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4 text-xs font-semibold text-gray-500">
                          {inv.invoice_date}
                        </td>

                        <td className="px-5 py-4">
                          {inv.status === "sent" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
                              <span className="h-2 w-2 rounded-full bg-green-500"></span>
                              تم الإرسال
                            </span>
                          ) : inv.status === "failed" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                              <span className="h-2 w-2 rounded-full bg-red-500"></span>
                              فشل الإرسال
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                              بانتظار الإرسال
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openSendModal(inv)}
                              className="flex items-center gap-1.5 rounded-xl bg-green-600 px-3.5 py-2 text-xs font-black text-white shadow-sm transition hover:bg-green-700 active:scale-95"
                            >
                              <WhatsAppIcon className="h-3.5 w-3.5 fill-current" />
                              <span>إرسال</span>
                            </button>
                            <a
                              href={`https://wa.me/${inv.phone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2 text-gray-600 transition hover:bg-gray-100"
                              title="فتح محادثة واتساب عادية"
                            >
                              <ExternalLinkIcon className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 text-xs font-bold text-gray-400 sm:flex-row">
          <p>نظام إشعارات فواتير وعمليات البناء الحديث © 2026</p>
          <Link href="/" className="hover:text-orange-600">
            العودة للمتجر الرئيسي
          </Link>
        </div>
      </div>

      {/* --- MODAL: Send Template Dialog --- */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-[#fbfbfa] px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-600 text-white">
                  <BoltIcon className="h-5 w-5 fill-current" />
                </span>
                <div>
                  <h3 className="text-lg font-black text-gray-900">
                    إرسال إشعار واتساب ({activeTemplateDef.label})
                  </h3>
                  <p className="text-xs font-bold text-gray-500">
                    مستند رقم {selectedInvoice.invoice_number} — {selectedInvoice.customer_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="max-h-[75vh] overflow-y-auto p-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Left: Template Settings & Variables */}
                <div className="space-y-4">
                  {/* Template Type Selector */}
                  <div>
                    <label className="text-xs font-black text-gray-700">
                      نوع القالب (مطابق لقوالب Word / Onyx):
                    </label>
                    <select
                      value={activeDocType}
                      onChange={(e) => handleModalDocTypeChange(e.target.value as OnyxDocType)}
                      className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold text-gray-800 outline-none focus:border-green-600"
                    >
                      {ONYX_TEMPLATE_LIST.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.label} ({tpl.onyxScreenCode})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Send Mode Toggle */}
                  <div>
                    <label className="text-xs font-black text-gray-700">طريقة الإرسال:</label>
                    <div className="mt-1.5 grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
                      <button
                        type="button"
                        onClick={() => setSendMode("template")}
                        className={`rounded-lg py-2 text-xs font-black transition ${
                          sendMode === "template"
                            ? "bg-white text-green-700 shadow-sm"
                            : "text-gray-500 hover:text-gray-800"
                        }`}
                      >
                        قالب Utility رسمي
                      </button>
                      <button
                        type="button"
                        onClick={() => setSendMode("text")}
                        className={`rounded-lg py-2 text-xs font-black transition ${
                          sendMode === "text"
                            ? "bg-white text-orange-600 shadow-sm"
                            : "text-gray-500 hover:text-gray-800"
                        }`}
                      >
                        رسالة نصية مباشرة
                      </button>
                    </div>
                  </div>

                  {sendMode === "template" && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="text-xs font-black text-gray-700">
                          اسم القالب في Meta:
                        </label>
                        <input
                          type="text"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 font-mono text-xs font-bold outline-none focus:border-green-600"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-black text-gray-700">اللغة:</label>
                        <input
                          type="text"
                          value={languageCode}
                          onChange={(e) => setLanguageCode(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold outline-none focus:border-green-600"
                        />
                      </div>
                    </div>
                  )}

                  {/* Dynamic Variables for Selected Template */}
                  <div className="rounded-2xl border border-gray-100 bg-[#f9f9f8] p-4">
                    <p className="text-xs font-black text-gray-800">
                      متغيرات القالب ({activeTemplateDef.variables.length} متغيرات):
                    </p>

                    <div className="mt-3 space-y-3">
                      {activeTemplateDef.variables.map((v, idx) => (
                        <div key={v.key + idx}>
                          <span className="text-[11px] font-bold text-gray-500">
                            {`{{${v.index}}}`} {v.label}:
                          </span>
                          <input
                            type="text"
                            value={parameters[idx] ?? ""}
                            onChange={(e) => handleParamChange(idx, e.target.value)}
                            placeholder={v.placeholder}
                            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-orange-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Optional Attachment PDF Link */}
                  {activeTemplateDef.hasAttachment && (
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-black text-gray-700">
                        <PaperclipIcon className="h-3.5 w-3.5 text-gray-500" />
                        <span>رابط مرفق PDF (اختياري):</span>
                      </label>
                      <input
                        type="url"
                        value={headerUrl}
                        onChange={(e) => setHeaderUrl(e.target.value)}
                        placeholder="https://modernbuildingsa.com/files/doc.pdf"
                        className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2 font-mono text-xs outline-none focus:border-green-600"
                        dir="ltr"
                      />
                    </div>
                  )}
                </div>

                {/* Right: Live WhatsApp Phone Preview */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-gray-700">
                      معاينة الرسالة المطابقة لقالب Word:
                    </label>
                    <span className="font-mono text-[11px] font-bold text-gray-500" dir="ltr">
                      {selectedInvoice.phone}
                    </span>
                  </div>

                  <div className="mt-2 rounded-3xl border border-gray-200 bg-[#efeae2] p-4 shadow-inner">
                    {/* Simulated WhatsApp Chat Bubble */}
                    <div className="relative rounded-2xl bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                        <BuildingIcon className="h-4 w-4 text-green-700" />
                        <div>
                          <p className="text-xs font-black text-green-700">
                            مؤسسة البناء الحديث
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {activeTemplateDef.label}
                          </p>
                        </div>
                      </div>

                      {headerUrl.trim() && (
                        <div className="mt-3 flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 p-2.5 text-[11px] font-bold text-gray-700">
                          <PaperclipIcon className="h-4 w-4 text-orange-600" />
                          <span className="truncate">مرفق PDF: {selectedInvoice.invoice_number}.pdf</span>
                        </div>
                      )}

                      <div className="mt-3 whitespace-pre-line text-xs leading-6 text-gray-800">
                        {livePreviewText}
                      </div>

                      <div
                        className="mt-3 flex items-center justify-end gap-1 text-[10px] text-gray-400"
                        dir="ltr"
                      >
                        <span>
                          {new Date().toLocaleTimeString("ar-EG", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <DoubleCheckIcon className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                    </div>

                    <div className="mt-3 text-center">
                      <span className="inline-block rounded-full bg-black/10 px-3 py-1 text-[10px] font-bold text-gray-600">
                        {sendMode === "template"
                          ? `قالب Utility رسمي (${templateName})`
                          : "رسالة نصية مباشرة (داخل نافذة 24 ساعة)"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-gray-100 bg-[#fbfbfa] px-6 py-4">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="rounded-xl px-5 py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-100"
              >
                إلغاء
              </button>

              <button
                onClick={handleSendTemplate}
                disabled={sending}
                className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-green-700 disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                    <span>جاري الإرسال...</span>
                  </>
                ) : (
                  <>
                    <SendPlaneIcon className="h-4 w-4" />
                    <span>إرسال عبر واتساب الآن</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
