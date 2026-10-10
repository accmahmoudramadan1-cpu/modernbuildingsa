"use client";

import Link from "next/link";
import { useCart } from "@/app/components/CartProvider";

export default function CartButton() {
  const { cartCount } = useCart();

  return (
    <Link
      href="/cart"
      className="relative flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 font-bold transition hover:border-orange-500 hover:text-orange-600"
    >
      <span className="text-xl">🛒</span>

      <span>السلة</span>

      {cartCount > 0 && (
        <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-orange-600 px-1 text-xs font-black text-white">
          {cartCount}
        </span>
      )}
    </Link>
  );
}