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

  // 8 Standard Categories requested by Store Owner
  const officialCategories: { name: string; icon: string; description: string }[] = [
    {
      name: "مواد الكهرباء",
      icon: "⚡",
      description: "أسلاك، قواطع، لوحات توزيع، مفاتيح وأفياش معتمدة بأعلى معايير الأمان.",
    },
    {
      name: "مواد الإنارة",
      icon: "💡",
      description: "كشافات، إضاءات داخلية وخارجية، ليد، سبوتات وثريات ديكورية عصرية.",
    },
    {
      name: "مواد السباكة والتمديدات",
      icon: "🔧",
      description: "مواسير حرارية، محابس، قطع ربط، وشبكات تغذية وصرف متينة ومضمونة.",
    },
    {
      name: "الأدوات الصحية",
      icon: "🚿",
      description: "خلاطات، شطافات، مغاسل، كراسي ومستلزمات دورات المياه بأرقى الموديلات.",
    },
    {
      name: "مواد البناء",
      icon: "🏗️",
      description: "إسمنت، عوازل مائية وحرارية، لواصق وترويبات سيراميك عالية الالتصاق.",
    },
    {
      name: "مواد الدهانات",
      icon: "🎨",
      description: "دهانات داخلية وخارجية، معاجين، عوازل وأساسات بجودة وثبات ألوان عالي.",
    },
    {
      name: "أدوات السلامة",
      icon: "🦺",
      description: "خوذات، أحذية سلامة، قفازات، سترات عاكسة ومعدات وقاية للمواقع الإنشائية.",
    },
    {
      name: "عدد وأدوات",
      icon: "🛠️",
      description: "عدد يدوية وكهربائية، مسامير، أدوات قياس وقطع احترافية للمهنيين.",
    },
  ];

  const dbCategories: Category[] = categories || [];

  // Match DB categories to official list or generate standardized fallbacks
  const displayCategories: Category[] = officialCategories.map((official, idx) => {
    const matched = dbCategories.find(
      (c) =>
        c.name.trim().toLowerCase() === official.name.trim().toLowerCase() ||
        official.name.includes(c.name.trim()) ||
        c.name.includes(official.name.trim())
    );

    return {
      id: matched ? matched.id : `cat-official-${idx + 1}`,
      name: official.name,
      description: matched?.description || official.description,
      image_url: matched?.image_url || null,
      icon: official.icon,
    };
  });

  // Append any extra unique DB categories
  dbCategories.forEach((dbCat) => {
    const alreadyIncluded = displayCategories.some(
      (c) => c.name.trim() === dbCat.name.trim() || c.id === dbCat.id
    );
    if (!alreadyIncluded) {
      displayCategories.push(dbCat);
    }
  });

  const safeProducts: Product[] = products || [];

  const settings: SiteSettings = {
    company_name: siteSettings?.company_name || "مؤسسة محل البناء الحديث للتجارة",
    phone_1: siteSettings?.phone_1 || "0558689100",
    phone_2: siteSettings?.phone_2 || "0501960009",
    landline: siteSettings?.landline || "0175423431",
    whatsapp: siteSettings?.whatsapp || "0554304322",
    address:
      siteSettings?.address ||
      "نجران – أبا السعود – البلد (مقابل مستشفى نجران العام)",
    description: siteSettings?.description || "لمواد البناء والتشطيب",
    maps_url: siteSettings?.maps_url || null,
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

          {/* Action buttons (Left side in RTL) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <CartButton />

            {/* Quick Call icon on small mobile */}
            <a
              href={phoneLink}
              className="sm:hidden flex h-10 w-10 items-center justify-center rounded-xl bg-[#123B5D] text-white shadow-xs"
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
                  <a
                    href="#categories"
                    className="group rounded-xl sm:rounded-2xl bg-white/10 hover:bg-white/15 p-3.5 sm:p-5 border border-white/10 transition hover:-translate-y-1 block cursor-pointer"
                  >
                    <div className="text-2xl sm:text-3xl transition group-hover:scale-110">💡</div>
                    <h3 className="mt-2 text-sm sm:text-lg font-black text-white">كهرباء وإنارة</h3>
                    <p className="mt-0.5 text-[11px] sm:text-xs text-gray-300">إضاءة وأفياش ومفاتيح</p>
                  </a>

                  <a
                    href="#categories"
                    className="group rounded-xl sm:rounded-2xl bg-white/10 hover:bg-white/15 p-3.5 sm:p-5 border border-white/10 transition hover:-translate-y-1 block cursor-pointer"
                  >
                    <div className="text-2xl sm:text-3xl transition group-hover:scale-110">🚿</div>
                    <h3 className="mt-2 text-sm sm:text-lg font-black text-white">سباكة وأدوات صحية</h3>
                    <p className="mt-0.5 text-[11px] sm:text-xs text-gray-300">أطقم وتمديدات وشبكات</p>
                  </a>

                  <a
                    href="#categories"
                    className="group rounded-xl sm:rounded-2xl bg-white/10 hover:bg-white/15 p-3.5 sm:p-5 border border-white/10 transition hover:-translate-y-1 block cursor-pointer"
                  >
                    <div className="text-2xl sm:text-3xl transition group-hover:scale-110">🧱</div>
                    <h3 className="mt-2 text-sm sm:text-lg font-black text-white">مواد بناء ودهانات</h3>
                    <p className="mt-0.5 text-[11px] sm:text-xs text-gray-300">أساسات وتشطيب متكامل</p>
                  </a>

                  <a
                    href="#categories"
                    className="group rounded-xl sm:rounded-2xl bg-white/10 hover:bg-white/15 p-3.5 sm:p-5 border border-white/10 transition hover:-translate-y-1 block cursor-pointer"
                  >
                    <div className="text-2xl sm:text-3xl transition group-hover:scale-110">🛠️</div>
                    <h3 className="mt-2 text-sm sm:text-lg font-black text-white">عدد وأدوات</h3>
                    <p className="mt-0.5 text-[11px] sm:text-xs text-gray-300">معدات ومستلزمات مهنية</p>
                  </a>
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
              <div
                key={category.id}
                className="group overflow-hidden rounded-2xl sm:rounded-3xl border border-black/5 bg-white shadow-xs transition hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between"
              >
                <div className="relative h-44 sm:h-52 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                  {category.image_url ? (
                    <img
                      src={category.image_url}
                      alt={category.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-5xl sm:text-6xl transition duration-500 group-hover:scale-110 select-none">
                      {category.icon || "🧱"}
                    </div>
                  )}
                </div>
                <div className="p-4 sm:p-6 flex flex-col flex-1 justify-between">
                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-gray-900">
                      {category.name}
                    </h3>
                    {category.description && (
                      <p className="mt-2 text-xs sm:text-sm leading-relaxed text-gray-500 line-clamp-3">
                        {category.description}
                      </p>
                    )}
                  </div>
                  <a
                    href="#products"
                    className="mt-4 inline-flex items-center gap-1 font-bold text-sm text-[#123B5D] transition hover:text-[#0B2942]"
                  >
                    <span>مشاهدة المنتجات</span>
                    <span>←</span>
                  </a>
                </div>
              </div>
            ))}
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

      {/* Contact Section */}
      <section id="contact" className="px-4 sm:px-6 lg:px-8 pb-12 sm:pb-20 w-full">
        <div className="mx-auto max-w-5xl rounded-2xl sm:rounded-[36px] bg-[#123B5D] p-6 sm:p-12 md:p-14 text-center text-white shadow-xl">
          {/* Logo instead of text */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative h-16 sm:h-20 md:h-24 w-60 sm:w-72 md:w-80">
              <NextImage
                src="/logo.png"
                alt="مؤسسة محل البناء الحديث للتجارة"
                fill
                className="object-contain"
              />
            </div>
            <p className="mt-3 text-sm sm:text-lg text-white/90 font-bold">
              Modern Building
            </p>
            <p className="mx-auto mt-2 max-w-2xl text-xs sm:text-base leading-relaxed text-white/80">
              تواصل معنا مباشرة لمعرفة تفاصيل المنتجات والأسعار وطلبات التوريد
            </p>
          </div>

          {/* Action buttons */}
          <div className="mt-6 sm:mt-8 flex flex-wrap justify-center gap-2 sm:gap-3">
            <a
              href={phoneLink}
              className="rounded-full bg-white text-[#123B5D] px-6 sm:px-8 py-3 text-xs sm:text-sm font-bold transition hover:bg-gray-100 whitespace-nowrap shadow-md"
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

          {/* Cards for Management & Legal details */}
          <div className="mt-8 sm:mt-10 grid gap-4 text-xs sm:text-sm grid-cols-1 md:grid-cols-2 text-right">
            {/* Right card: Sales & Management */}
            <div className="rounded-xl sm:rounded-2xl bg-black/20 p-5 sm:p-6 border border-white/10">
              <p className="text-sm sm:text-base font-bold text-white border-b border-white/10 pb-2">
                📞 المبيعات والإدارة
              </p>
              <div className="mt-3 space-y-2.5 text-white/90 text-xs sm:text-sm">
                <div>
                  <p className="font-semibold text-blue-200">مبيعات ومشتريات:</p>
                  <div className="mt-1 flex flex-col gap-1 pr-2">
                    <a href="tel:0558689100" className="hover:underline hover:text-white">
                      إبراهيم: <span dir="ltr">0558689100</span>
                    </a>
                    <a href="tel:0501960009" className="hover:underline hover:text-white">
                      بندر: <span dir="ltr">0501960009</span>
                    </a>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10">
                  <p className="font-semibold text-blue-200">المدير العام:</p>
                  <a href="tel:0555794204" className="block mt-1 pr-2 hover:underline hover:text-white">
                    علي يحيى: <span dir="ltr">0555794204</span>
                  </a>
                </div>

                <div className="pt-2 border-t border-white/10 space-y-1.5">
                  <p>
                    <span className="font-semibold text-blue-200">الهاتف الثابت:</span>{" "}
                    <a href="tel:0175423431" className="hover:underline hover:text-white" dir="ltr">
                      0175423431
                    </a>
                  </p>
                  <p>
                    <span className="font-semibold text-blue-200">الواتساب:</span>{" "}
                    <a href="https://wa.me/966554304322" target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-white" dir="ltr">
                      0554304322
                    </a>
                  </p>
                  <p>
                    <span className="font-semibold text-blue-200">البريد الإلكتروني:</span>{" "}
                    <a href="mailto:Info@modernbuildingsa.com" className="hover:underline hover:text-white" dir="ltr">
                      Info@modernbuildingsa.com
                    </a>
                  </p>
                </div>
              </div>
            </div>

            {/* Left card: Legal & Address */}
            <div className="rounded-xl sm:rounded-2xl bg-black/20 p-5 sm:p-6 border border-white/10">
              <p className="text-sm sm:text-base font-bold text-white border-b border-white/10 pb-2">
                🧾 البيانات القانونية والعنوان
              </p>
              <div className="mt-3 space-y-2.5 text-white/90 text-xs sm:text-sm">
                <p>
                  <span className="font-semibold text-blue-200">الاسم القانوني:</span> مؤسسة محل البناء الحديث للتجارة
                </p>
                <p>
                  <span className="font-semibold text-blue-200">السجل التجاري:</span> <span dir="ltr">5950008086</span>
                </p>
                <p>
                  <span className="font-semibold text-blue-200">الرقم الضريبي:</span> <span dir="ltr">300912409900003</span>
                </p>
                <p>
                  <span className="font-semibold text-blue-200">العنوان:</span> نجران – أبا السعود – البلد (مقابل مستشفى نجران العام)
                </p>
                <p>
                  <span className="font-semibold text-blue-200">العنوان المختصر:</span> <span dir="ltr">NJSA3888</span>
                </p>
                <p>
                  <span className="font-semibold text-blue-200">الرمز البريدي:</span> <span dir="ltr">66277</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Bottom Bar */}
      <footer className="border-t border-gray-200 bg-white py-6 px-4 sm:px-6 lg:px-8 w-full">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-gray-600">
          <p>
            © {new Date().getFullYear()} مؤسسة محل البناء الحديث للتجارة. جميع الحقوق محفوظة.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/privacy"
              className="transition hover:text-[#123B5D] font-semibold underline underline-offset-4"
            >
              سياسة الخصوصية
            </Link>
            <a
              href="#home"
              className="transition hover:text-[#123B5D]"
            >
              العودة للأعلى ↑
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
