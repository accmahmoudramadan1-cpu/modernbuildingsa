"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

type Product = {
  id: string;
  name: string;
  price: number | null;
  currency: string | null;
  show_price: boolean;
  image_url: string | null;
  available: boolean;
};

export default function OrderPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadProduct() {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, price, currency, show_price, image_url, available"
        )
        .eq("id", productId)
        .single();

      if (error || !data) {
        router.push("/");
        return;
      }

      setProduct(data);
      setLoading(false);
    }

    loadProduct();
  }, [productId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!product) return;

    if (!customerName.trim() || !phone.trim() || !address.trim()) {
      setMessage("من فضلك اكتب الاسم ورقم الهاتف والعنوان.");
      return;
    }

    if (quantity < 1) {
      setMessage("الكمية يجب أن تكون 1 على الأقل.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_name: customerName.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim() || null,
        address: address.trim(),
        notes: notes.trim() || null,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      console.error(orderError);
      setMessage("حدث خطأ أثناء إرسال الطلب. حاول مرة أخرى.");
      setSubmitting(false);
      return;
    }

    const { error: itemError } = await supabase
      .from("order_items")
      .insert({
        order_id: order.id,
        product_id: product.id,
        product_name: product.name,
        quantity,
        price: product.show_price ? product.price : null,
        currency: product.show_price ? product.currency : null,
      });

    if (itemError) {
      console.error(itemError);

      await supabase.from("orders").delete().eq("id", order.id);

      setMessage("حدث خطأ أثناء حفظ تفاصيل الطلب. حاول مرة أخرى.");
      setSubmitting(false);
      return;
    }

    router.push(`/products/${product.id}/order/success`);
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#f5f5f3]"
      >
        <p className="text-lg font-bold">جاري تحميل المنتج...</p>
      </main>
    );
  }

  if (!product) {
    return null;
  }

  if (!product.available) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#f5f5f3] px-6"
      >
        <div className="w-full max-w-xl rounded-3xl bg-white p-10 text-center shadow-sm">
          <div className="text-5xl">⚠️</div>

          <h1 className="mt-5 text-2xl font-black">
            المنتج غير متوفر حاليًا
          </h1>

          <Link
            href={`/products/${product.id}`}
            className="mt-6 inline-flex rounded-2xl bg-black px-6 py-4 font-bold text-white transition hover:bg-orange-600"
          >
            العودة للمنتج
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f5f5f3] px-6 py-10"
    >
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/products/${product.id}`}
          className="inline-flex font-bold text-gray-600 transition hover:text-orange-600"
        >
          ← العودة للمنتج
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="overflow-hidden rounded-2xl bg-gray-100">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="h-80 w-full object-cover"
                />
              ) : (
                <div className="flex h-80 items-center justify-center text-7xl">
                  🧱
                </div>
              )}
            </div>

            <h1 className="mt-6 text-2xl font-black">
              {product.name}
            </h1>

            <div className="mt-3">
              {product.show_price && product.price !== null ? (
                <span className="text-2xl font-black text-orange-600">
                  {product.price} {product.currency || ""}
                </span>
              ) : (
                <span className="font-bold text-gray-500">
                  تواصل معنا لمعرفة السعر
                </span>
              )}
            </div>

            <div className="mt-6 rounded-2xl bg-[#f8f8f6] p-5">
              <p className="font-bold text-gray-700">
                المنتج المطلوب:
              </p>

              <p className="mt-2 text-lg font-black">
                {product.name}
              </p>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
            <h2 className="text-2xl font-black">
              إتمام الطلب
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              اكتب بياناتك وسنتواصل معك لتأكيد الطلب.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block font-bold">
                  الاسم بالكامل *
                </label>

                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="اكتب اسمك"
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-4 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block font-bold">
                  رقم الهاتف *
                </label>

                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-4 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block font-bold">
                  رقم واتساب
                </label>

                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-4 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div>
                <label className="mb-2 block font-bold">
                  العنوان *
                </label>

                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="اكتب العنوان بالتفصيل"
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-4 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block font-bold">
                  الكمية *
                </label>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((current) => Math.max(1, current - 1))
                    }
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-black text-xl font-black text-white transition hover:bg-orange-600"
                  >
                    −
                  </button>

                  <div className="flex h-12 min-w-16 items-center justify-center rounded-xl border border-black/10 bg-[#f8f8f6] px-4 text-lg font-black">
                    {quantity}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((current) => current + 1)
                    }
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-black text-xl font-black text-white transition hover:bg-orange-600"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block font-bold">
                  ملاحظات إضافية
                </label>

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أي ملاحظات خاصة بالطلب..."
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-4 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              {message && (
                <div className="rounded-2xl bg-red-50 p-4 text-center font-bold text-red-600">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-2xl bg-orange-600 px-6 py-4 text-lg font-black text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "جاري إرسال الطلب..." : "تأكيد الطلب"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}