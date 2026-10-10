import Link from "next/link";

export default function OrderSuccessPage() {
  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[#f5f5f3] px-6"
    >
      <div className="w-full max-w-xl rounded-3xl bg-white p-10 text-center shadow-sm">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl">
          ✓
        </div>

        <h1 className="mt-6 text-3xl font-black">
          تم إرسال طلبك بنجاح 🎉
        </h1>

        <p className="mt-4 leading-8 text-gray-500">
          شكرًا لك. تم استلام طلبك وسنتواصل معك على رقم الهاتف
          لتأكيد التفاصيل وموعد التوصيل.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="flex-1 rounded-2xl bg-orange-600 px-6 py-4 text-center font-black text-white transition hover:bg-orange-700"
          >
            العودة للرئيسية
          </Link>

          <Link
            href="/#products"
            className="flex-1 rounded-2xl border border-black/10 bg-white px-6 py-4 text-center font-black transition hover:bg-gray-100"
          >
            تصفح المنتجات
          </Link>
        </div>
      </div>
    </main>
  );
}