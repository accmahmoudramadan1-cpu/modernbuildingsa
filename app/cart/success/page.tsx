"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order");

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-white px-6 py-16"
    >
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-green-100 text-5xl">
          ✓
        </div>

        <h1 className="mt-8 text-3xl font-black">
          تم إرسال طلبك بنجاح 🎉
        </h1>

        <p className="mt-4 text-lg leading-8 text-gray-500">
          شكرًا لك. تم استلام طلبك، وسنتواصل معك لتأكيد
          التفاصيل والسعر وموعد التوصيل.
        </p>

        {orderId && (
          <div className="mt-6 rounded-2xl bg-[#f8f8f6] p-5">
            <p className="text-sm font-bold text-gray-500">
              رقم الطلب
            </p>

            <p className="mt-2 break-all font-black">
              {orderId}
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/#products"
            className="flex-1 rounded-2xl bg-orange-600 px-6 py-4 font-black text-white transition hover:bg-orange-700"
          >
            متابعة التسوق
          </Link>

          <Link
            href="/"
            className="flex-1 rounded-2xl border border-black/10 bg-white px-6 py-4 font-bold transition hover:bg-gray-100"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function CartSuccessPage() {
  return (
    <Suspense
      fallback={
        <main
          dir="rtl"
          className="flex min-h-screen items-center justify-center bg-white px-6"
        >
          <div className="text-center">
            <div className="text-5xl">✓</div>
            <p className="mt-4 font-bold text-gray-500">
              جاري تحميل الطلب...
            </p>
          </div>
        </main>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}