"use client";
import { createContext, useContext, useState, useMemo } from "react";

const Ctx = createContext<any>(null);

export function CartProvider({ children }: { children: any }) {
  const [cart, setCart] = useState<any[]>([]);

  const addToCart = (p: any) => {
    setCart((c: any[]) => {
      const found = c.find((x) => x.id === p.id || x.product?.id === p.id);
      if (found) {
        return c.map((x) =>
          x.id === p.id || x.product?.id === p.id
           ? {...x, quantity: (x.quantity || 1) + 1 }
            : x
        );
      }
      if (p.product) return [...c, p];
      return [...c, { product: p, id: p.id, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((c) => c.filter((x: any) => x.id!== id && x.product?.id!== id));
  };

  const clearCart = () => setCart([]);
  const items = cart;

  const total = useMemo(() => {
    return cart.reduce((sum: number, item: any) => {
      const price = item.product?.price?? item.price?? 0;
      const qty = item.quantity?? 1;
      if (item.product && item.product.show_price === false) return sum;
      return sum + price * qty;
    }, 0);
  }, [cart]);

  return (
    <Ctx.Provider value={{ cart, items, addToCart, removeFromCart, clearCart, total }}>
      {children}
    </Ctx.Provider>
  );
}

export const useCart = () => {
  const c = useContext(Ctx);
  if (!c) return { cart: [], items: [], addToCart: () => {}, removeFromCart: () => {}, clearCart: () => {}, total: 0 };
  return c;
};