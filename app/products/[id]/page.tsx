import { createClient } from "@/lib/supabase-server";
import NextImage from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import AddToCartButton from "@/components/AddToCartButton";
import ProductGallery from "@/components/ProductGallery";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  show_price: boolean;
  image_url: string | null;
  available: boolean;
};

type ProductImage = {
  id: string;
  image_url: string;
};

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select(
      "id, name, description, price, currency, show_price, image_url, available"
    )
    .eq("id", id)
    .single();

  if (!product) {
    notFound();
  }

  const { data: additionalImages } = await supabase
    .from("product_images")
    .select("id, image_url")
    .eq("product_id", id)
    .order("created_at", { ascending: true });

  const safeProduct = product as Product;
  const safeAdditionalImages: ProductImage[] =
    additionalImages || [];

  const allImages = [
    ...(safeProduct.image_url
      ? [
          {
            id: "main",
            image_url: safeProduct.image_url,
          },
        ]
      : []),
    ...safeAdditionalImages,
  ];

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f5f5f3] text-[#171717] w-full max-w-full overflow-x-hidden"
    >
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-gray-200/90 bg-white/95 backdrop-blur-md shadow-xs w-full">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 sm:gap-3 font-bold transition hover:text-orange-600 shrink min-w-0"
          >
            <div className="relative h-10 w-10 sm:h-12 sm:w-12 shrink-0">
              <NextImage
                src="/logo.png"
                alt="البناء الحديثة"
                fill
                className="object-contain"
              />
            </div>

            <span className="text-sm sm:text-base font-black truncate">مؤسسة البناء الحديث</span>
          </Link>

          <Link
            href="/#products"
            className="rounded-xl bg-black px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold text-white transition hover:bg-orange-600 whitespace-nowrap shrink-0"
          >
            العودة للمنتجات
          </Link>
        </div>
      </header>

      {/* Product */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 md:py-16 w-full">
        <div className="grid gap-10 lg:grid-cols-2">
          {/* Gallery */}
          <ProductGallery
            images={allImages}
            productName={safeProduct.name}
          />

          {/* Details */}
          <div className="flex flex-col justify-center">
            <span className="mb-4 inline-flex w-fit rounded-full bg-orange-100 px-4 py-2 text-sm font-bold text-orange-700">
              منتج من البناء الحديثة
            </span>

            <h1 className="text-4xl font-black leading-tight md:text-5xl">
              {safeProduct.name}
            </h1>

            {safeProduct.description && (
              <p className="mt-6 text-lg leading-8 text-gray-600">
                {safeProduct.description}
              </p>
            )}

            <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm">
              {safeProduct.show_price &&
              safeProduct.price !== null ? (
                <div>
                  <p className="text-sm font-bold text-gray-500">
                    السعر
                  </p>

                  <p className="mt-2 text-3xl font-black text-orange-600">
                    {safeProduct.price}{" "}
                    {safeProduct.currency || ""}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-bold text-gray-500">
                    السعر
                  </p>

                  <p className="mt-2 text-xl font-black">
                    تواصل معنا لمعرفة السعر
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3">
              {safeProduct.available && (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={`/products/${safeProduct.id}/order`}
                    className="flex-1 rounded-2xl bg-orange-600 px-6 py-4 text-center font-bold text-white transition hover:bg-orange-700"
                  >
                    اطلب الآن
                  </Link>

                  <AddToCartButton
                    product={safeProduct}
                  />
                </div>
              )}

              <a
                href="#contact"
                className="rounded-2xl border border-black/10 bg-white px-6 py-4 text-center font-bold transition hover:bg-gray-100"
              >
                تواصل معنا
              </a>
            </div>

            {!safeProduct.available && (
              <div className="mt-5 rounded-2xl bg-red-50 p-4 text-center font-bold text-red-600">
                المنتج غير متوفر حاليًا
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="px-6 pb-16">
        <div className="mx-auto max-w-4xl rounded-[32px] bg-[#171717] p-8 text-center text-white md:p-12">
          <h2 className="text-3xl font-black">
            محتاج تعرف تفاصيل أكتر؟
          </h2>

          <p className="mt-4 text-gray-400">
            تواصل معنا لمعرفة السعر والتفاصيل المتاحة للمنتج.
          </p>

          <Link
            href="/#contact"
            className="mt-7 inline-flex rounded-full bg-orange-600 px-7 py-4 font-bold transition hover:bg-orange-700"
          >
            تواصل معنا
          </Link>
        </div>
      </section>
    </main>
  );
}