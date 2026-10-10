import NextImage from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import CartButton from "@/app/components/CartButton";
import ProductSearch from "@/app/components/ProductSearch";
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
    company_name: siteSettings?.company_name || "البناء الحديثة",
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
    <main
      dir="rtl"
      className="min-h-screen bg-[#f5f5f3] text-[#171717]"
    >
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14">
              <NextImage
                src="/logo.png"
                alt={settings.company_name || "البناء الحديثة"}
                fill
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl font-black leading-tight">
                مؤسسة محل البناء الحديث للتجارة
                <span className="block text-sm font-bold text-gray-500">
                  Modern Building
                </span>
              </h1>
              <p className="text-xs text-gray-500">
                {settings.description}
              </p>
            </div>
          </div>
<CartButton />
          <nav className="hidden items-center gap-8 font-medium md:flex">
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
          <a
            href="#contact"
            className="rounded-full bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-[#123B5D]"
          >
            تواصل معنا
          </a>
        </div>
      </header>
      {/* Hero */}
      <section
        id="home"
        className="relative overflow-hidden bg-[#171717] text-white"
      >
        <div className="mx-auto grid min-h-[620px] max-w-7xl items-center gap-10 px-6 py-20 lg:grid-cols-2">
          <div>
            <span className="mb-6 inline-flex rounded-full border border-white/20 px-5 py-2 text-sm text-gray-300">
              {settings.description}
            </span>
            <h2 className="text-5xl font-black leading-tight md:text-7xl">
              كل ما تحتاجه
              <br />
              <span className="text-[#2F638A]">
                لبناء أفضل
              </span>
            </h2>
            <p className="mt-7 max-w-xl text-lg leading-8 text-gray-300">
              {settings.description}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#products"
                className="rounded-full bg-[#123B5D] px-7 py-4 text-center font-bold transition hover:bg-[#0B2942]"
              >
                تصفح المنتجات
              </a>
              <a
                href="#contact"
                className="rounded-full border border-white/20 px-7 py-4 text-center font-bold transition hover:bg-white/10"
              >
                تواصل معنا
              </a>
            </div>
          </div>
          <div className="hidden lg:block">
            <div className="rounded-[40px] border border-white/10 bg-white/5 p-10">
              <div className="grid grid-cols-2 gap-5">
                <div className="rounded-3xl bg-[#123B5D] p-7">
                  <div className="text-4xl">🏗️</div>
                  <h3 className="mt-5 text-xl font-black">
                    مواد بناء
                  </h3>
                  <p className="mt-2 text-sm text-white/80">
                    منتجات متنوعة للمشروعات
                  </p>
                </div>
                <div className="rounded-3xl bg-white/10 p-7">
                  <div className="text-4xl">🧱</div>
                  <h3 className="mt-5 text-xl font-black">
                    جودة عالية
                  </h3>
                  <p className="mt-2 text-sm text-gray-300">
                    منتجات مختارة بعناية
                  </p>
                </div>
                <div className="rounded-3xl bg-white/10 p-7">
                  <div className="text-4xl">🚚</div>
                  <h3 className="mt-5 text-xl font-black">
                    خدمة سريعة
                  </h3>
                  <p className="mt-2 text-sm text-gray-300">
                    سهولة في التواصل والطلب
                  </p>
                </div>
                <div className="rounded-3xl bg-white/10 p-7">
                  <div className="text-4xl">📞</div>
                  <h3 className="mt-5 text-xl font-black">
                    تواصل مباشر
                  </h3>
                  <p className="mt-2 text-sm text-gray-300">
                    اسأل عن المنتج والسعر
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Categories */}
      <section id="categories" className="px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <span className="text-sm font-bold text-[#123B5D]">
              أقسام المتجر
            </span>
            <h2 className="mt-3 text-4xl font-black">
              تصفح حسب القسم
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-500">
              اختر القسم الذي تبحث عنه للوصول إلى المنتجات
              المتاحة.
            </p>
          </div>
          {safeCategories.length > 0 ? (
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {safeCategories.map((category) => (
                <div
                  key={category.id}
                  className="group overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
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
                      <p className="mt-3 text-sm leading-6 text-gray-500">
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
      {/* Products */}
      <section
        id="products"
        className="bg-white px-6 py-20"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <span className="text-sm font-bold text-[#123B5D]">
                منتجاتنا
              </span>
              <h2 className="mt-3 text-4xl font-black">
                منتجات مميزة
              </h2>
              <p className="mt-4 max-w-2xl text-gray-500">
                اكتشف المنتجات المتاحة حاليًا وتواصل معنا لمعرفة
                الأسعار والتفاصيل.
              </p>
            </div>
          </div>
<ProductSearch
  products={safeProducts}
  categories={safeCategories}
/>
</div>
</section>
      {/* About */}
      <section id="about" className="px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[40px] bg-[#171717] p-8 text-white md:p-14">
            <span className="text-sm font-bold text-[#2F638A]">
              لماذا {settings.company_name}؟
            </span>
            <h2 className="mt-4 text-4xl font-black md:text-5xl">
              شريكك في كل خطوة
            </h2>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              <div>
                <div className="text-4xl">🏗️</div>
                <h3 className="mt-4 text-xl font-black">
                  منتجات متنوعة
                </h3>
                <p className="mt-3 leading-7 text-gray-400">
                  مجموعة كبيرة من مواد البناء والتشطيب لمختلف
                  الاحتياجات.
                </p>
              </div>
              <div>
                <div className="text-4xl">⭐</div>
                <h3 className="mt-4 text-xl font-black">
                  جودة موثوقة
                </h3>
                <p className="mt-3 leading-7 text-gray-400">
                  نهتم بتوفير منتجات بجودة مناسبة للمشروعات
                  المختلفة.
                </p>
              </div>
              <div>
                <div className="text-4xl">📞</div>
                <h3 className="mt-4 text-xl font-black">
                  خدمة مباشرة
                </h3>
                <p className="mt-3 leading-7 text-gray-400">
                  تواصل معنا للحصول على تفاصيل المنتج والسعر
                  المناسب.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Contact */}
      <section id="contact" className="px-6 pb-20">
        <div className="mx-auto max-w-5xl rounded-[40px] bg-[#123B5D] p-8 text-center text-white md:p-14">
          <h2 className="text-4xl font-black leading-tight">
            مؤسسة محل البناء الحديث للتجارة
            <span className="mt-2 block text-xl font-bold text-white/90">
              Modern Building
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/90">
            تواصل معنا مباشرة لمعرفة 
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href={phoneLink}
              className="rounded-full bg-black px-8 py-4 font-bold transition hover:bg-white hover:text-black"
            >
              📞 اتصل بنا
            </a>
            <a
              href={settings.whatsapp_business || "https://wa.me/966554304322"}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/30 px-8 py-4 font-bold transition hover:bg-white/10"
              >
                💬 WhatsApp
              </a>
            <a
              href={emailLink}
              className="rounded-full border border-white/30 px-8 py-4 font-bold transition hover:bg-white/10"
            >
              ✉️ البريد الإلكتروني
            </a>
            <a
              href={settings.instagram_url || "https://www.instagram.com/modern_building_1?stkn=ZGV6YjRxZDVzMWNo"}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/30 px-8 py-4 font-bold transition hover:bg-white/10"
              >
                📸 Instagram
              </a>
            {settings.maps_url && (
              <a
                href={settings.maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/30 px-8 py-4 font-bold transition hover:bg-white/10"
              >
                📍 موقعنا على الخريطة
              </a>
            )}
            <a
              href="#products"
              className="rounded-full border border-white/30 px-8 py-4 font-bold transition hover:bg-white/10"
            >
              تصفح المنتجات
            </a>
          </div>
          <div className="mt-8 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-2xl bg-black/15 p-4">
              <p className="text-lg font-bold">📞 تواصل معنا</p>
              <div className="mt-2 space-y-0.5 text-white/90">
                <p className="font-bold">مدير مبيعات ومشتريات</p>
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
                <p className="font-bold">مدير عام — علي يحيى</p>
                <a
                  href="tel:+966555794204"
                  className="block transition hover:text-white hover:underline"
                >
                  0555794204
                </a>
              </div>
            </div>
            <div className="rounded-2xl bg-black/15 p-4">
              <p className="text-lg font-bold">🧾الأسم القانوني</p>
              <p className="mt-1">مؤسسة محل البناء الحديث للتجارة</p>
              <div className="mt-2 space-y-1 text-white/90">
                <p>الرقم الضريبي: 5950008086</p>
                <p>السجل التجاري: 300912409900003</p>
                <p>0561813949</p>
                <p>الهاتف: 00966175423431</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}