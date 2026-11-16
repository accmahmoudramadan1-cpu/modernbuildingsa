import type { Metadata, Viewport } from "next";
import { Tajawal, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800", "900"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "مؤسسة محل البناء الحديث للتجارة | Modern Building",
  description: "لمواد البناء والتشطيب، الأدوات الصحية، السباكة، والإنارة والكهرباء",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${tajawal.variable} ${geistMono.variable} h-full antialiased overflow-x-hidden`}
    >
      <body className={`${tajawal.className} min-h-full flex flex-col overflow-x-hidden w-full max-w-full`}>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
