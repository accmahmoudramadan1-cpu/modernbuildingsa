"use client";

import { useState } from "react";
import NextImage from "next/image";
import { CategoryItem } from "@/lib/categories-data";

export default function CategoryGallery({
  categoryName,
  items,
  whatsappNumber,
}: {
  categoryName: string;
  items: CategoryItem[];
  whatsappNumber: string;
}) {
  const [selectedImage, setSelectedImage] = useState<CategoryItem | null>(null);
  const [filterQuery, setFilterQuery] = useState("");

  const filteredItems = items.filter((item) =>
    item.title.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const getWhatsappUrl = (itemTitle: string) => {
    const text = encodeURIComponent(
      `مرحباً مؤسسة محل البناء الحديث، أود الاستفسار عن المنتج التالي المعروض في قسم (${categoryName}):\n${itemTitle}`
    );
    const cleanNum = whatsappNumber.replace(/\D/g, "");
    return `https://wa.me/${cleanNum}?text=${text}`;
  };

  return (
    <div className="w-full">
      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl w-full flex flex-col items-center bg-[#0e1e2d] rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="w-full flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/10 bg-black/40 text-white">
              <span className="font-bold text-sm sm:text-base">
                {selectedImage.title} — {categoryName}
              </span>
              <button
                onClick={() => setSelectedImage(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white text-lg transition"
                title="إغلاق"
              >
                ✕
              </button>
            </div>

            {/* Modal Image */}
            <div className="relative w-full h-[55vh] sm:h-[65vh] bg-black/50 flex items-center justify-center">
              <img
                src={selectedImage.src}
                alt={selectedImage.title}
                className="max-h-full max-w-full object-contain"
              />
            </div>

            {/* Modal Footer / WhatsApp Inquiry */}
            <div className="w-full p-4 bg-black/40 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs sm:text-sm text-gray-300">
                متاح للعرض والتوريد المباشر من معرضنا بنجران
              </span>
              <a
                href={getWhatsappUrl(selectedImage.title)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#1ebe5b] text-white px-6 py-2.5 text-xs sm:text-sm font-bold shadow-md transition"
              >
                <span>💬 استفسار عن هذا المنتج عبر الواتساب</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Items Count Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-6 border-b border-gray-200">
        <div>
          <span className="text-xs sm:text-sm font-bold text-gray-500">
            إجمالي المعروضات في هذا القسم:
          </span>
          <span className="mx-2 inline-flex items-center rounded-full bg-[#123B5D]/10 px-3 py-1 text-xs sm:text-sm font-black text-[#123B5D]">
            {items.length} منتج وصورة
          </span>
        </div>

        <div className="text-xs text-gray-500 flex items-center gap-1.5">
          <span>ℹ️</span>
          <span>اضغط على أي صورة لتكبيرها والاستفسار عنها مباشرة</span>
        </div>
      </div>

      {/* Gallery Grid */}
      {filteredItems.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {filteredItems.map((item, index) => (
            <div
              key={item.id}
              className="group flex flex-col justify-between overflow-hidden rounded-2xl bg-white border border-gray-200 shadow-xs hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              {/* Image Container with Zoom Trigger */}
              <div
                className="relative h-60 sm:h-64 overflow-hidden bg-gray-100 cursor-pointer"
                onClick={() => setSelectedImage(item)}
              >
                <img
                  src={item.src}
                  alt={item.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white">
                  <span className="rounded-full bg-black/60 px-3.5 py-1.5 text-xs font-bold backdrop-blur-sm flex items-center gap-1.5">
                    <span>🔍</span>
                    <span>تكبير الصورة</span>
                  </span>
                </div>

                {/* Category & Index Pill */}
                <span className="absolute top-3 right-3 rounded-lg bg-black/60 text-white px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm">
                  #{index + 1}
                </span>
              </div>

              {/* Card Footer */}
              <div className="p-4 flex flex-col flex-1 justify-between gap-3">
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-gray-900 line-clamp-2">
                    {item.title}
                  </h4>
                  <p className="mt-1 text-xs text-gray-500">
                    متوفر بالمعرض — مؤسسة محل البناء الحديث
                  </p>
                </div>

                {/* Direct WhatsApp Action */}
                <a
                  href={getWhatsappUrl(item.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366] text-[#128C7E] hover:text-white py-2.5 px-3 text-xs font-bold transition duration-200"
                >
                  <span>💬 استفسار عبر الواتساب</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-12 rounded-2xl bg-white p-12 text-center text-gray-500 border border-gray-200">
          لا توجد صور متطابقة حالياً.
        </div>
      )}
    </div>
  );
}
