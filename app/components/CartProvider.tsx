"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

export type CartProduct = {
  id: string;
  name: string;
  price: number | null;
  currency: string | null;
  show_price: boolean;
  image_url: string | null;
};

export type CartItem = {
  product: CartProduct;
  quantity: number;
};

type CartContextType = {
  items: CartItem[];
  cart: CartItem[];
  addToCart: (product: CartProduct | any) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  total: number;
};

const CartContext = createContext<CartContextType | undefined>(
  undefined
);

const CART_KEY = "modern-building-cart";

export function CartProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_KEY);

      if (savedCart) {
        setItems(JSON.parse(savedCart));
      }
    } catch (error) {
      console.error("خطأ في تحميل السلة:", error);
    }

    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;

    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch (error) {
      console.error("خطأ في حفظ السلة:", error);
    }
  }, [items, ready]);

  function addToCart(productInput: any) {
    const product: CartProduct = productInput.product || productInput;

    setItems((currentItems) => {
      const existingItem = currentItems.find(
        (item) => item.product.id === product.id
      );

      if (existingItem) {
        return currentItems.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + (productInput.quantity || 1),
              }
            : item
        );
      }

      return [
        ...currentItems,
        {
          product,
          quantity: productInput.quantity || 1,
        },
      ];
    });
  }

  function removeFromCart(productId: string) {
    setItems((currentItems) =>
      currentItems.filter(
        (item) => item.product.id !== productId
      )
    );
  }

  function updateQuantity(
    productId: string,
    quantity: number
  ) {
    if (quantity < 1) {
      removeFromCart(productId);
      return;
    }

    setItems((currentItems) =>
      currentItems.map((item) =>
        item.product.id === productId
          ? {
              ...item,
              quantity,
            }
          : item
      )
    );
  }

  function clearCart() {
    setItems([]);
  }

  const cartCount = items.reduce(
    (acc, item) => acc + item.quantity,
    0
  );

  const total = items.reduce((acc, item) => {
    if (!item.product.show_price || item.product.price === null) {
      return acc;
    }
    return acc + item.product.price * item.quantity;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        cart: items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartCount,
        total,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    return {
      items: [],
      cart: [],
      addToCart: () => {},
      removeFromCart: () => {},
      updateQuantity: () => {},
      clearCart: () => {},
      cartCount: 0,
      total: 0,
    };
  }

  return context;
}