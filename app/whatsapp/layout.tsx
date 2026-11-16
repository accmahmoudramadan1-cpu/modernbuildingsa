import type { Metadata, Viewport } from "next";
import WhatsAppPwaRegistrar from "@/components/WhatsAppPwaRegistrar";

export const metadata: Metadata = {
  title: "Modern Building | بوابة الواتساب وصندوق الوارد",
  description: "بوابة واتساب وصندوق الوارد لإدارة رسائل العملاء وفواتير أونكس برو - البناء الحديث",
  manifest: "/whatsapp-manifest.webmanifest",
  icons: {
    icon: [
      { url: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/pwa-apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Modern Building",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function WhatsAppSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <WhatsAppPwaRegistrar />
      {children}
    </>
  );
}
