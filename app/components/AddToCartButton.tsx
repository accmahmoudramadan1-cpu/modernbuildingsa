"use client";

import { useState } from "react";
import { useCart } from "@/components/CartProvider";

type AddToCartButtonProps = {
  product: {
    id: string;
    name: string;
    price: number | null;
    currency: string | null;
    show_price: boolean;
    image_url: string | null;
  };
};

export default function AddToCartButton({
  product,
}: AddToCartButtonProps) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  function handleAddToCart() {
    addToCart(product);
    setAdded(true);

    setTimeout(() => {
      setAdded(false);
    }, 2000);
  }

  return (
    <button
      type="button"
      onClick={handleAddToCart}
      className="flex-1 rounded-2xl bg-black px-6 py-4 text-center font-bold text-white transition hover:bg-orange-600"
    >
      {added ? "✓ تمت الإضافة للسلة" : "🛒 أضف للسلة"}
    </button>
  );
}

