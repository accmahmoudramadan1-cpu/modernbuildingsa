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
    <main dir="rtl" className="min-h-screen bg-[#f5f5f3] text-[#171717]">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-gray-200/90 bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3.5">
          {/* Brand Logo & Name */}
          <Link href="/" className="flex items-center gap-3 shrink-0 group">
            <div className="relative h-11 w-11 sm:h-12 sm:w-12 shrink-0 overflow-hidden rounded-xl bg-gray-50 border border-black/5 p-1">
              <NextImage
                src="/logo.png"
                alt={settings.company_name || "البناء الحديثة"}
                fill
                className="object-contain p-1 transition group-hover:scale-105"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-black leading-tight text-gray-900">
                مؤسسة محل البناء الحديث
              </span>
              <span className="text-xs font-semibold text-gray-500 tracking-wider">
                Modern Building
              </span>
            </div>
          </Link>

          {/* Navigation links (Centered on medium/large screens) */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8 font-bold text-sm text-gray-700 whitespace-nowrap">
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
          <div className="flex items-center gap-3 shrink-0">
            <CartButton />
            <a
              href="#contact"
              className="whitespace-nowrap rounded-xl bg-[#123B5D] px-5 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#0B2942]"
            >
              تواصل معنا
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        id="home"
        className="relative overflow-hidden bg-[#0e1e2d] text-white"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-12">
            {/* Text column (7 cols) */}
            <div className="lg:col-span-7 flex flex-col items-start">
              <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs sm:text-sm font-bold text-gray-200 backdrop-blur-md">
                🏗️ {settings.description}
              </span>

              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight text-white">
                كل ما تحتاجه <br />
                <span className="text-[#3b82f6]">
                  لبناء أفضل
                </span>
              </h2>

              <p className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-gray-300">
                وجهتك الأولى في نجران والمملكة لمواد البناء والتشطيب، الأدوات الصحية، شبكات السباكة وتمديدات الصرف، والإنارة والكهرباء بأعلى معايير الجودة وبأسعار منافسة للمشاريع والمنازل.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a
                  href="#products"
                  className="rounded-xl bg-[#123B5D] px-8 py-3.5 text-center font-bold text-white shadow-md transition hover:bg-[#0B2942] hover:-translate-y-0.5 whitespace-nowrap"
                >
                  🛍️ تصفح المنتجات
                </a>
                <a
                  href={settings.whatsapp_business || whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-white/25 bg-white/5 px-8 py-3.5 text-center font-bold text-white backdrop-blur transition hover:bg-white/10 hover:-translate-y-0.5 whitespace-nowrap"
                >
                  💬 واتساب فوري
                </a>
                <a
                  href="#contact"
                  className="rounded-xl border border-white/20 px-6 py-3.5 text-center font-bold text-gray-200 transition hover:bg-white/10 whitespace-nowrap"
                >
                  📞 اتصل بنا
                </a>
              </div>

              {/* Key Trust Highlights */}
              <div className="mt-12 grid grid-cols-3 gap-6 border-t border-white/10 pt-6 w-full max-w-xl">
                <div>
                  <div className="text-2xl font-black text-white">100%</div>
                  <div className="text-xs text-gray-400 mt-1">جودة وضمان معتمد</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-white">فوري</div>
                  <div className="text-xs text-gray-400 mt-1">توريد مباشر وسريع</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-white">شامل</div>
                  <div className="text-xs text-gray-400 mt-1">جملة وتجزئة</div>
                </div>
              </div>
            </div>

            {/* Visual Feature Cards (5 cols) */}
            <div className="lg:col-span-5">
              <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-8 backdrop-blur-md">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-[#123B5D]/80 p-5 border border-white/10 transition hover:-translate-y-1">
                    <div className="text-3xl">🏗️</div>
                    <h3 className="mt-3 text-lg font-black text-white">مواد بناء</h3>
                    <p className="mt-1 text-xs text-white/80">منتجات متنوعة للمشروعات</p>
                  </div>

                  <div className="rounded-2xl bg-white/10 p-5 border border-white/10 transition hover:-translate-y-1">
                    <div className="text-3xl">🧱</div>
                    <h3 className="mt-3 text-lg font-black text-white">أدوات صحية</h3>
                    <p className="mt-1 text-xs text-gray-300">أطقم وخلاطات ومستلزمات</p>
                  </div>

                  <div className="rounded-2xl bg-white/10 p-5 border border-white/10 transition hover:-translate-y-1">
                    <div className="text-3xl">🔧</div>
                    <h3 className="mt-3 text-lg font-black text-white">سباكة وشبكات</h3>
                    <p className="mt-1 text-xs text-gray-300">مواسير ومحابس وتمديدات</p>
                  </div>

                  <div className="rounded-2xl bg-white/10 p-5 border border-white/10 transition hover:-translate-y-1">
                    <div className="text-3xl">💡</div>
                    <h3 className="mt-3 text-lg font-black text-white">كهرباء وإنارة</h3>
                    <p className="mt-1 text-xs text-gray-300">إضاءة داخلية وخارجية</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section id="categories" className="px-4 sm:px-6 lg:px-8 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <span className="text-sm font-bold text-[#123B5D]">
              أقسام المتجر
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black">
              تصفح حسب القسم
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-500">
              اختر القسم الذي تبحث عنه للوصول إلى المنتجات المتاحة وتفاصيلها.
            </p>
          </div>

          {safeCategories.length > 0 ? (
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {safeCategories.map((category) => (
                <div
                  key={category.id}
                  className="group overflow-hidden rounded-3xl border border-black/5 bg-white shadow-xs transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="relative h-56 overflow-hidden bg-gray-200">
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
                  <div className="p-6">
                    <h3 className="text-xl font-black">
                      {category.name}
                    </h3>
                    {category.description && (
                      <p className="mt-3 text-sm leading-6 text-gray-500 line-clamp-3">
                        {category.description}
                      </p>
                    )}
                    <a
                      href="#products"
                      className="mt-5 inline-flex font-bold text-[#123B5D] transition hover:text-[#0B2942]"
                    >
                      مشاهدة المنتجات ←
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-12 rounded-3xl bg-white p-10 text-center text-gray-500">
              لا توجد أقسام مضافة حاليًا.
            </div>
          )}
        </div>
      </section>

      {/* Products Section */}
      <section
        id="products"
        className="bg-white px-4 sm:px-6 lg:px-8 py-20 border-y border-gray-200/80"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <span className="text-sm font-bold text-[#123B5D]">
                منتجاتنا
              </span>
              <h2 className="mt-3 text-3xl sm:text-4xl font-black">
                منتجات مميزة
              </h2>
              <p className="mt-4 max-w-2xl text-gray-500">
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
      <section id="about" className="px-4 sm:px-6 lg:px-8 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[36px] bg-[#0e1e2d] p-8 text-white sm:p-12 md:p-14">
            <span className="text-sm font-bold text-[#3b82f6]">
              لماذا {settings.company_name}؟
            </span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-black md:text-5xl">
              شريكك الموثوق في كل خطوة بناء
            </h2>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              <div className="rounded-2xl bg-white/5 p-6 border border-white/10">
                <div className="text-4xl">🏗️</div>
                <h3 className="mt-4 text-xl font-black">
                  منتجات متنوعة ومتكاملة
                </h3>
                <p className="mt-3 leading-7 text-gray-400">
                  مجموعة كبيرة ومتجددة من مواد البناء والتشطيب لمختلف المشروعات.
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 p-6 border border-white/10">
                <div className="text-4xl">⭐</div>
                <h3 className="mt-4 text-xl font-black">
                  جودة أصلية وموثوقة
                </h3>
                <p className="mt-3 leading-7 text-gray-400">
                  نهتم بتوفير منتجات أصلية ذات كفاءة عالية مطابقة لأعلى المواصفات.
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 p-6 border border-white/10">
                <div className="text-4xl">📞</div>
                <h3 className="mt-4 text-xl font-black">
                  خدمة مباشرة وتوريد سريع
                </h3>
                <p className="mt-3 leading-7 text-gray-400">
                  فريق مبيعات متخصص للتواصل الفوري وتقديم عروض الأسعار والمشورة.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="px-4 sm:px-6 lg:px-8 pb-20">
        <div className="mx-auto max-w-5xl rounded-[36px] bg-[#123B5D] p-8 text-center text-white sm:p-12 md:p-14 shadow-xl">
          <h2 className="text-3xl sm:text-4xl font-black leading-tight">
            مؤسسة محل البناء الحديث للتجارة
            <span className="mt-2 block text-lg sm:text-xl font-bold text-white/90">
              Modern Building
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base sm:text-lg leading-8 text-white/90">
            تواصل معنا مباشرة لمعرفة تفاصيل المنتجات والأسعار وطلبات التوريد
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href={phoneLink}
              className="rounded-full bg-black px-8 py-3.5 font-bold transition hover:bg-white hover:text-black whitespace-nowrap shadow-md"
            >
              📞 اتصل بنا
            </a>
            <a
              href={settings.whatsapp_business || whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/30 px-8 py-3.5 font-bold transition hover:bg-white/10 whitespace-nowrap"
            >
              💬 WhatsApp
            </a>
            <a
              href={emailLink}
              className="rounded-full border border-white/30 px-8 py-3.5 font-bold transition hover:bg-white/10 whitespace-nowrap"
            >
              ✉️ البريد الإلكتروني
            </a>
            <a
              href={settings.instagram_url || "https://www.instagram.com/modern_building_1"}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/30 px-8 py-3.5 font-bold transition hover:bg-white/10 whitespace-nowrap"
            >
              📸 Instagram
            </a>
            {settings.maps_url && (
              <a
                href={settings.maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/30 px-8 py-3.5 font-bold transition hover:bg-white/10 whitespace-nowrap"
              >
                📍 موقعنا على الخريطة
              </a>
            )}
          </div>

          <div className="mt-10 grid gap-4 text-sm sm:grid-cols-2 text-right">
            <div className="rounded-2xl bg-black/20 p-5 border border-white/10">
              <p className="text-base font-bold text-white">📞 هواتف المبيعات والإدارة</p>
              <div className="mt-3 space-y-1 text-white/90">
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
                <p className="font-semibold text-gray-200 pt-2">المدير العام — علي يحيى</p>
                <a
                  href="tel:+966555794204"
                  className="block transition hover:text-white hover:underline"
                >
                  0555794204
                </a>
              </div>
            </div>

            <div className="rounded-2xl bg-black/20 p-5 border border-white/10">
              <p className="text-base font-bold text-white">🧾 البيانات القانونية والرسمية</p>
              <p className="mt-3 font-semibold">مؤسسة محل البناء الحديث للتجارة</p>
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
