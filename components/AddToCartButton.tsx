"use client";
import { useCart } from "./CartProvider";
export default function AddToCartButton({product}:{product:any}){
  const {addToCart}=useCart();
  return <button onClick={()=>addToCart(product)} className="bg-black text-white px-4 py-2 rounded">Add to Cart</button>;
}