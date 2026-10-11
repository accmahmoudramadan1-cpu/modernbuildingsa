"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";

type Order = {
  id: string;
  customer_name: string;
  phone: string;
  whatsapp: string | null;
  address: string;
  notes: string | null;
  status: string;
  created_at: string;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  price: number | null;
  currency: string | null;
};

type OrderWithItems = Order & {
  items: OrderItem[];
};

const statusOptions = [
  { value: "new", label: "جديد" },
  { value: "processing", label: "قيد التجهيز" },
  { value: "delivered", label: "تم التسليم" },
  { value: "cancelled", label: "ملغي" },
];

function getStatusLabel(status: string) {
  return (
    statusOptions.find((item) => item.value === status)?.label || status
  );
}
function getWhatsAppLink(phone: string) {
  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.startsWith("966")) {
    return `https://wa.me/${cleaned}`;
  }

  if (cleaned.startsWith("0")) {
    return `https://wa.me/966${cleaned.slice(1)}`;
  }

  return `https://wa.me/966${cleaned}`;
}
export default function OrdersPage() {
  const supabase = createClient();

  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadOrders() {
    setLoading(true);

    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select(
        "id, customer_name, phone, whatsapp, address, notes, status, created_at"
      )
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error(ordersError);
      setMessage("حدث خطأ أثناء تحميل الطلبات.");
      setLoading(false);
      return;
    }

    const orderIds = (ordersData || []).map((order) => order.id);

    let itemsData: OrderItem[] = [];

    if (orderIds.length > 0) {
      const { data, error: itemsError } = await supabase
        .from("order_items")
        .select(
          "id, order_id, product_name, quantity, price, currency"
        )
        .in("order_id", orderIds);

      if (itemsError) {
        console.error(itemsError);
        setMessage("تم تحميل الطلبات لكن حدث خطأ في تفاصيل المنتجات.");
      } else {
        itemsData = data || [];
      }
    }

    const combinedOrders: OrderWithItems[] = (ordersData || []).map(
      (order) => ({
        ...order,
        items: itemsData.filter(
          (item) => item.order_id === order.id
        ),
      })
    );

    setOrders(combinedOrders);
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function updateStatus(orderId: string, status: string) {
    setMessage("");

    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", orderId);

    if (error) {
      console.error(error);
      setMessage("حدث خطأ أثناء تحديث حالة الطلب.");
      return;
    }

    setOrders((currentOrders) =>
      currentOrders.map((order) =>
        order.id === orderId
          ? { ...order, status }
          : order
      )
    );

    setMessage("تم تحديث حالة الطلب بنجاح.");
  }

  async function deleteOrder(orderId: string) {
    const confirmed = window.confirm(
      "هل أنت متأكد من حذف هذا الطلب؟"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("orders")
      .delete()
      .eq("id", orderId);

    if (error) {
      console.error(error);
      setMessage("حدث خطأ أثناء حذف الطلب.");
      return;
    }

    setOrders((currentOrders) =>
      currentOrders.filter((order) => order.id !== orderId)
    );

    setMessage("تم حذف الطلب.");
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f5f5f3] px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
  <a
    href="tel:+966558689100"
    className="rounded-2xl bg-black px-5 py-4 text-center font-bold text-white transition hover:bg-orange-600"
  >
    📞 0558689100
  </a>

  <a
    href="tel:+966501960009"
    className="rounded-2xl bg-black px-5 py-4 text-center font-bold text-white transition hover:bg-orange-600"
  >
    📞 0501960009
  </a>

  <a
    href="tel:+966175423431"
    className="rounded-2xl bg-gray-700 px-5 py-4 text-center font-bold text-white transition hover:bg-gray-800"
  >
    ☎️ 0175423431
  </a>

  <a
    href="https://wa.me/966554303422"
    target="_blank"
    rel="noopener noreferrer"
    className="rounded-2xl bg-green-600 px-5 py-4 text-center font-bold text-white transition hover:bg-green-700"
  >
    💬 واتساب 0554303422
  </a>
</div>
            <Link
              href="/admin"
              className="text-sm font-bold text-gray-500 transition hover:text-orange-600"
            >
              ← العودة للوحة التحكم
            </Link>

            <h1 className="mt-3 text-3xl font-black">
              الطلبات
            </h1>

            <p className="mt-2 text-gray-500">
              إدارة ومتابعة طلبات العملاء.
            </p>
          </div>

          <button
            type="button"
            onClick={loadOrders}
            className="rounded-2xl bg-black px-6 py-3 font-bold text-white transition hover:bg-orange-600"
          >
            تحديث الطلبات
          </button>
        </div>

        {message && (
          <div className="mt-6 rounded-2xl bg-white p-4 text-center font-bold">
            {message}
          </div>
        )}

        {loading ? (
          <div className="mt-8 rounded-3xl bg-white p-12 text-center">
            <p className="font-bold">جاري تحميل الطلبات...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="mt-8 rounded-3xl bg-white p-12 text-center">
            <div className="text-5xl">📦</div>

            <h2 className="mt-4 text-xl font-black">
              لا توجد طلبات حتى الآن
            </h2>

            <p className="mt-2 text-gray-500">
              عندما يرسل أحد العملاء طلبًا سيظهر هنا.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-3xl bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-4 border-b border-black/5 pb-5 md:flex-row md:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-black">
                        {order.customer_name}
                      </h2>

                      <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-bold">
                        {getStatusLabel(order.status)}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-gray-500">
                      رقم الطلب: {order.id}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      {new Date(order.created_at).toLocaleString(
                        "ar-EG"
                      )}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      value={order.status}
                      onChange={(e) =>
                        updateStatus(order.id, e.target.value)
                      }
                      className="rounded-xl border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-orange-500"
                    >
                      {statusOptions.map((status) => (
                        <option
                          key={status.value}
                          value={status.value}
                        >
                          {status.label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => deleteOrder(order.id)}
                      className="rounded-xl bg-red-50 px-4 py-3 font-bold text-red-600 transition hover:bg-red-100"
                    >
                      حذف الطلب
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-[#f8f8f6] p-4">
  <p className="text-sm font-bold text-gray-500">
    هاتف العميل
  </p>

  <p className="mt-2 font-black">
    {order.phone}
  </p>

  <div className="mt-3 flex flex-wrap gap-2">
    <a
      href={`tel:${order.phone}`}
      className="rounded-xl bg-black px-4 py-2.5 text-sm font-bold text-white transition hover:bg-orange-600"
    >
      📞 اتصال
    </a>

    <a
      href={getWhatsAppLink(order.phone)}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-green-700"
    >
      💬 واتساب
    </a>
  </div>
</div>
<div className="rounded-2xl bg-[#f8f8f6] p-4">
  <p className="text-sm font-bold text-gray-500">
    واتساب العميل
  </p>

  {order.whatsapp ? (
    <>
      <p className="mt-2 font-black">
        {order.whatsapp}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`tel:${order.whatsapp}`}
          className="rounded-xl bg-black px-4 py-2.5 text-sm font-bold text-white transition hover:bg-orange-600"
        >
          📞 اتصال
        </a>

        <a
          href={getWhatsAppLink(order.whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-green-700"
        >
          💬 فتح واتساب
        </a>
      </div>
    </>
  ) : (
    <p className="mt-2 font-bold text-gray-400">
      العميل لم يضف رقم واتساب
    </p>
  )}
</div>

                  <div className="rounded-2xl bg-[#f8f8f6] p-4 md:col-span-2">
                    <p className="text-sm font-bold text-gray-500">
                      العنوان
                    </p>

                    <p className="mt-1 font-bold leading-7">
                      {order.address}
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="font-black">
                    المنتجات المطلوبة
                  </h3>

                  <div className="mt-3 space-y-3">
                    {order.items.length > 0 ? (
                      order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col justify-between gap-2 rounded-2xl bg-[#f8f8f6] p-4 sm:flex-row sm:items-center"
                        >
                          <div>
                            <p className="font-black">
                              {item.product_name}
                            </p>

                            <p className="mt-1 text-sm text-gray-500">
                              الكمية: {item.quantity}
                            </p>
                          </div>

                          <div className="font-black text-orange-600">
                            {item.price !== null
                              ? `${item.price} ${
                                  item.currency || ""
                                }`
                              : "السعر غير محدد"}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-2xl bg-gray-50 p-4 text-gray-500">
                        لا توجد تفاصيل للمنتج.
                      </p>
                    )}
                  </div>
                </div>

                {order.notes && (
                  <div className="mt-6 rounded-2xl border border-orange-100 bg-orange-50 p-4">
                    <p className="font-black">
                      ملاحظات العميل
                    </p>

                    <p className="mt-2 leading-7 text-gray-700">
                      {order.notes}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

