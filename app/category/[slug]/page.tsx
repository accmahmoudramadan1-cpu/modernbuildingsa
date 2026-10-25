import NextImage from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { STORE_CATEGORIES, getCategoryBySlug } from "@/lib/categories-data";
import CategoryGallery from "@/components/CategoryGallery";

export async function generateStaticParams() {
  return STORE_CATEGORIES.map((cat) => ({
    slug: cat.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);

  if (!category) {
    return {
      title: "القسم غير موجود | مؤسسة محل البناء الحديث",
    };
  }

  return {
    title: `${category.name} | مؤسسة محل البناء الحديث للتجارة`,
    description: category.description,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const otherCategories = STORE_CATEGORIES.filter((c) => c.slug !== category.slug);

  const phoneLink = "tel:0558689100";
  const whatsappNumber = "0554304322";
  const whatsappLink = `https://wa.me/966554304322?text=${encodeURIComponent(
    `مرحباً مؤسسة محل البناء الحديث، أود الاستفسار عن منتجات قسم (${category.name})`
  )}`;

  return (
    <main dir="rtl" className="min-h-screen bg-[#f5f5f3] text-[#171717] w-full max-w-full overflow-x-hidden flex flex-col justify-between">
      <div>
        {/* Header (No cart button - display only) */}
        <header className="sticky top-0 z-50 border-b border-gray-200/90 bg-white/95 backdrop-blur-md shadow-xs w-full">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center shrink-0 group py-1"
              title="مؤسسة محل البناء الحديث للتجارة"
            >
              <div className="relative h-12 sm:h-14 md:h-16 lg:h-20 w-44 sm:w-56 md:w-64 lg:w-72 transition group-hover:opacity-90">
                <NextImage
                  src="/logo.png"
                  alt="مؤسسة محل البناء الحديث للتجارة"
                  fill
                  className="object-contain object-right"
                  priority
                />
              </div>
            </Link>

            {/* Navigation links */}
            <nav className="hidden md:flex items-center gap-5 lg:gap-8 font-bold text-sm text-gray-700 whitespace-nowrap">
              <Link href="/" className="transition hover:text-[#123B5D]">
                الرئيسية
              </Link>
              <Link href="/#categories" className="transition hover:text-[#123B5D] text-[#123B5D]">
                الأقسام
              </Link>
              <Link href="/#location" className="transition hover:text-[#123B5D]">
                موقعنا
              </Link>
              <Link href="/#products" className="transition hover:text-[#123B5D]">
                المنتجات
              </Link>
              <Link href="/#about" className="transition hover:text-[#123B5D]">
                من نحن
              </Link>
              <Link href="/#contact" className="transition hover:text-[#123B5D]">
                اتصل بنا
              </Link>
            </nav>

            {/* Direct Contact Actions (No cart) */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition hover:bg-[#1ebe5b] whitespace-nowrap"
              >
                <span>💬</span>
                <span className="hidden sm:inline">واتساب المعرض</span>
              </a>

              <a
                href={phoneLink}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#123B5D] px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition hover:bg-[#0B2942] whitespace-nowrap"
              >
                <span>📞</span>
                <span className="hidden sm:inline">اتصل بنا</span>
              </a>
            </div>
          </div>
        </header>

        {/* Breadcrumb Bar */}
        <div className="w-full bg-white border-b border-gray-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 text-xs sm:text-sm text-gray-500 flex items-center gap-2">
            <Link href="/" className="hover:text-[#123B5D] transition">
              الرئيسية
            </Link>
            <span>/</span>
            <Link href="/#categories" className="hover:text-[#123B5D] transition">
              أقسام المتجر
            </Link>
            <span>/</span>
            <span className="font-bold text-gray-900">{category.name}</span>
          </div>
        </div>

        {/* Category Hero Banner */}
        <section className="relative overflow-hidden bg-[#0e1e2d] text-white py-10 sm:py-16 px-4 sm:px-6 lg:px-8 w-full">
          <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-10">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3.5 py-1 text-xs sm:text-sm font-bold text-blue-300 backdrop-blur-md mb-3">
                <span>{category.icon}</span>
                <span>كتالوج المعرض — للعرض والطلب المباشر</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight">
                {category.name}
              </h1>

              <p className="mt-3 text-xs sm:text-base leading-relaxed text-gray-300">
                {category.description}
              </p>

              {/* Badges */}
              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs sm:text-sm">
                <span className="rounded-lg bg-white/10 px-3 py-1.5 border border-white/10 text-gray-200">
                  📸 {category.images_count} صورة معروضة
                </span>
                <span className="rounded-lg bg-white/10 px-3 py-1.5 border border-white/10 text-gray-200">
                  📍 نجران – أبا السعود (مقابل مستشفى نجران العام)
                </span>
                <span className="rounded-lg bg-emerald-500/20 px-3 py-1.5 border border-emerald-400/30 text-emerald-300 font-bold">
                  ✓ متوفر للمعانية والتوريد الفوري
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 w-full md:w-auto shrink-0">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-[#25D366] px-6 py-3.5 text-center text-xs sm:text-sm font-bold text-white shadow-md transition hover:bg-[#1ebe5b] whitespace-nowrap"
              >
                💬 استفسار عن هذا القسم عبر الواتساب
              </a>
              <Link
                href="/#categories"
                className="rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 px-6 py-3.5 text-center text-xs sm:text-sm font-bold text-white transition whitespace-nowrap"
              >
                ← العودة لجميع الأقسام
              </Link>
            </div>
          </div>
        </section>

        {/* Gallery Section */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
          <CategoryGallery
            categoryName={category.name}
            items={category.images}
            whatsappNumber={whatsappNumber}
          />
        </section>

        {/* Other Categories Quick Navigation */}
        <section className="bg-white border-t border-gray-200 px-4 sm:px-6 lg:px-8 py-10 sm:py-14 w-full">
          <div className="mx-auto max-w-7xl">
            <h3 className="text-lg sm:text-xl font-black text-gray-900 mb-6 text-center sm:text-right">
              تصفح أقسام أخرى من المعرض
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
              {otherCategories.map((other) => (
                <Link
                  key={other.id}
                  href={`/category/${other.slug}`}
                  className="group rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white p-3 sm:p-4 text-center transition-all hover:shadow-md hover:border-[#123B5D]"
                >
                  <div className="text-2xl sm:text-3xl mb-1.5 transition-transform group-hover:scale-110">
                    {other.icon}
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-gray-900 group-hover:text-[#123B5D] transition line-clamp-1">
                    {other.name}
                  </p>
                  <span className="text-[10px] sm:text-xs text-gray-500 mt-0.5 block">
                    {other.images_count} صورة
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Full-width Black Footer */}
      <footer id="contact" className="w-full bg-[#0a0f14] text-white border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="relative h-14 sm:h-18 md:h-20 w-52 sm:w-64 md:w-72">
              <NextImage
                src="/logo-white.png"
                alt="مؤسسة محل البناء الحديث للتجارة"
                fill
                className="object-contain"
              />
            </div>
            <p className="mx-auto mt-3 max-w-2xl text-xs sm:text-sm leading-relaxed text-gray-400">
              تواصل معنا مباشرة لمعرفة تفاصيل المنتجات والأسعار وطلبات التوريد
            </p>
          </div>

          <div className="mt-8 grid gap-4 text-xs sm:text-sm grid-cols-1 md:grid-cols-2 text-right">
            <div className="rounded-2xl bg-white/[0.04] p-5 sm:p-6 border border-white/10">
              <p className="text-sm sm:text-base font-bold text-white border-b border-white/10 pb-2">
                📞 المبيعات والإدارة
              </p>
              <div className="mt-3 space-y-2 text-gray-300">
                <p>مبيعات ومشتريات: إبراهيم (0558689100) | بندر (0501960009)</p>
                <p>المدير العام: علي يحيى (0555794204)</p>
                <p>الهاتف الثابت: 0175420300 | الواتساب: 0554304322</p>
              </div>
            </div>

            <div className="rounded-2xl bg-white/[0.04] p-5 sm:p-6 border border-white/10">
              <p className="text-sm sm:text-base font-bold text-white border-b border-white/10 pb-2">
                🧾 البيانات القانونية والعنوان
              </p>
              <div className="mt-3 space-y-1.5 text-gray-300">
                <p>الاسم القانوني: مؤسسة محل البناء الحديث للتجارة</p>
                <p>السجل التجاري: 5950008086 | الرقم الضريبي: 300912409900003</p>
                <p>العنوان: نجران – أبا السعود – طريق الملك عبدالعزيز (مقابل مستشفى نجران العام)</p>
                <p>العنوان المختصر: NJSA3888 | الرمز البريدي: 66277</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 bg-black/60 py-5 px-4 sm:px-6 lg:px-8 w-full">
          <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
            <p>© {new Date().getFullYear()} مؤسسة محل البناء الحديث للتجارة. جميع الحقوق محفوظة.</p>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="hover:text-white font-semibold underline underline-offset-4">
                سياسة الخصوصية
              </Link>
              <Link href="/" className="hover:text-white">
                الرئيسية
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
