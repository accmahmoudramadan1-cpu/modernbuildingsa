import NextImage from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { STORE_CATEGORIES } from "@/lib/categories-data";
import ProductSearch from "@/components/ProductSearch";

type Category = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  icon?: string;
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

  // Display Categories using curated categories catalog (Excluded: عدد وآلات)
  const displayCategories = STORE_CATEGORIES.map((storeCat) => {
    const matchedDb = (categories || []).find((c) => {
      const n1 = c.name.trim().toLowerCase();
      const n2 = storeCat.name.trim().toLowerCase();
      return n1 === n2 || n1.includes(n2) || n2.includes(n1);
    });

    return {
      id: matchedDb ? matchedDb.id : storeCat.id,
      slug: storeCat.slug,
      name: storeCat.name,
      description: storeCat.description,
      image_url: matchedDb?.image_url || storeCat.thumbnail,
      thumbnail: storeCat.thumbnail,
      icon: storeCat.icon,
      images_count: storeCat.images_count,
    };
  });

  const safeProducts: Product[] = products || [];

  const settings: SiteSettings = {
    company_name: siteSettings?.company_name || "مؤسسة محل البناء الحديث للتجارة",
    phone_1: siteSettings?.phone_1 || "0558689100",
    phone_2: siteSettings?.phone_2 || "0501960009",
    landline: siteSettings?.landline || "0175420300",
    whatsapp: siteSettings?.whatsapp || "0554304322",
    address:
      siteSettings?.address ||
      "نجران – أبا السعود – البلد (مقابل مستشفى نجران العام)",
    description: siteSettings?.description || "لمواد البناء والتشطيب",
    maps_url: siteSettings?.maps_url || "https://maps.app.goo.gl/VqfvbzxYBCMhGbpG8?g_st=aw",
    whatsapp_business: siteSettings?.whatsapp_business || "https://wa.me/966554304322",
    instagram_url: siteSettings?.instagram_url || "https://www.instagram.com/modern_building_1",
    email: siteSettings?.email || "Info@modernbuildingsa.com",
  };

  const whatsappNumber = (settings.whatsapp || "0554304322").replace(/\D/g, "");
  const whatsappLink = whatsappNumber
    ? whatsappNumber.startsWith("966")
      ? `https://wa.me/${whatsappNumber}`
      : whatsappNumber.startsWith("0")
        ? `https://wa.me/966${whatsappNumber.slice(1)}`
        : `https://wa.me/966${whatsappNumber}`
    : "https://wa.me/966554304322";

  const primaryPhone = "0558689100";
  const phoneLink = `tel:${primaryPhone.replace(/\D/g, "")}`;
  const emailLink = `mailto:${settings.email || "Info@modernbuildingsa.com"}`;

  return (
    <main dir="rtl" className="min-h-screen bg-[#f5f5f3] text-[#171717] w-full max-w-full overflow-x-hidden">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-gray-200/90 bg-white/95 backdrop-blur-md shadow-xs w-full">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5">
          {/* Brand Logo - Enlarged as requested */}
          <Link
            href="/"
            className="flex items-center shrink-0 group py-1"
            title={settings.company_name || "مؤسسة محل البناء الحديث"}
          >
            <div className="relative h-12 sm:h-14 md:h-16 lg:h-20 w-44 sm:w-56 md:w-64 lg:w-72 transition group-hover:opacity-90">
              <NextImage
                src="/logo.png"
                alt={settings.company_name || "مؤسسة محل البناء الحديث"}
                fill
                className="object-contain object-right"
                priority
              />
            </div>
          </Link>

          {/* Navigation links (Desktop only) */}
          <nav className="hidden md:flex items-center gap-5 lg:gap-8 font-bold text-sm text-gray-700 whitespace-nowrap">
            <a href="#home" className="transition hover:text-[#123B5D]">
              الرئيسية
            </a>
            <a href="#categories" className="transition hover:text-[#123B5D]">
              الأقسام
            </a>
            <a href="#location" className="transition hover:text-[#123B5D]">
              موقعنا
            </a>
            <a href="#products" className="transition hover:text-[#123B5D]">
              المنتجات
            </a>
            <a href="#about" className="transition hover:text-[#123B5D]">
              من نحن
            </a>
            <a href="#contact" className="transition hover:text-[#123B5D]">
              اتصل بنا
            </a>
          </nav>

          {/* Action buttons (Left side in RTL) - Display/Contact only (No Cart) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Quick WhatsApp on mobile */}
            <a
              href={settings.whatsapp_business || whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="sm:hidden flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-xs"
              title="واتساب"
            >
              💬
            </a>

            {/* Quick Call icon on small mobile */}
            <a
              href={phoneLink}
              className="sm:hidden flex h-10 w-10 items-center justify-center rounded-xl bg-[#123B5D] text-white shadow-xs"
              title="اتصل بنا"
            >
              📞
            </a>

            {/* Full WhatsApp on sm and up */}
            <a
              href={settings.whatsapp_business || whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#25D366] px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition hover:bg-[#1ebe5b]"
            >
              <span>💬</span>
              <span>واتساب المعرض</span>
            </a>

            {/* Full Contact button on sm and up */}
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
              {/* Interactive badge linked to products */}
              <a
                href="#products"
                className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 hover:bg-blue-500/20 px-4 py-1.5 text-xs sm:text-sm font-bold text-blue-300 backdrop-blur-md transition group"
              >
                <span>🏗️ لمواد البناء والتشطيب</span>
                <span className="text-white/80 group-hover:translate-x-[-3px] transition-transform">← اضغط هنا</span>
              </a>

              <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black leading-tight text-white break-words w-full">
                كل ما تحتاجه <br />
                <span className="text-[#3b82f6]">
                  لبناء أفضل في مكان واحد
                </span>
              </h2>

              {/* Tagline / Subtitle with reduced font size as requested */}
              <p className="mt-3 sm:mt-4 max-w-2xl text-xs sm:text-sm md:text-base leading-relaxed text-gray-300">
                وجهتك الأولى في نجران والمملكة لمواد البناء والتشطيب، الأدوات الصحية، شبكات السباكة وتمديدات الصرف، والإنارة والكهرباء بأعلى معايير الجودة وبأسعار منافسة للمشاريع والمنازل.
              </p>

              {/* 4 Hero Action Buttons */}
              <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-2.5 sm:gap-3 w-full">
                <a
                  href="#products"
                  className="rounded-xl bg-[#123B5D] px-5 sm:px-7 py-3 text-center text-xs sm:text-sm font-bold text-white shadow-md transition hover:bg-[#0B2942] whitespace-nowrap"
                >
                  🛍️ تصفح المنتجات
                </a>
                <a
                  href={settings.whatsapp_business || whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-[#25D366] px-5 sm:px-7 py-3 text-center text-xs sm:text-sm font-bold text-white shadow-md transition hover:bg-[#1ebe5b] whitespace-nowrap"
                >
                  💬 للتواصل عبر الواتساب
                </a>
                <a
                  href="#about"
                  className="rounded-xl border border-white/25 bg-white/5 px-4 sm:px-6 py-3 text-center text-xs sm:text-sm font-bold text-white backdrop-blur transition hover:bg-white/10 whitespace-nowrap"
                >
                  ℹ️ من نحن
                </a>
                <a
                  href="#contact"
                  className="rounded-xl border border-white/25 bg-white/5 px-4 sm:px-6 py-3 text-center text-xs sm:text-sm font-bold text-white backdrop-blur transition hover:bg-white/10 whitespace-nowrap"
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

            {/* Visual Feature Cards (5 cols) - 4 Interactive Cards */}
            <div className="lg:col-span-5 w-full">
              <div className="rounded-2xl sm:rounded-[32px] border border-white/10 bg-white/5 p-4 sm:p-7 backdrop-blur-md">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <Link
                    href="/category/lighting"
                    className="group rounded-xl sm:rounded-2xl bg-white/10 hover:bg-white/15 p-3.5 sm:p-5 border border-white/10 transition hover:-translate-y-1 block cursor-pointer"
                  >
                    <div className="text-2xl sm:text-3xl transition group-hover:scale-110">💡</div>
                    <h3 className="mt-2 text-sm sm:text-lg font-black text-white">كهرباء وإنارة</h3>
                    <p className="mt-0.5 text-[11px] sm:text-xs text-gray-300">إضاءة وأفياش ومفاتيح</p>
                  </Link>

                  <Link
                    href="/category/plumbing"
                    className="group rounded-xl sm:rounded-2xl bg-white/10 hover:bg-white/15 p-3.5 sm:p-5 border border-white/10 transition hover:-translate-y-1 block cursor-pointer"
                  >
                    <div className="text-2xl sm:text-3xl transition group-hover:scale-110">🚿</div>
                    <h3 className="mt-2 text-sm sm:text-lg font-black text-white">سباكة وأدوات صحية</h3>
                    <p className="mt-0.5 text-[11px] sm:text-xs text-gray-300">أطقم وتمديدات وشبكات</p>
                  </Link>

                  <Link
                    href="/category/building"
                    className="group rounded-xl sm:rounded-2xl bg-white/10 hover:bg-white/15 p-3.5 sm:p-5 border border-white/10 transition hover:-translate-y-1 block cursor-pointer"
                  >
                    <div className="text-2xl sm:text-3xl transition group-hover:scale-110">🧱</div>
                    <h3 className="mt-2 text-sm sm:text-lg font-black text-white">مواد بناء ودهانات</h3>
                    <p className="mt-0.5 text-[11px] sm:text-xs text-gray-300">أساسات وتشطيب متكامل</p>
                  </Link>

                  <Link
                    href="/category/tools"
                    className="group rounded-xl sm:rounded-2xl bg-white/10 hover:bg-white/15 p-3.5 sm:p-5 border border-white/10 transition hover:-translate-y-1 block cursor-pointer"
                  >
                    <div className="text-2xl sm:text-3xl transition group-hover:scale-110">🛠️</div>
                    <h3 className="mt-2 text-sm sm:text-lg font-black text-white">عدد وأدوات</h3>
                    <p className="mt-0.5 text-[11px] sm:text-xs text-gray-300">معدات ومستلزمات مهنية</p>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section - 8 Categories */}
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

          <div className="mt-8 sm:mt-12 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {displayCategories.map((category) => (
              <Link
                key={category.id}
                href={`/category/${category.slug || "tools"}`}
                className="group overflow-hidden rounded-2xl sm:rounded-3xl border border-black/5 bg-white shadow-xs transition duration-300 hover:-translate-y-1.5 hover:shadow-xl flex flex-col justify-between cursor-pointer"
                title={`تصفح معروضات قسم ${category.name}`}
              >
                <div className="relative h-48 sm:h-56 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
                  <img
                    src={category.image_url || category.thumbnail || "/thumbnails/tools.jpg"}
                    alt={category.name}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                  {category.images_count ? (
                    <span className="absolute top-3 right-3 rounded-lg bg-black/60 text-white px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm">
                      {category.images_count} صورة
                    </span>
                  ) : null}
                </div>
                <div className="p-4 sm:p-6 flex flex-col flex-1 justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg sm:text-xl font-black text-gray-900 group-hover:text-[#123B5D] transition">
                        {category.name}
                      </h3>
                      <span className="text-xl sm:text-2xl transition group-hover:scale-125">
                        {category.icon || "🧱"}
                      </span>
                    </div>
                    {category.description && (
                      <p className="mt-2 text-xs sm:text-sm leading-relaxed text-gray-500 line-clamp-2">
                        {category.description}
                      </p>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between pt-3 border-t border-gray-100">
                    <span className="inline-flex items-center gap-1 font-bold text-xs sm:text-sm text-[#123B5D] group-hover:underline">
                      <span>تصفح معروضات القسم</span>
                      <span className="transition-transform group-hover:translate-x-[-4px]">←</span>
                    </span>
                    <span className="text-[11px] text-gray-400 font-medium">
                      للعرض فقط
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Store Location Map Section */}
      <section
        id="location"
        className="w-full bg-[#f8fafc] border-y border-gray-200/80 px-4 sm:px-6 lg:px-8 py-12 sm:py-20"
      >
        <div className="mx-auto max-w-7xl">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#123B5D]/10 text-[#123B5D] px-4 py-1.5 text-xs sm:text-sm font-bold">
              📍 تفضل بزيارة معرضنا
            </span>
            <h2 className="mt-3 text-2xl sm:text-4xl font-black text-gray-900">
              موقع المحل على الخريطة
            </h2>
            <p className="mt-2 text-xs sm:text-base text-gray-600 leading-relaxed">
              يسعدنا تشريفكم في معرضنا الرئيسي بنجران للاطلاع على أحدث مواد البناء والسباكة والكهرباء وتلبية كافة احتياجات مشروعاتكم.
            </p>
          </div>

          {/* Interactive Card & Map Grid */}
          <div className="mt-8 sm:mt-12 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
            {/* Store Info Card (5 cols on lg) */}
            <div className="lg:col-span-5 flex flex-col justify-between rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-gray-200/90">
              <div>
                <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#123B5D] text-white text-2xl shadow-xs">
                    🏬
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-gray-900">
                      مؤسسة محل البناء الحديث للتجارة
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">
                      Modern Building — نجران
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3.5 text-xs sm:text-sm text-gray-700">
                  <div className="flex items-start gap-3">
                    <span className="text-base mt-0.5">📍</span>
                    <div>
                      <p className="font-bold text-gray-900">العنوان:</p>
                      <p className="text-gray-600 mt-0.5 leading-relaxed">
                        نجران – أبا السعود – طريق الملك عبدالعزيز
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="text-base mt-0.5">🏥</span>
                    <div>
                      <p className="font-bold text-gray-900">علامة مميزة:</p>
                      <p className="text-gray-600 mt-0.5 leading-relaxed">
                        مقابل مستشفى نجران العام القديم
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="text-base mt-0.5">🏷️</span>
                    <div>
                      <p className="font-bold text-gray-900">العنوان الوطني والرمز البريدي:</p>
                      <p className="text-gray-600 mt-0.5 font-mono">
                        العنوان المختصر: <span className="font-bold text-gray-900">NJSA3888</span> (مبنى 3888) | الرمز: <span className="font-bold text-gray-900">66277</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="text-base mt-0.5">⏱️</span>
                    <div>
                      <p className="font-bold text-gray-900">أوقات العمل:</p>
                      <p className="text-gray-600 mt-0.5 leading-relaxed">
                        السبت – الخميس: ٧:٠٠ ص – ١٠:٠٠ م <br />
                        الجمعة: ٤:٠٠ م – ١٠:٠٠ م
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-5 border-t border-gray-100 flex flex-col gap-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href="tel:0175420300"
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-2 sm:px-3 py-2.5 text-center text-xs sm:text-sm font-bold text-gray-800 transition hover:bg-gray-100"
                    title="الهاتف الثابت: 0175420300"
                  >
                    <span>📞</span>
                    <span className="font-mono text-xs sm:text-sm font-bold" dir="ltr">0175420300</span>
                  </a>
                  <a
                    href={settings.whatsapp_business || whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50/70 px-2 sm:px-3 py-2.5 text-center text-xs sm:text-sm font-bold text-gray-900 transition hover:bg-emerald-100 shadow-xs"
                    title="تواصل عبر الواتساب: 0554304322"
                  >
                    <span className="flex h-5 w-5 sm:h-5.5 sm:w-5.5 items-center justify-center rounded-md bg-[#25D366] text-white shrink-0 shadow-xs">
                      <svg className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                      </svg>
                    </span>
                    <span>واتساب</span>
                    <span className="font-mono text-xs sm:text-sm font-bold text-[#0f5132]" dir="ltr">0554304322</span>
                  </a>
                </div>

                <a
                  href="https://maps.app.goo.gl/VqfvbzxYBCMhGbpG8?g_st=aw"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#123B5D] px-5 py-3 text-center text-xs sm:text-sm font-bold text-white shadow-md transition hover:bg-[#0B2942]"
                >
                  <span>📍 فتح في تطبيق خرائط</span>
                  <span dir="ltr">↗</span>
                </a>
              </div>
            </div>

            {/* Map Frame (7 cols on lg) */}
            <div className="lg:col-span-7 rounded-3xl overflow-hidden shadow-sm border border-gray-200/90 bg-white relative min-h-[360px] sm:min-h-[440px] flex flex-col">
              {/* Header bar over map */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-white border-b border-gray-100 text-xs sm:text-sm font-bold text-gray-700">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span>معرض البناء الحديث (طريق الملك عبدالعزيز)</span>
                </div>
                <a
                  href="https://maps.app.goo.gl/VqfvbzxYBCMhGbpG8?g_st=aw"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#123B5D] hover:underline flex items-center gap-1"
                >
                  <span>تكبير الخريطة</span>
                  <span>↗</span>
                </a>
              </div>

              {/* Responsive Iframe Embed */}
              <div className="relative flex-1 w-full min-h-[320px] sm:min-h-[400px]">
                <iframe
                  title="موقع مؤسسة محل البناء الحديث على خرائط جوجل"
                  src="https://maps.google.com/maps?q=%D8%A7%D9%84%D8%A8%D9%86%D8%A7%D8%A1+%D8%A7%D9%84%D8%AD%D8%AF%D9%8A%D8%AB+%D9%84%D9%84%D8%A7%D8%AF%D9%88%D8%A7%D8%AA+%D8%A7%D9%84%D8%B3%D8%A8%D8%A7%D9%83%D8%A9+%D9%88%D8%A7%D9%84%D9%83%D9%87%D8%B1%D8%A8%D8%A7%D8%A1%D8%8C+3888+%D8%B7%D8%B1%D9%8A%D9%82+%D8%A7%D9%84%D9%85%D9%84%D9%83+%D8%B9%D8%A8%D8%AF%D8%A7%D9%84%D8%B9%D8%B2%D9%8A%D8%B2%D8%8C+%D8%A7%D8%A8%D8%A7+%D8%A7%D9%84%D8%B3%D8%B9%D9%88%D8%AF%D8%8C+%D9%86%D8%AC%D8%B1%D8%A7%D9%86&t=&z=16&ie=UTF8&iwloc=&output=embed"
                  className="absolute inset-0 h-full w-full border-0"
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                ></iframe>
              </div>
            </div>
          </div>
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
            categories={displayCategories}
          />
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="px-4 sm:px-6 lg:px-8 py-12 sm:py-20 w-full">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl sm:rounded-[36px] bg-[#0e1e2d] p-6 sm:p-12 md:p-14 text-white">
            <h2 className="text-2xl sm:text-4xl font-black md:text-5xl">
              شريكك الموثوق في كل خطوة
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

      {/* Full-width Black Footer & Contact Section */}
      <footer id="contact" className="w-full bg-[#0a0f14] text-white border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          {/* Logo & Headline */}
          <div className="flex flex-col items-center justify-center text-center">
            <div className="relative h-16 sm:h-20 md:h-24 w-60 sm:w-72 md:w-80">
              <NextImage
                src="/logo-white.png"
                alt="مؤسسة محل البناء الحديث للتجارة"
                fill
                className="object-contain"
              />
            </div>
            <p className="mx-auto mt-4 max-w-2xl text-xs sm:text-base leading-relaxed text-gray-400">
              تواصل معنا مباشرة لمعرفة تفاصيل المنتجات والأسعار وطلبات التوريد
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="mt-8 flex flex-wrap justify-center gap-2.5 sm:gap-3">
            <a
              href={phoneLink}
              className="rounded-full bg-white text-gray-900 px-6 sm:px-8 py-3 text-xs sm:text-sm font-bold transition hover:bg-gray-200 whitespace-nowrap shadow-md"
            >
              📞 اتصل بنا
            </a>
            <a
              href={settings.whatsapp_business || whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-[#25D366] text-white px-6 sm:px-8 py-3 text-xs sm:text-sm font-bold transition hover:bg-[#1ebe5b] whitespace-nowrap shadow-md"
            >
              💬 واتساب
            </a>
            <a
              href={emailLink}
              className="rounded-full border border-white/20 bg-white/5 px-6 sm:px-8 py-3 text-xs sm:text-sm font-bold transition hover:bg-white/10 whitespace-nowrap"
            >
              ✉️ البريد الإلكتروني
            </a>
            <a
              href={settings.instagram_url || "https://www.instagram.com/modern_building_1"}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/20 bg-white/5 px-6 sm:px-8 py-3 text-xs sm:text-sm font-bold transition hover:bg-white/10 whitespace-nowrap"
            >
              📸 Instagram
            </a>
            {settings.maps_url && (
              <a
                href={settings.maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/20 bg-white/5 px-6 sm:px-8 py-3 text-xs sm:text-sm font-bold transition hover:bg-white/10 whitespace-nowrap"
              >
                📍 موقعنا على الخريطة
              </a>
            )}
          </div>

          {/* Information Cards (Full width in 2 cols) */}
          <div className="mt-10 sm:mt-12 grid gap-6 text-xs sm:text-sm grid-cols-1 md:grid-cols-2 text-right">
            {/* Right card: Sales & Management */}
            <div className="rounded-2xl bg-white/[0.04] p-6 sm:p-7 border border-white/10 backdrop-blur-sm">
              <p className="text-base font-bold text-white border-b border-white/10 pb-3 flex items-center gap-2">
                <span>📞</span>
                <span>المبيعات والإدارة</span>
              </p>
              <div className="mt-4 space-y-3 text-gray-300 text-xs sm:text-sm">
                <div>
                  <p className="font-bold text-[#3b82f6]">مبيعات ومشتريات:</p>
                  <div className="mt-1.5 flex flex-col gap-1 pr-2">
                    <a href="tel:0558689100" className="hover:text-white transition">
                      إبراهيم: <span dir="ltr" className="font-mono text-white">0558689100</span>
                    </a>
                    <a href="tel:0501960009" className="hover:text-white transition">
                      بندر: <span dir="ltr" className="font-mono text-white">0501960009</span>
                    </a>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10">
                  <p className="font-bold text-[#3b82f6]">المدير العام:</p>
                  <a href="tel:0555794204" className="block mt-1 pr-2 hover:text-white transition">
                    علي يحيى: <span dir="ltr" className="font-mono text-white">0555794204</span>
                  </a>
                </div>

                <div className="pt-3 border-t border-white/10 space-y-2">
                  <p className="flex items-center justify-between sm:justify-start sm:gap-4">
                    <span className="font-bold text-[#3b82f6]">الهاتف الثابت:</span>{" "}
                    <a href="tel:0175420300" className="hover:text-white transition font-mono" dir="ltr">
                      0175420300
                    </a>
                  </p>
                  <p className="flex items-center justify-between sm:justify-start sm:gap-4">
                    <span className="font-bold text-[#3b82f6]">الواتساب:</span>{" "}
                    <a href="https://wa.me/966554304322" target="_blank" rel="noopener noreferrer" className="hover:text-white transition font-mono" dir="ltr">
                      0554304322
                    </a>
                  </p>
                  <p className="flex items-center justify-between sm:justify-start sm:gap-4">
                    <span className="font-bold text-[#3b82f6]">البريد الإلكتروني:</span>{" "}
                    <a href="mailto:Info@modernbuildingsa.com" className="hover:text-white transition font-mono" dir="ltr">
                      Info@modernbuildingsa.com
                    </a>
                  </p>
                </div>
              </div>
            </div>

            {/* Left card: Legal & Address */}
            <div className="rounded-2xl bg-white/[0.04] p-6 sm:p-7 border border-white/10 backdrop-blur-sm">
              <p className="text-base font-bold text-white border-b border-white/10 pb-3 flex items-center gap-2">
                <span>🧾</span>
                <span>البيانات القانونية والعنوان</span>
              </p>
              <div className="mt-4 space-y-3 text-gray-300 text-xs sm:text-sm">
                <p>
                  <span className="font-bold text-[#3b82f6]">الاسم القانوني:</span> مؤسسة محل البناء الحديث للتجارة
                </p>
                <p>
                  <span className="font-bold text-[#3b82f6]">السجل التجاري:</span> <span dir="ltr" className="font-mono text-white font-semibold">5950008086</span>
                </p>
                <p>
                  <span className="font-bold text-[#3b82f6]">الرقم الضريبي:</span> <span dir="ltr" className="font-mono text-white font-semibold">300912409900003</span>
                </p>
                <p>
                  <span className="font-bold text-[#3b82f6]">العنوان:</span> نجران – أبا السعود – البلد (مقابل مستشفى نجران العام)
                </p>
                <p>
                  <span className="font-bold text-[#3b82f6]">العنوان المختصر:</span> <span dir="ltr" className="font-mono text-white font-semibold">NJSA3888</span>
                </p>
                <p>
                  <span className="font-bold text-[#3b82f6]">الرمز البريدي:</span> <span dir="ltr" className="font-mono text-white font-semibold">66277</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Sub-Footer Bar */}
        <div className="border-t border-white/10 bg-black/60 py-6 px-4 sm:px-6 lg:px-8 w-full">
          <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-gray-400">
            <p>
              © {new Date().getFullYear()} مؤسسة محل البناء الحديث للتجارة. جميع الحقوق محفوظة.
            </p>
            <div className="flex items-center gap-6">
              <Link
                href="/privacy"
                className="transition hover:text-white font-semibold underline underline-offset-4"
              >
                سياسة الخصوصية
              </Link>
              <a
                href="#home"
                className="transition hover:text-white"
              >
                العودة للأعلى ↑
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
