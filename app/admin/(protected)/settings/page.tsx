"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-client";

type Settings = {
  company_name: string;
  phone_1: string;
  phone_2: string;
  landline: string;
  whatsapp: string;
  address: string;
  description: string;
  maps_url: string;
  whatsapp_business: string;
  instagram_url: string;
};

const defaultSettings: Settings = {
  company_name: "",
  phone_1: "",
  phone_2: "",
  landline: "",
  whatsapp: "",
  address: "",
  description: "",
  maps_url: "",
  whatsapp_business: "",
  instagram_url: "",
};

export default function SettingsPage() {
  const supabase = createClient();

  const [settings, setSettings] =
    useState<Settings>(defaultSettings);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("site_settings")
      .select(
        "company_name, phone_1, phone_2, landline, whatsapp, address, description, maps_url, whatsapp_business, instagram_url"
      )
      .eq("id", 1)
      .single();

    if (error) {
      console.error(error);
      setMessage("حدث خطأ أثناء تحميل الإعدادات.");
      setLoading(false);
      return;
    }

    setSettings({
      company_name: data.company_name || "",
      phone_1: data.phone_1 || "",
      phone_2: data.phone_2 || "",
      landline: data.landline || "",
      whatsapp: data.whatsapp || "",
      address: data.address || "",
      description: data.description || "",
      maps_url: data.maps_url || "",
      whatsapp_business: data.whatsapp_business || "",
      instagram_url: data.instagram_url || "",
    });

    setLoading(false);
  }

  function updateField(
    field: keyof Settings,
    value: string
  ) {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("site_settings")
      .update({
        company_name: settings.company_name.trim(),
        phone_1: settings.phone_1.trim(),
        phone_2: settings.phone_2.trim(),
        landline: settings.landline.trim(),
        whatsapp: settings.whatsapp.trim(),
        address: settings.address.trim(),
        description: settings.description.trim(),
        maps_url: settings.maps_url.trim(),
        whatsapp_business: settings.whatsapp_business.trim(),
        instagram_url: settings.instagram_url.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    if (error) {
      console.error(error);
      setMessage("حدث خطأ أثناء حفظ الإعدادات.");
      setSaving(false);
      return;
    }

    setMessage("تم حفظ الإعدادات بنجاح ✓");
    setSaving(false);
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-[#f3f4f6] px-6 py-10 text-[#171717]"
      >
        <div className="mx-auto max-w-4xl">
          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <p className="font-bold text-gray-700">
              جاري تحميل الإعدادات...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f3f4f6] px-6 py-10 text-[#171717]"
    >
      <div className="mx-auto max-w-4xl">

        {/* العنوان */}
        <div className="mb-8">
          <div className="mb-3 inline-flex rounded-full bg-orange-100 px-4 py-2 text-sm font-black text-orange-700">
            إعدادات الشركة
          </div>

          <h1 className="text-3xl font-black text-[#171717]">
            إعدادات الموقع
          </h1>

          <p className="mt-2 text-base font-medium text-gray-600">
            تعديل بيانات الشركة ووسائل التواصل من مكان واحد.
          </p>
        </div>

        {/* الكارت */}
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">

          <div className="grid gap-6 md:grid-cols-2">

            {/* اسم الشركة */}
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-black text-[#171717]">
                اسم الشركة
              </label>

              <input
                type="text"
                value={settings.company_name}
                onChange={(e) =>
                  updateField(
                    "company_name",
                    e.target.value
                  )
                }
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-4 font-bold text-[#171717] outline-none transition placeholder:text-gray-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
              />
            </div>

            {/* الهاتف الأول */}
            <div>
              <label className="mb-2 block text-sm font-black text-[#171717]">
                الهاتف الأول
              </label>

              <input
                type="tel"
                value={settings.phone_1}
                onChange={(e) =>
                  updateField(
                    "phone_1",
                    e.target.value
                  )
                }
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-4 font-bold text-[#171717] outline-none transition placeholder:text-gray-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
              />
            </div>

            {/* الهاتف الثاني */}
            <div>
              <label className="mb-2 block text-sm font-black text-[#171717]">
                الهاتف الثاني
              </label>

              <input
                type="tel"
                value={settings.phone_2}
                onChange={(e) =>
                  updateField(
                    "phone_2",
                    e.target.value
                  )
                }
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-4 font-bold text-[#171717] outline-none transition placeholder:text-gray-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
              />
            </div>

            {/* الهاتف الأرضي */}
            <div>
              <label className="mb-2 block text-sm font-black text-[#171717]">
                الهاتف الأرضي
              </label>

              <input
                type="tel"
                value={settings.landline}
                onChange={(e) =>
                  updateField(
                    "landline",
                    e.target.value
                  )
                }
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-4 font-bold text-[#171717] outline-none transition placeholder:text-gray-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
              />
            </div>

            {/* الواتساب */}
            <div>
              <label className="mb-2 block text-sm font-black text-[#171717]">
                رقم الواتساب
              </label>

              <input
                type="tel"
                value={settings.whatsapp}
                onChange={(e) =>
                  updateField(
                    "whatsapp",
                    e.target.value
                  )
                }
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-4 font-bold text-[#171717] outline-none transition placeholder:text-gray-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
              />
            </div>

            {/* العنوان */}
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-black text-[#171717]">
                العنوان
              </label>

              <input
                type="text"
                value={settings.address}
                onChange={(e) =>
                  updateField(
                    "address",
                    e.target.value
                  )
                }
                placeholder="اكتب عنوان الشركة"
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-4 font-bold text-[#171717] outline-none transition placeholder:text-gray-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
              />
            </div>

            {/* Google Maps */}
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-black text-[#171717]">
                رابط Google Maps
              </label>
              <input
                type="url"
                value={settings.maps_url}
                onChange={(e) => updateField("maps_url", e.target.value)}
                placeholder="ضع رابط موقع الشركة من Google Maps"
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-4 font-bold text-[#171717] outline-none transition placeholder:text-gray-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
              />
            </div>

            {/* WhatsApp Business */}
            <div>
              <label className="mb-2 block text-sm font-black text-[#171717]">
                رابط WhatsApp Business
              </label>
              <input
                type="url"
                value={settings.whatsapp_business}
                onChange={(e) =>
                  updateField("whatsapp_business", e.target.value)
                }
                placeholder="https://wa.me/..."
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-4 font-bold text-[#171717] outline-none transition placeholder:text-gray-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
              />
            </div>

            {/* Instagram */}
            <div>
              <label className="mb-2 block text-sm font-black text-[#171717]">
                رابط Instagram
              </label>
              <input
                type="url"
                value={settings.instagram_url}
                onChange={(e) =>
                  updateField("instagram_url", e.target.value)
                }
                placeholder="https://www.instagram.com/..."
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-4 font-bold text-[#171717] outline-none transition placeholder:text-gray-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
              />
            </div>

            {/* وصف الشركة */}
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-black text-[#171717]">
                وصف الشركة
              </label>

              <textarea
                value={settings.description}
                onChange={(e) =>
                  updateField(
                    "description",
                    e.target.value
                  )
                }
                rows={4}
                placeholder="اكتب وصفًا مختصرًا عن الشركة"
                className="w-full resize-none rounded-2xl border border-gray-300 bg-white px-4 py-4 font-bold leading-7 text-[#171717] outline-none transition placeholder:text-gray-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
              />
            </div>
          </div>

          {/* رسالة */}
          {message && (
            <div
              className={`mt-6 rounded-2xl border p-4 text-center text-sm font-black ${
                message.includes("بنجاح")
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {message}
            </div>
          )}

          {/* زر الحفظ */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-6 w-full rounded-2xl bg-orange-600 px-6 py-4 font-black text-white shadow-sm transition hover:bg-orange-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? "جاري حفظ الإعدادات..."
              : "حفظ الإعدادات"}
          </button>
        </div>
      </div>
    </main>
  );
}

