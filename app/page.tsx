import NextImage from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import CartButton from "@/components/CartButton";
import ProductSearch from "@/components/ProductSearch";

type Category = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
};

type Product = {
  id: string;
  category_id: string | null;
  name: string;
  image_url: string | null;
  description: string | null;
  price: number | null;
  currency: string | null;
  show_price: boolean;
  available: boolean;
};

type SiteSettings = {
  company_name: string | null;
  phone_1: string | null;
  phone_2: string | null;
  landline: string | null;
  whatsapp: string | null;
  address: string | null;
  description: string | null;
  maps_url: string | null;
  whatsapp_business: string | null;
  instagram_url: string | null;
  email: string | null;
};

export default async function Home() {
  const supabase = await createClient();

  const [{ data: categories }, { data: products }, { data: siteSettings }] =
    await Promise.all([
      supabase
        .from("categories")
        .select("id, name, description, image_url")
        .order("created_at", { ascending: false }),
      supabase
        .from("products")
        .select(
          "id, category_id, name, image_url, description, price, currency, show_price, available"
        )
        .eq("available", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("site_settings")
        .select(
          "company_name, phone_1, phone_2, landline, whatsapp, address, description, maps_url, whatsapp_business, instagram_url, email"
        )
        .eq("id", 1)
        .maybeSingle(),
    ]);

  const safeCategories: Category[] = categories || [];
  const safeProducts: Product[] = products || [];

  const settings: SiteSettings = {
    company_name: siteSettings?.company_name || "مؤسسة محل البناء الحديث للتجارة",
    phone_1: siteSettings?.phone_1 || "0558689100",
    phone_2: siteSettings?.phone_2 || "0501960009",
    landline: siteSettings?.landline || "0175423431",
    whatsapp: siteSettings?.whatsapp || "0554303422",
    address:
      siteSettings?.address ||
      "نجران – أبا السعود – البلد، مقابل مستشفى نجران العام القديم",
    description: siteSettings?.description || "لمواد البناء والتشطيب",
    maps_url: siteSettings?.maps_url || null,
    whatsapp_business: siteSettings?.whatsapp_business || null,
    instagram_url: siteSettings?.instagram_url || null,
    email: siteSettings?.email || "info@modernbuildingsa.com",
  };

  const whatsappNumber = (settings.whatsapp || "").replace(/\D/g, "");
  const whatsappLink = whatsappNumber
    ? whatsappNumber.startsWith("966")
      ? `https://wa.me/${whatsappNumber}`
      : whatsappNumber.startsWith("0")
        ? `https://wa.me/966${whatsappNumber.slice(1)}`
        : `https://wa.me/966${whatsappNumber}`
    : "#";

  const primaryPhone = "0558689100";
  const phoneLink = primaryPhone
    ? `tel:${primaryPhone.replace(/\D/g, "")}`
    : "#";
  const emailLink = settings.email ? `mailto:${settings.email}` : "#";

  return (
    <main dir="rtl" className="min-h-screen bg-[#f5f5f3] text-[#171717] w-full max-w-full overflow-x-hidden">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-gray-200/90 bg-white/95 backdrop-blur-md shadow-xs w-full">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5">
          {/* Brand Logo */}
          <Link
            href="/"
            className="flex items-center shrink-0 group py-0.5"
            title={settings.company_name || "مؤسسة البناء الحديث"}
          >
            <div className="relative h-10 sm:h-12 md:h-14 w-36 sm:w-44 md:w-52 transition group-hover:opacity-90">
              <NextImage
                src="/logo.png"
                alt={settings.company_name || "مؤسسة البناء الحديث"}
                fill
                className="object-contain object-right"
                priority
              />
            </div>
          </Link>

          {/* Navigation links (Desktop only) */}
          <nav className="hidden md:flex items-center gap-5 lg:gap-8 font-bold text-sm text-gray-700 whitespace-nowrap">
            <a
              href="#home"
              className="transition hover:text-[#123B5D]"
            >
              الرئيسية
            </a>
            <a
              href="#categories"
              className="transition hover:text-[#123B5D]"
            >
              الأقسام
            </a>
            <a
              href="#products"
              className="transition hover:text-[#123B5D]"
            >
              المنتجات
            </a>
            <a
              href="#about"
              className="transition hover:text-[#123B5D]"
            >
              من نحن
            </a>
            <a
              href="#contact"
              className="transition hover:text-[#123B5D]"
            >
              اتصل بنا
            </a>
          </nav>

          {/* Action buttons (Left side in RTL) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <CartButton />

            {/* Quick Call icon on small mobile */}
            <a
              href={phoneLink}
              className="sm:hidden flex h-9 w-9 items-center justify-center rounded-xl bg-[#123B5D] text-white shadow-xs"
              title="اتصل بنا"
            >
              📞
            </a>

            {/* Full button on sm and up */}
            <a
              href="#contact"
              className="hidden sm:inline-flex whitespace-nowrap rounded-xl bg-[#123B5D] px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition hover:bg-[#0B2942]"
            >
              تواصل معنا
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        id="home"
        className="relative overflow-hidden bg-[#0e1e2d] text-white w-full"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16 lg:py-20">
          <div className="grid items-center gap-8 lg:gap-12 lg:grid-cols-12">
            {/* Text column (7 cols) */}
            <div className="lg:col-span-7 flex flex-col items-start w-full">
              <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3.5 py-1 text-xs sm:text-sm font-bold text-gray-200 backdrop-blur-md max-w-full">
                🏗️ {settings.description}
              </span>

              <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black leading-tight text-white break-words w-full">
                كل ما تحتاجه <br />
                <span className="text-[#3b82f6]">
                  لبناء أفضل
                </span>
              </h2>

              <p className="mt-4 sm:mt-6 max-w-2xl text-sm sm:text-base lg:text-lg leading-relaxed text-gray-300">
                وجهتك الأولى في نجران والمملكة لمواد البناء والتشطيب، الأدوات الصحية، شبكات السباكة وتمديدات الصرف، والإنارة والكهرباء بأعلى معايير الجودة وبأسعار منافسة للمشاريع والمنازل.
              </p>

              <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <a
                  href="#products"
                  className="rounded-xl bg-[#123B5D] px-6 sm:px-8 py-3.5 text-center font-bold text-white shadow-md transition hover:bg-[#0B2942] whitespace-nowrap"
                >
                  🛍️ تصفح المنتجات
                </a>
                <a
                  href={settings.whatsapp_business || whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-white/25 bg-white/5 px-6 sm:px-8 py-3.5 text-center font-bold text-white backdrop-blur transition hover:bg-white/10 whitespace-nowrap"
                >
                  💬 واتساب فوري
                </a>
                <a
                  href="#contact"
                  className="rounded-xl border border-white/20 px-5 sm:px-6 py-3.5 text-center font-bold text-gray-200 transition hover:bg-white/10 whitespace-nowrap"
                >
                  📞 اتصل بنا
                </a>
              </div>

              {/* Key Trust Highlights */}
              <div className="mt-8 sm:mt-12 grid grid-cols-3 gap-2 sm:gap-6 border-t border-white/10 pt-6 w-full max-w-xl text-center">
                <div>
                  <div className="text-xl sm:text-2xl font-black text-white">100%</div>
                  <div className="text-[11px] sm:text-xs text-gray-400 mt-1">ضمان معتمد</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-black text-white">فوري</div>
                  <div className="text-[11px] sm:text-xs text-gray-400 mt-1">توريد سريع</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-black text-white">شامل</div>
                  <div className="text-[11px] sm:text-xs text-gray-400 mt-1">جملة وتجزئة</div>
                </div>
              </div>
            </div>

            {/* Visual Feature Cards (5 cols) */}
            <div className="lg:col-span-5 w-full">
              <div className="rounded-2xl sm:rounded-[32px] border border-white/10 bg-white/5 p-4 sm:p-7 backdrop-blur-md">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="rounded-xl sm:rounded-2xl bg-[#123B5D]/80 p-3.5 sm:p-5 border border-white/10 transition hover:-translate-y-1">
                    <div className="text-2xl sm:text-3xl">🏗️</div>
                    <h3 className="mt-2 text-sm sm:text-lg font-black text-white">مواد بناء</h3>
                    <p className="mt-0.5 text-[11px] sm:text-xs text-white/80">منتجات للمشروعات</p>
                  </div>

                  <div className="rounded-xl sm:rounded-2xl bg-white/10 p-3.5 sm:p-5 border border-white/10 transition hover:-translate-y-1">
                    <div className="text-2xl sm:text-3xl">🧱</div>
                    <h3 className="mt-2 text-sm sm:text-lg font-black text-white">أدوات صحية</h3>
                    <p className="mt-0.5 text-[11px] sm:text-xs text-gray-300">أطقم وخلاطات</p>
                  </div>

                  <div className="rounded-xl sm:rounded-2xl bg-white/10 p-3.5 sm:p-5 border border-white/10 transition hover:-translate-y-1">
                    <div className="text-2xl sm:text-3xl">🔧</div>
                    <h3 className="mt-2 text-sm sm:text-lg font-black text-white">سباكة وشبكات</h3>
                    <p className="mt-0.5 text-[11px] sm:text-xs text-gray-300">مواسير وتمديدات</p>
                  </div>

                  <div className="rounded-xl sm:rounded-2xl bg-white/10 p-3.5 sm:p-5 border border-white/10 transition hover:-translate-y-1">
                    <div className="text-2xl sm:text-3xl">💡</div>
                    <h3 className="mt-2 text-sm sm:text-lg font-black text-white">كهرباء وإنارة</h3>
                    <p className="mt-0.5 text-[11px] sm:text-xs text-gray-300">إضاءة داخلية وخارجية</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section id="categories" className="px-4 sm:px-6 lg:px-8 py-12 sm:py-20 w-full">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <span className="text-xs sm:text-sm font-bold text-[#123B5D]">
              أقسام المتجر
            </span>
            <h2 className="mt-2 sm:mt-3 text-2xl sm:text-4xl font-black">
              تصفح حسب القسم
            </h2>
            <p className="mx-auto mt-2 sm:mt-4 max-w-2xl text-xs sm:text-base text-gray-500">
              اختر القسم الذي تبحث عنه للوصول إلى المنتجات المتاحة وتفاصيلها.
            </p>
          </div>

          {safeCategories.length > 0 ? (
            <div className="mt-8 sm:mt-12 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {safeCategories.map((category) => (
                <div
                  key={category.id}
                  className="group overflow-hidden rounded-2xl sm:rounded-3xl border border-black/5 bg-white shadow-xs transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="relative h-48 sm:h-56 overflow-hidden bg-gray-200">
                    {category.image_url ? (
                      <img
                        src={category.image_url}
                        alt={category.name}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-5xl">
                        🧱
                      </div>
                    )}
                  </div>
                  <div className="p-4 sm:p-6">
                    <h3 className="text-lg sm:text-xl font-black">
                      {category.name}
                    </h3>
                    {category.description && (
                      <p className="mt-2 sm:mt-3 text-xs sm:text-sm leading-relaxed text-gray-500 line-clamp-3">
                        {category.description}
                      </p>
                    )}
                    <a
                      href="#products"
                      className="mt-4 sm:mt-5 inline-flex font-bold text-sm text-[#123B5D] transition hover:text-[#0B2942]"
                    >
                      مشاهدة المنتجات ←
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8 sm:mt-12 rounded-2xl sm:rounded-3xl bg-white p-8 sm:p-10 text-center text-gray-500 text-sm">
              لا توجد أقسام مضافة حاليًا.
            </div>
          )}
        </div>
      </section>

      {/* Products Section */}
      <section
        id="products"
        className="bg-white px-4 sm:px-6 lg:px-8 py-12 sm:py-20 border-y border-gray-200/80 w-full"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-3 sm:gap-4 md:flex-row md:items-end">
            <div>
              <span className="text-xs sm:text-sm font-bold text-[#123B5D]">
                منتجاتنا
              </span>
              <h2 className="mt-1 sm:mt-3 text-2xl sm:text-4xl font-black">
                منتجات مميزة
              </h2>
              <p className="mt-2 sm:mt-4 max-w-2xl text-xs sm:text-base text-gray-500">
                اكتشف المنتجات المتاحة حاليًا وتواصل معنا لمعرفة الأسعار والكميات.
              </p>
            </div>
          </div>

          <ProductSearch
            products={safeProducts}
            categories={safeCategories}
          />
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="px-4 sm:px-6 lg:px-8 py-12 sm:py-20 w-full">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl sm:rounded-[36px] bg-[#0e1e2d] p-6 sm:p-12 md:p-14 text-white">
            <span className="text-xs sm:text-sm font-bold text-[#3b82f6]">
              لماذا {settings.company_name}؟
            </span>
            <h2 className="mt-2 sm:mt-4 text-2xl sm:text-4xl font-black md:text-5xl">
              شريكك الموثوق في كل خطوة بناء
            </h2>
            <div className="mt-8 sm:mt-12 grid gap-4 sm:gap-8 grid-cols-1 md:grid-cols-3">
              <div className="rounded-xl sm:rounded-2xl bg-white/5 p-5 sm:p-6 border border-white/10">
                <div className="text-3xl sm:text-4xl">🏗️</div>
                <h3 className="mt-3 text-base sm:text-xl font-black">
                  منتجات متنوعة ومتكاملة
                </h3>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-gray-400">
                  مجموعة كبيرة ومتجددة من مواد البناء والتشطيب لمختلف المشروعات.
                </p>
              </div>
              <div className="rounded-xl sm:rounded-2xl bg-white/5 p-5 sm:p-6 border border-white/10">
                <div className="text-3xl sm:text-4xl">⭐</div>
                <h3 className="mt-3 text-base sm:text-xl font-black">
                  جودة أصلية وموثوقة
                </h3>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-gray-400">
                  نهتم بتوفير منتجات أصلية ذات كفاءة عالية مطابقة لأعلى المواصفات.
                </p>
              </div>
              <div className="rounded-xl sm:rounded-2xl bg-white/5 p-5 sm:p-6 border border-white/10">
                <div className="text-3xl sm:text-4xl">📞</div>
                <h3 className="mt-3 text-base sm:text-xl font-black">
                  خدمة مباشرة وتوريد سريع
                </h3>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-gray-400">
                  فريق مبيعات متخصص للتواصل الفوري وتقديم عروض الأسعار والمشورة.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="px-4 sm:px-6 lg:px-8 pb-12 sm:pb-20 w-full">
        <div className="mx-auto max-w-5xl rounded-2xl sm:rounded-[36px] bg-[#123B5D] p-6 sm:p-12 md:p-14 text-center text-white shadow-xl">
          <h2 className="text-2xl sm:text-4xl font-black leading-tight">
            مؤسسة محل البناء الحديث للتجارة
            <span className="mt-1 sm:mt-2 block text-base sm:text-xl font-bold text-white/90">
              Modern Building
            </span>
          </h2>
          <p className="mx-auto mt-3 sm:mt-5 max-w-2xl text-xs sm:text-lg leading-relaxed text-white/90">
            تواصل معنا مباشرة لمعرفة تفاصيل المنتجات والأسعار وطلبات التوريد
          </p>

          <div className="mt-6 sm:mt-8 flex flex-wrap justify-center gap-2 sm:gap-3">
            <a
              href={phoneLink}
              className="rounded-full bg-black px-6 sm:px-8 py-3 text-xs sm:text-sm font-bold transition hover:bg-white hover:text-black whitespace-nowrap shadow-md"
            >
              📞 اتصل بنا
            </a>
            <a
              href={settings.whatsapp_business || whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/30 px-6 sm:px-8 py-3 text-xs sm:text-sm font-bold transition hover:bg-white/10 whitespace-nowrap"
            >
              💬 WhatsApp
            </a>
            <a
              href={emailLink}
              className="rounded-full border border-white/30 px-6 sm:px-8 py-3 text-xs sm:text-sm font-bold transition hover:bg-white/10 whitespace-nowrap"
            >
              ✉️ البريد الإلكتروني
            </a>
            <a
              href={settings.instagram_url || "https://www.instagram.com/modern_building_1"}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/30 px-6 sm:px-8 py-3 text-xs sm:text-sm font-bold transition hover:bg-white/10 whitespace-nowrap"
            >
              📸 Instagram
            </a>
            {settings.maps_url && (
              <a
                href={settings.maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/30 px-6 sm:px-8 py-3 text-xs sm:text-sm font-bold transition hover:bg-white/10 whitespace-nowrap"
              >
                📍 موقعنا على الخريطة
              </a>
            )}
          </div>

          <div className="mt-8 sm:mt-10 grid gap-3 sm:gap-4 text-xs sm:text-sm grid-cols-1 sm:grid-cols-2 text-right">
            <div className="rounded-xl sm:rounded-2xl bg-black/20 p-4 sm:p-5 border border-white/10">
              <p className="text-sm sm:text-base font-bold text-white">📞 هواتف المبيعات والإدارة</p>
              <div className="mt-2.5 space-y-1 text-white/90">
                <p className="font-semibold text-gray-200">مدير مبيعات ومشتريات</p>
                <a
                  href="tel:+966558689100"
                  className="block transition hover:text-white hover:underline"
                >
                  إبراهيم: 0558689100
                </a>
                <a
                  href="tel:+966501960009"
                  className="block transition hover:text-white hover:underline"
                >
                  بندر: 0501960009
                </a>
                <p className="font-semibold text-gray-200 pt-1.5">المدير العام — علي يحيى</p>
                <a
                  href="tel:+966555794204"
                  className="block transition hover:text-white hover:underline"
                >
                  0555794204
                </a>
              </div>
            </div>

            <div className="rounded-xl sm:rounded-2xl bg-black/20 p-4 sm:p-5 border border-white/10">
              <p className="text-sm sm:text-base font-bold text-white">🧾 البيانات القانونية والرسمية</p>
              <p className="mt-2.5 font-semibold">مؤسسة محل البناء الحديث للتجارة</p>
              <div className="mt-2 space-y-1 text-white/90">
                <p>الرقم الضريبي: 5950008086</p>
                <p>السجل التجاري: 300912409900003</p>
                <p>الموقع: {settings.address}</p>
                <p>الهاتف الثابت: 00966175423431</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
