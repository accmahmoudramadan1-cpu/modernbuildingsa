"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Category = {
  id: string;
  name: string;
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
};

export default function ProductSearch({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const filteredProducts = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !searchText ||
        product.name.toLowerCase().includes(searchText) ||
        (product.description || "").toLowerCase().includes(searchText);

      const matchesCategory =
        selectedCategory === "all" ||
        product.category_id === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  return (
    <div className="w-full max-w-full overflow-hidden">
      {/* Search + Filter */}
      <div className="mt-6 sm:mt-8 rounded-2xl sm:rounded-3xl border border-black/5 bg-[#f8f8f6] p-3 sm:p-5">
        <div className="flex flex-col gap-3 sm:gap-4 md:flex-row">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-lg sm:text-xl">
              🔎
            </span>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن منتج بالاسم أو المواصفات..."
              className="w-full rounded-xl sm:rounded-2xl border border-black/10 bg-white py-3 sm:py-3.5 pl-4 pr-11 text-sm sm:text-base outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
            />
          </div>

          {/* Category Filter */}
          <div className="w-full md:w-72">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-xl sm:rounded-2xl border border-black/10 bg-white px-3 sm:px-4 py-3 sm:py-3.5 text-sm sm:text-base font-medium outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
            >
              <option value="all">كل الأقسام</option>

              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Result count */}
        <div className="mt-3 text-xs sm:text-sm font-medium text-gray-500">
          {search || selectedCategory !== "all"
            ? `تم العثور على ${filteredProducts.length} منتج`
            : `إجمالي المنتجات المتاحة: ${products.length}`}
        </div>
      </div>

      {/* Products Grid */}
      {filteredProducts.length > 0 ? (
        <div className="mt-6 sm:mt-8 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {filteredProducts.map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              className="group overflow-hidden rounded-2xl sm:rounded-3xl border border-black/5 bg-[#f8f8f6] transition hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="relative h-52 sm:h-60 overflow-hidden bg-gray-200">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-5xl">
                      🧱
                    </div>
                  )}
                </div>

                <div className="p-4 sm:p-5">
                  <h3 className="text-base sm:text-lg font-black text-gray-900 leading-snug line-clamp-2">
                    {product.name}
                  </h3>

                  {product.description && (
                    <p className="mt-2 line-clamp-2 text-xs sm:text-sm leading-relaxed text-gray-500">
                      {product.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-4 sm:p-5 pt-0">
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-black/5 pt-3">
                  <div>
                    {product.show_price && product.price !== null ? (
                      <span className="text-sm sm:text-base font-black text-[#123B5D]">
                        {product.price} {product.currency || "ر.س"}
                      </span>
                    ) : (
                      <span className="text-xs sm:text-sm font-bold text-gray-500">
                        تواصل لمعرفة السعر
                      </span>
                    )}
                  </div>

                  <span className="inline-flex items-center gap-1 rounded-xl bg-[#123B5D] px-3.5 py-1.5 text-xs font-bold text-white transition group-hover:bg-[#0B2942]">
                    <span>معاينة</span>
                    <span>←</span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-6 sm:mt-8 rounded-2xl sm:rounded-3xl bg-[#f5f5f3] p-8 sm:p-12 text-center">
          <div className="text-4xl sm:text-5xl">🔎</div>
          <h3 className="mt-3 text-lg sm:text-xl font-black">
            لا توجد منتجات مطابقة
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-gray-500">
            جرّب البحث باسم مختلف أو اختر قسمًا آخر.
          </p>
        </div>
      )}
    </div>
  );
}
