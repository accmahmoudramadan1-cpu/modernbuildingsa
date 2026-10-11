"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { useCart } from "@/components/CartProvider";

export default function CheckoutPage() {
  const router = useRouter();
  const supabase = createClient();

  const { items, clearCart } = useCart();

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const total = items.reduce((sum, item) => {
    if (
      !item.product.show_price ||
      item.product.price === null
    ) {
      return sum;
    }

    return sum + item.product.price * item.quantity;
  }, 0);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (items.length === 0) {
      setMessage("السلة فارغة.");
      return;
    }

    if (!customerName.trim() || !phone.trim()) {
      setMessage("من فضلك اكتب اسم العميل ورقم الهاتف.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_name: customerName.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        status: "new",
      })
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("خطأ في إنشاء الطلب:", orderError?.message);
      setMessage("حدث خطأ أثناء إرسال الطلب. حاول مرة أخرى.");
      setLoading(false);
      return;
    }

    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: item.quantity,
      price: item.product.show_price
        ? item.product.price
        : null,
      currency: item.product.currency || null,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      console.error(
        "خطأ في حفظ منتجات الطلب:",
        itemsError.message
      );

      await supabase
        .from("orders")
        .delete()
        .eq("id", order.id);

      setMessage(
        "حدث خطأ أثناء حفظ المنتجات. حاول مرة أخرى."
      );
      setLoading(false);
      return;
    }

    clearCart();

    router.push(`/cart/success?order=${order.id}`);
  }

  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-white px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-7xl">🛒</div>

          <h1 className="mt-6 text-3xl font-black">
            السلة فارغة
          </h1>

          <p className="mt-3 text-gray-500">
            أضف منتجات إلى السلة أولًا ثم أكمل الطلب.
          </p>

          <Link
            href="/#products"
            className="mt-8 inline-flex rounded-2xl bg-orange-600 px-8 py-4 font-bold text-white transition hover:bg-orange-700"
          >
            تصفح المنتجات
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div>
          <h1 className="text-3xl font-black">
            إتمام الطلب
          </h1>

          <p className="mt-2 text-gray-500">
            أدخل بياناتك وسنتواصل معك لتأكيد الطلب.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-black/5 bg-[#f8f8f6] p-6"
          >
            <h2 className="text-xl font-black">
              بيانات العميل
            </h2>

            <div className="mt-6 grid gap-5">
              <div>
                <label className="mb-2 block text-sm font-bold">
                  الاسم الكامل
                </label>

                <input
                  type="text"
                  value={customerName}
                  onChange={(e) =>
                    setCustomerName(e.target.value)
                  }
                  placeholder="اكتب اسمك"
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-4 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold">
                  رقم الهاتف
                </label>

                <input
                  type="tel"
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value)
                  }
                  placeholder="اكتب رقم الهاتف"
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-4 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold">
                  رقم واتساب
                </label>

                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) =>
                    setWhatsapp(e.target.value)
                  }
                  placeholder="اكتب رقم واتساب"
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-4 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold">
                  العنوان
                </label>

                <textarea
                  value={address}
                  onChange={(e) =>
                    setAddress(e.target.value)
                  }
                  placeholder="اكتب عنوان التوصيل"
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-4 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold">
                  ملاحظات إضافية
                </label>

                <textarea
                  value={notes}
                  onChange={(e) =>
                    setNotes(e.target.value)
                  }
                  placeholder="أي ملاحظات خاصة بالطلب"
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-4 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
            </div>

            {message && (
              <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-600">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-2xl bg-orange-600 px-6 py-4 font-black text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "جاري إرسال الطلب..."
                : "تأكيد وإرسال الطلب"}
            </button>
          </form>

          <aside className="h-fit rounded-3xl border border-black/5 bg-[#f8f8f6] p-6">
            <h2 className="text-xl font-black">
              ملخص الطلب
            </h2>

            <div className="mt-5 space-y-4">
              {items.map((item) => (
                <div
                  key={item.product.id}
                  className="flex justify-between gap-4 border-b border-black/5 pb-4"
                >
                  <div>
                    <p className="font-black">
                      {item.product.name}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      الكمية: {item.quantity}
                    </p>
                  </div>

                  {item.product.show_price &&
                  item.product.price !== null ? (
                    <p className="shrink-0 font-bold text-orange-600">
                      {item.product.price *
                        item.quantity}{" "}
                      {item.product.currency || ""}
                    </p>
                  ) : (
                    <p className="shrink-0 text-xs font-bold text-gray-500">
                      السعر عند التواصل
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <span className="font-bold">
                الإجمالي
              </span>

              <span className="text-xl font-black text-orange-600">
                {total}
              </span>
            </div>

            <Link
              href="/cart"
              className="mt-5 block text-center text-sm font-bold text-gray-500 transition hover:text-orange-600"
            >
              ← العودة إلى السلة
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}

