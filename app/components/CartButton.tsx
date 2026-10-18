"use client";

import Link from "next/link";
import { useCart } from "@/components/CartProvider";

export default function CartButton() {
  const { cartCount } = useCart();

  return (
    <Link
      href="/cart"
      className="relative flex items-center gap-1.5 sm:gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 sm:px-4 sm:py-2.5 font-bold text-gray-800 shadow-2xs transition hover:border-orange-500 hover:text-orange-600 whitespace-nowrap shrink-0"
    >
      <span className="text-lg sm:text-xl">🛒</span>

      <span className="text-xs sm:text-sm">السلة</span>

      {cartCount > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-600 px-1 text-[11px] font-black text-white shadow-xs">
          {cartCount}
        </span>
      )}
    </Link>
  );
}
