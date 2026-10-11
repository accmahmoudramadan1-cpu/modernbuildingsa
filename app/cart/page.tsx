"use client";

import Link from "next/link";
import { useCart } from "@/components/CartProvider";

export default function CartPage() {
  const {
    items,
    removeFromCart,
    updateQuantity,
    clearCart,
  } = useCart();

  const total = items.reduce((sum, item) => {
    if (
      !item.product.show_price ||
      item.product.price === null
    ) {
      return sum;
    }

    return sum + item.product.price * item.quantity;
  }, 0);

  const hasVisiblePrices = items.some(
    (item) =>
      item.product.show_price &&
      item.product.price !== null
  );

  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-white px-6 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <div className="text-7xl">🛒</div>

          <h1 className="mt-6 text-3xl font-black">
            السلة فارغة
          </h1>

          <p className="mt-3 text-gray-500">
            لم تضف أي منتجات إلى السلة حتى الآن.
          </p>

          <Link
            href="/#products"
            className="mt-8 inline-flex rounded-2xl bg-orange-600 px-8 py-4 font-bold text-white transition hover:bg-orange-700"
          >
            تصفح المنتجات
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-black">
              سلة المشتريات
            </h1>

            <p className="mt-2 text-gray-500">
              راجع المنتجات والكميات قبل إتمام الطلب.
            </p>
          </div>

          <button
            type="button"
            onClick={clearCart}
            className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50"
          >
            إفراغ السلة
          </button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_350px]">
          <div className="space-y-4">
            {items.map((item) => {
              const product = item.product;

              const itemHasPrice =
                product.show_price &&
                product.price !== null;

              return (
                <div
                  key={product.id}
                  className="rounded-3xl border border-black/5 bg-[#f8f8f6] p-4 sm:p-6"
                >
                  <div className="flex gap-4">
                    <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-gray-200">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-4xl">
                          🧱
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-black">
                            {product.name}
                          </h2>

                          {itemHasPrice ? (
                            <p className="mt-2 font-bold text-orange-600">
                              {product.price}{" "}
                              {product.currency || ""}
                            </p>
                          ) : (
                            <p className="mt-2 text-sm font-bold text-gray-500">
                              تواصل معنا لمعرفة السعر
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeFromCart(product.id)
                          }
                          className="text-sm font-bold text-red-500 transition hover:text-red-700"
                        >
                          حذف
                        </button>
                      </div>

                      <div className="mt-5 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(
                              product.id,
                              item.quantity - 1
                            )
                          }
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white text-xl font-black transition hover:border-orange-500 hover:text-orange-600"
                        >
                          −
                        </button>

                        <span className="min-w-8 text-center font-black">
                          {item.quantity}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(
                              product.id,
                              item.quantity + 1
                            )
                          }
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white text-xl font-black transition hover:border-orange-500 hover:text-orange-600"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {itemHasPrice && (
                    <div className="mt-5 border-t border-black/5 pt-4 text-left">
                      <span className="text-sm text-gray-500">
                        إجمالي المنتج:
                      </span>

                      <span className="mr-2 font-black text-orange-600">
                        {product.price! * item.quantity}{" "}
                        {product.currency || ""}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <aside className="h-fit rounded-3xl border border-black/5 bg-[#f8f8f6] p-6">
            <h2 className="text-xl font-black">
              ملخص الطلب
            </h2>

            <div className="mt-6 flex items-center justify-between border-b border-black/5 pb-5">
              <span className="text-gray-500">
                عدد المنتجات
              </span>

              <span className="font-black">
                {items.reduce(
                  (sum, item) => sum + item.quantity,
                  0
                )}
              </span>
            </div>

            {hasVisiblePrices ? (
              <div className="mt-5 flex items-center justify-between">
                <span className="font-bold">
                  الإجمالي
                </span>

                <span className="text-xl font-black text-orange-600">
                  {total}
                </span>
              </div>
            ) : (
              <p className="mt-5 rounded-2xl bg-white p-4 text-sm font-bold leading-6 text-gray-500">
                بعض المنتجات لا يظهر سعرها.
                <br />
                سيتم التواصل معك لمعرفة السعر.
              </p>
            )}

            <Link
              href="/cart/checkout"
              className="mt-6 flex w-full items-center justify-center rounded-2xl bg-orange-600 px-6 py-4 font-black text-white transition hover:bg-orange-700"
            >
              إتمام الطلب
            </Link>

            <Link
              href="/#products"
              className="mt-3 flex w-full items-center justify-center rounded-2xl border border-black/10 bg-white px-6 py-4 font-bold transition hover:bg-gray-100"
            >
              متابعة التسوق
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}

