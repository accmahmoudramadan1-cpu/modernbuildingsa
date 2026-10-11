import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  async function handleLogout() {
    "use server";

    const supabase = await createClient();

    await supabase.auth.signOut();

    redirect("/admin/login");
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#111111] text-white">
      <header className="border-b border-white/10 bg-[#1b1b1b]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold">
              لوحة تحكم البناء الحديث
            </h1>

            <p className="mt-1 text-sm text-gray-400">
              إدارة الأقسام والمنتجات والصور والأسعار
            </p>
          </div>

          <form action={handleLogout}>
            <button
              type="submit"
              className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold hover:bg-white/5"
            >
              تسجيل الخروج
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <h2 className="text-xl font-bold">
          مرحبًا بك 👋
        </h2>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#1b1b1b] p-6">
            <h3 className="text-lg font-bold">
              الأقسام
            </h3>

            <p className="mt-2 text-sm text-gray-400">
              إضافة وتعديل وحذف أقسام المتجر
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#1b1b1b] p-6">
  <h3 className="text-lg font-bold">
    المنتجات
  </h3>

  <p className="mt-2 text-sm text-gray-400">
    إضافة وتعديل وحذف المنتجات والأسعار والصور
  </p>

  <a
    href="/admin/products"
    className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-600"
  >
    إدارة المنتجات
  </a>
</div>

          <div className="rounded-2xl border border-white/10 bg-[#1b1b1b] p-6">
            <h3 className="text-lg font-bold">
              الصور
            </h3>

            <p className="mt-2 text-sm text-gray-400">
              رفع صور الأقسام والمنتجات
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#1b1b1b] p-6">
  <h3 className="text-lg font-bold">
    الطلبات
  </h3>

  <p className="mt-2 text-sm text-gray-400">
    مشاهدة وإدارة طلبات العملاء وتحديث حالتها.
  </p>

  <Link
    href="/admin/orders"
    className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-600"
  >
    إدارة الطلبات
  </Link>
</div>
        </div>
      </section>
    </main>
  );
}

