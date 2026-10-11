"use client";
import Link from "next/link"; import {useCart} from "./CartProvider"; export default function CartButton(){ const {cart}=useCart(); return <Link href="/cart" className="border px-3 py-1 rounded">Cart ({cart.length}) </Link>; }
