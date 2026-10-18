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
    <div>
      {/* Search + Filter */}
      <div className="mt-8 rounded-3xl border border-black/5 bg-[#f8f8f6] p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row">
          {/* Search */}
          <div className="relative flex-1">
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xl">
              🔎
            </span>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن منتج..."
              className="w-full rounded-2xl border border-black/10 bg-white py-4 pl-4 pr-12 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
            />
          </div>

          {/* Category Filter */}
          <div className="md:w-72">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-4 font-medium outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
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
        <div className="mt-4 text-sm font-medium text-gray-500">
          {search || selectedCategory !== "all"
            ? `تم العثور على ${filteredProducts.length} منتج`
            : `عدد المنتجات: ${products.length}`}
        </div>
      </div>

      {/* Products */}
      {filteredProducts.length > 0 ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {filteredProducts.map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              className="group overflow-hidden rounded-3xl border border-black/5 bg-[#f8f8f6] transition hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="relative h-64 overflow-hidden bg-gray-200">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-6xl">
                    🧱
                  </div>
                )}
              </div>

              <div className="p-6">
                <h3 className="text-lg font-black">{product.name}</h3>

                {product.description && (
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-gray-500">
                    {product.description}
                  </p>
                )}

                <div className="mt-5 flex items-center justify-between gap-3">
                  <div>
                    {product.show_price && product.price !== null ? (
                      <span className="font-black text-orange-600">
                        {product.price} {product.currency || ""}
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-gray-500">
                        تواصل معنا لمعرفة السعر
                      </span>
                    )}
                  </div>

                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black text-xl text-white transition group-hover:bg-orange-600">
                    +
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-3xl bg-[#f5f5f3] p-12 text-center">
          <div className="text-5xl">🔎</div>
          <h3 className="mt-4 text-xl font-black">
            لا توجد منتجات مطابقة
          </h3>
          <p className="mt-2 text-gray-500">
            جرّب البحث باسم مختلف أو اختر قسمًا آخر.
          </p>
        </div>
      )}
    </div>
  );
}
