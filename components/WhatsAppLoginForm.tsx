"use client";

import { useState } from "react";

interface WhatsAppLoginFormProps {
  title?: string;
  subtitle?: string;
  onSuccess: (username: string) => void;
}

export default function WhatsAppLoginForm({
  title = "بوابة واتساب البناء الحديث",
  subtitle = "سجّل الدخول للوصول إلى الفواتير وصندوق الرسائل",
  onSuccess,
}: WhatsAppLoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/whatsapp/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "بيانات الدخول غير صحيحة.");
        setLoading(false);
        return;
      }

      onSuccess(data.username || username);
    } catch {
      setError("تعذر الاتصال بالسيرفر أثناء تسجيل الدخول.");
      setLoading(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f4f7f6] flex items-center justify-center px-4 py-10"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl border border-emerald-950/10">
        <div className="text-center mb-7">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#f8fafc] border border-gray-200 p-3 shadow-xs">
            <img
              src="/pwa-icon-192.png"
              alt="Modern Building"
              className="h-full w-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-black text-gray-900">{title}</h1>
          <p className="mt-1.5 text-sm font-medium text-gray-500">{subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-black text-gray-700 mb-1.5">
              اسم المستخدم (Username)
            </label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="modernbuilding"
              required
              dir="ltr"
              className="w-full rounded-xl border border-gray-200 bg-[#f9fafb] px-4 py-3 text-sm font-bold text-gray-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-gray-700 mb-1.5">
              كلمة المرور (Password)
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                dir="ltr"
                className="w-full rounded-xl border border-gray-200 bg-[#f9fafb] px-4 py-3 text-sm font-bold text-gray-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-xs font-bold text-gray-500 hover:text-gray-800"
              >
                {showPass ? "إخفاء" : "إظهار"}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700 leading-5">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-black text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? "جاري التحقق والدخول..." : "تسجيل الدخول"}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] font-semibold text-gray-400">
          محمي بتشفير الجلسة وحماية الحد الأقصى للمحاولات (Rate Limiting)
        </p>
      </div>
    </main>
  );
}
