"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface OracleInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  phone: string;
  invoice_date: string;
  amount: number | string;
  currency: string;
  details?: string;
  status: "pending" | "sent" | "failed";
  whatsapp_message_id?: string | null;
  sent_at?: string | null;
  created_at: string;
}

export default function WhatsAppInvoicesPage() {
  const [invoices, setInvoices] = useState<OracleInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "sent" | "failed">("all");
  
  // Modal states
  const [selectedInvoice, setSelectedInvoice] = useState<OracleInvoice | null>(null);
  const [templateName, setTemplateName] = useState("invoice_utility");
  const [languageCode, setLanguageCode] = useState("ar");
  const [param1, setParam1] = useState(""); // Customer Name
  const [param2, setParam2] = useState(""); // Invoice Number
  const [param3, setParam3] = useState(""); // Amount
  const [param4, setParam4] = useState(""); // Date / Details
  const [sending, setSending] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Script & Settings Modal
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Load Invoices from API
  async function loadInvoices() {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/oracle-orders", { cache: "no-store" });
      const data = await res.json();
      if (data.success && Array.isArray(data.invoices)) {
        setInvoices(data.invoices);
      } else {
        setActionMessage({
          type: "error",
          text: data.error || "حدث خطأ أثناء تحميل الفواتير.",
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: "تعذر الاتصال بالخادم لجلب بيانات الفواتير.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoices();
  }, []);

  // Open Template Modal for an invoice
  function openSendModal(inv: OracleInvoice) {
    setSelectedInvoice(inv);
    setParam1(inv.customer_name || "عميلنا العزيز");
    setParam2(inv.invoice_number);
    setParam3(`${inv.amount} ${inv.currency || "ر.س"}`);
    setParam4(inv.invoice_date || new Date().toISOString().split("T")[0]);
    setActionMessage(null);
  }

  // Submit Template Send
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
          customerName: param1,
          amount: param3,
          invoiceDate: param4,
          currency: selectedInvoice.currency || "ر.س",
          templateName: templateName.trim(),
          languageCode: languageCode.trim(),
          customParameters: [param1, param2, param3, param4],
        }),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        setActionMessage({
          type: "success",
          text: `✅ تم إرسال فاتورة رقم (${selectedInvoice.invoice_number}) إلى ${selectedInvoice.phone} بنجاح!`,
        });

        // Update local state
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
          text: `❌ فشل الإرسال: ${result.error || "تأكد من اعتماد القالب ومفتاح Meta"}`,
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

  // Quick Mock / Add Demo Invoice
  async function handleAddMockInvoice() {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const mockInv = {
      invoice_number: `INV-2026-${randomNum}`,
      customer_name: "مؤسسة الرواد للمقاولات",
      phone: "0554303422",
      amount: "3750.00",
      currency: "ر.س",
      invoice_date: new Date().toISOString().split("T")[0],
      details: "توريد دهانات ومواد عزل من نظام OraNT",
      status: "pending",
    };

    try {
      const res = await fetch("/api/oracle-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockInv),
      });
      if (res.ok) {
        loadInvoices();
        setActionMessage({
          type: "success",
          text: `تمت إضافة فاتورة تجريبية رقم (${mockInv.invoice_number}) بنجاح!`,
        });
      }
    } catch (e) {}
  }

  // Filter & Search
  const filteredInvoices = invoices.filter((item) => {
    const matchesSearch =
      item.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.phone.includes(searchQuery);

    const matchesStatus =
      statusFilter === "all" ? true : item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalCount = invoices.length;
  const pendingCount = invoices.filter((i) => i.status === "pending").length;
  const sentCount = invoices.filter((i) => i.status === "sent").length;
  const failedCount = invoices.filter((i) => i.status === "failed").length;

  return (
    <main dir="rtl" className="min-h-screen bg-[#f5f5f3] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        {/* Navigation & Header */}
        <div className="flex flex-col gap-4 border-b border-black/10 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-600 text-xl text-white shadow-sm">
                💬
              </span>
              <div>
                <h1 className="text-2xl font-black text-gray-900 sm:text-3xl">
                  إدارة فواتير واتساب (OraNT / OnyxPro)
                </h1>
                <p className="text-sm font-semibold text-gray-500">
                  استيراد الفواتير من نظام أوراكل وإرسال إشعارات رسمية بقوالب Utility
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowScriptModal(true)}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-100"
            >
              ⚙️ كود سكربت OraNT
            </button>
            <button
              onClick={handleAddMockInvoice}
              className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-bold text-orange-700 transition hover:bg-orange-100"
            >
              ➕ إضافة فاتورة للتجربة
            </button>
            <button
              onClick={loadInvoices}
              disabled={loading}
              className="rounded-xl bg-black px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-50"
            >
              {loading ? "جاري التحديث..." : "🔄 تحديث الفواتير"}
            </button>
          </div>
        </div>

        {/* Action Alert Banner */}
        {actionMessage && (
          <div
            className={`mt-6 rounded-2xl p-4 text-sm font-bold shadow-sm ${
              actionMessage.type === "success"
                ? "border border-green-200 bg-green-50 text-green-800"
                : "border border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {actionMessage.text}
          </div>
        )}

        {/* Statistics Cards */}
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs font-bold text-gray-400">إجمالي الفواتير المستوردة</p>
            <p className="mt-2 text-3xl font-black text-gray-900">{totalCount}</p>
            <p className="mt-1 text-xs text-gray-500">من نظام أوراكل OraNT</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs font-bold text-amber-500">بانتظار الإرسال</p>
            <p className="mt-2 text-3xl font-black text-amber-600">{pendingCount}</p>
            <p className="mt-1 text-xs text-gray-500">جاهزة لإرسال الواتساب</p>
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

        {/* Filter & Search Bar */}
        <div className="mt-8 flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="ابحث برقم الفاتورة، اسم العميل، أو رقم الهاتف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-[#f8f8f6] px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:border-orange-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
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

        {/* Invoices List / Table */}
        <div className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm">
          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
              <p className="mt-4 font-bold text-gray-500">جاري تحميل الفواتير...</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="py-20 text-center">
              <div className="text-5xl">📄</div>
              <h3 className="mt-3 text-lg font-black text-gray-800">لا توجد فواتير مطابقة</h3>
              <p className="mt-1 text-sm text-gray-500">
                تأكد من تشغيل سكربت استيراد الفواتير على جهاز OraNT أو أضف فاتورة للتجربة.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="border-b border-gray-100 bg-gray-50/70 text-xs font-black text-gray-500">
                  <tr>
                    <th className="px-6 py-4">رقم الفاتورة</th>
                    <th className="px-6 py-4">اسم العميل</th>
                    <th className="px-6 py-4">رقم الجوال</th>
                    <th className="px-6 py-4">المبلغ</th>
                    <th className="px-6 py-4">تاريخ الفاتورة</th>
                    <th className="px-6 py-4">حالة الإرسال</th>
                    <th className="px-6 py-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="transition hover:bg-gray-50/50">
                      <td className="px-6 py-4 font-black text-gray-900">
                        {inv.invoice_number}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-900">{inv.customer_name}</p>
                        {inv.details && (
                          <p className="text-xs text-gray-400 line-clamp-1">{inv.details}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-gray-700" dir="ltr">
                        {inv.phone}
                      </td>
                      <td className="px-6 py-4 font-black text-orange-600">
                        {inv.amount} {inv.currency || "ر.س"}
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-gray-500">
                        {inv.invoice_date}
                      </td>
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openSendModal(inv)}
                            className="rounded-xl bg-green-600 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-green-700 active:scale-95"
                          >
                            💬 إرسال فاتورة واتساب
                          </button>
                          <a
                            href={`https://wa.me/${inv.phone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-xl border border-gray-200 bg-white p-2 text-gray-600 transition hover:bg-gray-100"
                            title="فتح محادثة واتساب عادية"
                          >
                            🔗
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 text-xs font-bold text-gray-400 sm:flex-row">
          <p>نظام إشعارات فواتير البناء الحديث © 2026</p>
          <div className="flex gap-4">
            <Link href="/admin/orders" className="hover:text-orange-600">
              طلبات المتجر الإلكتروني
            </Link>
            <span>•</span>
            <Link href="/" className="hover:text-orange-600">
              المتجر الرئيسي
            </Link>
          </div>
        </div>
      </div>

      {/* --- MODAL: Send Template Dialog --- */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-[#fbfbfa] px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-600 text-lg text-white">
                  ⚡
                </span>
                <div>
                  <h3 className="text-lg font-black text-gray-900">
                    إرسال إشعار الفاتورة عبر قالب واتساب رسمي
                  </h3>
                  <p className="text-xs font-bold text-gray-500">
                    فاتورة رقم {selectedInvoice.invoice_number} إلى العميل ({selectedInvoice.customer_name})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="max-h-[75vh] overflow-y-auto p-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Left: Template Settings & Variables */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-black text-gray-700">
                      اسم القالب المعتمد (Template Name):
                    </label>
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g. invoice_utility"
                      className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-bold font-mono outline-none focus:border-green-600"
                    />
                    <p className="mt-1 text-[11px] text-gray-400">
                      اسم القالب كما هو مسجل ومعتمد في Meta WhatsApp Manager.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-black text-gray-700">
                        لغة القالب:
                      </label>
                      <input
                        type="text"
                        value={languageCode}
                        onChange={(e) => setLanguageCode(e.target.value)}
                        placeholder="ar"
                        className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-bold outline-none focus:border-green-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-black text-gray-700">
                        رقم هاتف المستلم:
                      </label>
                      <input
                        type="text"
                        disabled
                        value={selectedInvoice.phone}
                        className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs font-bold text-gray-600"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  {/* Variables */}
                  <div className="rounded-2xl border border-gray-100 bg-[#f9f9f8] p-4">
                    <p className="text-xs font-black text-gray-800">
                      متغيرات القالب التلقائية (Variables):
                    </p>

                    <div className="mt-3 space-y-3">
                      <div>
                        <span className="text-[11px] font-bold text-gray-500">
                          {"{{1}}"} اسم العميل:
                        </span>
                        <input
                          type="text"
                          value={param1}
                          onChange={(e) => setParam1(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-orange-500"
                        />
                      </div>

                      <div>
                        <span className="text-[11px] font-bold text-gray-500">
                          {"{{2}}"} رقم الفاتورة:
                        </span>
                        <input
                          type="text"
                          value={param2}
                          onChange={(e) => setParam2(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-orange-500"
                        />
                      </div>

                      <div>
                        <span className="text-[11px] font-bold text-gray-500">
                          {"{{3}}"} المبلغ الإجمالي:
                        </span>
                        <input
                          type="text"
                          value={param3}
                          onChange={(e) => setParam3(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-orange-500"
                        />
                      </div>

                      <div>
                        <span className="text-[11px] font-bold text-gray-500">
                          {"{{4}}"} تاريخ الفاتورة:
                        </span>
                        <input
                          type="text"
                          value={param4}
                          onChange={(e) => setParam4(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Live WhatsApp Phone Preview */}
                <div>
                  <label className="text-xs font-black text-gray-700">
                    معاينة شكل الرسالة لدى العميل:
                  </label>

                  <div className="mt-2 rounded-3xl border border-gray-200 bg-[#efeae2] p-4 shadow-inner">
                    {/* Simulated WhatsApp Chat Bubble */}
                    <div className="relative rounded-2xl bg-white p-4 shadow-sm">
                      <div className="border-b border-gray-100 pb-2">
                        <p className="text-xs font-black text-green-700">
                          🏢 مؤسسة البناء الحديث
                        </p>
                        <p className="text-[11px] text-gray-400">إشعار فاتورة إلكترونية</p>
                      </div>

                      <div className="mt-3 space-y-2 text-xs leading-relaxed text-gray-800">
                        <p>
                          مرحباً <span className="font-bold text-gray-900">{param1 || "العميل"}</span> 👋
                        </p>
                        <p>
                          تم إصدار فاتورتكم رقم{" "}
                          <span className="font-bold text-orange-600">{param2}</span>.
                        </p>
                        <p>
                          المبلغ الإجمالي المستحق:{" "}
                          <span className="font-black text-gray-900">{param3}</span>
                        </p>
                        <p className="text-[11px] text-gray-500">
                          تاريخ الإصدار: {param4}
                        </p>
                        <p className="text-[11px] text-gray-600">
                          شكراً لتعاملكم مع مؤسسة البناء الحديث.
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-gray-400" dir="ltr">
                        <span>{new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</span>
                        <span className="text-blue-500 font-bold">✓✓</span>
                      </div>
                    </div>

                    <div className="mt-3 text-center">
                      <span className="inline-block rounded-full bg-black/10 px-3 py-1 text-[10px] font-bold text-gray-600">
                        قالب Utility رسمي عبر Meta Cloud API
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
                    جاري الإرسال...
                  </>
                ) : (
                  <>🚀 إرسال الفاتورة عبر واتساب الآن</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: Script and Connection Info --- */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 bg-[#fbfbfa] px-6 py-5">
              <div>
                <h3 className="text-lg font-black text-gray-900">
                  ربط السكربت الخارجي لنظام أوراكل (OraNT)
                </h3>
                <p className="text-xs font-bold text-gray-500">
                  خطوات تشغيل السكربت على جهاز أوراكل لإرسال الفواتير إلى الموقع تلقائياً
                </p>
              </div>
              <button
                onClick={() => setShowScriptModal(false)}
                className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-6 space-y-5 text-sm">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                <h4 className="font-black text-blue-900">📌 كيف يعمل الربط؟</h4>
                <ol className="mt-2 list-decimal pr-5 space-y-1 text-xs text-blue-800 leading-relaxed font-semibold">
                  <li>السكربت الخارجي يعمل على الجهاز المثبت عليه أوراكل / OraNT بحساب يملك صلاحية قراءة.</li>
                  <li>يستخرج الفواتير الجديدة (رقم الفاتورة، العميل، الهاتف، المبلغ، التاريخ).</li>
                  <li>يرسلها عبر رابط الـ API المشفر (HTTPS) إلى هذا الموقع لتظهر فوراً في هذه الصفحة.</li>
                  <li>من هذه الصفحة يمكنك إرسال إشعارات الفواتير عبر قوالب Utility الرسمية بنقرة زر واحدة!</li>
                </ol>
              </div>

              <div>
                <p className="text-xs font-black text-gray-700">
                  رابط الـ API المستقبل للفواتير (Endpoint):
                </p>
                <div className="mt-1.5 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-xs font-bold text-gray-800" dir="ltr">
                  <span>https://modernbuildingsa.com/api/oracle-orders</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-gray-700">
                    ملف السكربت الجاهز (Python):
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `# مسار الملف موجود في: scripts/sync_orant_invoices.py داخل المشروع`
                      );
                      setCopiedScript(true);
                      setTimeout(() => setCopiedScript(false), 3000);
                    }}
                    className="text-xs font-bold text-orange-600 hover:underline"
                  >
                    {copiedScript ? "✅ تم النسخ!" : "نسخ مسار الملف"}
                  </button>
                </div>
                <div className="mt-2 rounded-2xl bg-gray-900 p-4 font-mono text-xs text-green-400" dir="ltr">
                  <p># لتشغيل السكربت على جهاز OraNT:</p>
                  <p className="text-white mt-1">pip install oracledb requests</p>
                  <p className="text-white mt-1">python scripts/sync_orant_invoices.py --mock</p>
                  <p className="text-gray-400 mt-2"># أو للتشغيل مع قاعدة بيانات أوراكل الحية:</p>
                  <p className="text-white">python scripts/sync_orant_invoices.py</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 bg-[#fbfbfa] px-6 py-4 text-left">
              <button
                onClick={() => setShowScriptModal(false)}
                className="rounded-xl bg-black px-6 py-2.5 text-xs font-black text-white hover:bg-orange-600"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
