"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface WhatsAppInstallBannerProps {
  forceOpen?: boolean;
  autoOpen?: boolean;
  onClose?: () => void;
}

export default function WhatsAppInstallBanner({
  forceOpen,
  autoOpen = true,
  onClose,
}: WhatsAppInstallBannerProps) {
  const [visible, setVisible] = useState(false);
  const [canNativeInstall, setCanNativeInstall] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showManualSteps, setShowManualSteps] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (window.navigator as any)?.standalone === true;
    setIsStandalone(standalone);

    const ua = window.navigator.userAgent || "";
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIos(ios);

    if (window.__mbDeferredInstallPrompt) {
      setCanNativeInstall(true);
    }

    const onReady = () => setCanNativeInstall(true);
    const onInstalled = () => {
      setCanNativeInstall(false);
      setInstallSuccess(true);
    };

    window.addEventListener("mb-pwa-prompt-ready", onReady);
    window.addEventListener("mb-pwa-installed", onInstalled);

    // Show automatic popup once per tab session when landing on /whatsapp in a regular browser
    if (!standalone && autoOpen) {
      const dismissed = sessionStorage.getItem("mb_wa_pwa_popup_seen");
      if (!dismissed) {
        setVisible(true);
      }
    }

    return () => {
      window.removeEventListener("mb-pwa-prompt-ready", onReady);
      window.removeEventListener("mb-pwa-installed", onInstalled);
    };
  }, [autoOpen]);

  useEffect(() => {
    if (forceOpen) {
      setVisible(true);
      setShowManualSteps(false);
    }
  }, [forceOpen]);

  function handleDismiss() {
    sessionStorage.setItem("mb_wa_pwa_popup_seen", "1");
    setVisible(false);
    onClose?.();
  }

  async function handleInstallClick() {
    const promptEvent = window.__mbDeferredInstallPrompt;
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice?.outcome === "accepted") {
          window.__mbDeferredInstallPrompt = null;
          setCanNativeInstall(false);
          setInstallSuccess(true);
        }
      } catch {
        setShowManualSteps(true);
      }
    } else {
      setShowManualSteps(true);
    }
  }

  if (!visible || isStandalone) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl border border-emerald-950/10">
        <div className="bg-gradient-to-l from-emerald-600 to-teal-700 px-6 py-5 text-white flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white p-2.5 shadow-md">
            <img
              src="/pwa-icon-192.png"
              alt="Modern Building"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <span className="inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-black tracking-wide">
              تطبيق سطح المكتب والجوال (PWA)
            </span>
            <h2 className="mt-1 text-xl font-black">تثبيت تطبيق Modern Building</h2>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm font-semibold leading-6 text-gray-700">
            ثبّت التطبيق على جهازك (الكمبيوتر أو الأندرويد / الآيفون) لتتمكن من متابعة جميع الرسائل الواردة والصادرة مباشرة:
          </p>

          <ul className="space-y-2 rounded-2xl bg-[#f8fafc] p-4 text-xs font-bold text-gray-700 border border-gray-100">
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              عرض فوري لرسائل العملاء الواردة والصادرة مع الصور والفيديو والـ PDF والصوتيات.
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              الرد الحر داخل نافذة الـ 24 ساعة وتسجيل الرسائل الصوتية أو إرسال القوالب الرسمية.
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              متابعة حالات الرسالة لحظياً (تم الإرسال ✓ / تم التسليم ✓✓ / تمت القراءة ✓✓).
            </li>
          </ul>

          {installSuccess && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-800">
              تم إرسال طلب التثبيت بنجاح! ستجد أيقونة Modern Building على سطح المكتب أو الشاشة الرئيسية الآن.
            </div>
          )}

          {showManualSteps && !installSuccess && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-bold text-amber-900 leading-5">
              {isIos ? (
                <>
                  على الآيفون (Safari): اضغط على زر <b>المشاركة (Share ⬆)</b> بالأسفل ثم اختر{" "}
                  <b>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</b>.
                </>
              ) : (
                <>
                  من متصفح <b>Chrome / Edge</b>: اضغط على قائمة النقاط الثلاث <b>(⋮)</b> بالأعلى أو أيقونة التثبيت في شريط العنوان ثم اختر{" "}
                  <b>تثبيت تطبيق Modern Building (Install app)</b>.
                </>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleInstallClick}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-black text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-[0.99]"
            >
              {canNativeInstall ? "تحميل وتثبيت التطبيق الآن" : "تثبيت التطبيق على الجهاز"}
            </button>

            <Link
              href="/whatsapp/inbox"
              onClick={handleDismiss}
              className="w-full rounded-xl border border-emerald-600/30 bg-emerald-50 py-2.5 text-center text-xs font-black text-emerald-800 transition hover:bg-emerald-100"
            >
              فتح صندوق الوارد (الدردشة) الآن
            </Link>

            <button
              type="button"
              onClick={handleDismiss}
              className="w-full rounded-xl py-2 text-xs font-bold text-gray-500 hover:bg-gray-100"
            >
              متابعة في صفحة الفواتير لاحقاً
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
