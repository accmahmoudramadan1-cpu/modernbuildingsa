"use client";

import { useState } from "react";
import NextImage from "next/image";

type GalleryImage = {
  id: string;
  image_url: string;
};

export default function ProductGallery({
  images,
  productName,
}: {
  images: GalleryImage[];
  productName: string;
}) {
  const [selectedImage, setSelectedImage] = useState(0);

  if (images.length === 0) {
    return (
      <div className="relative aspect-square overflow-hidden rounded-[32px] bg-gray-200 shadow-xl">
        <div className="flex h-full items-center justify-center text-7xl">
          🧱
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* الصورة الرئيسية */}
      <div className="relative aspect-square overflow-hidden rounded-[32px] bg-gray-100 shadow-xl">
        <NextImage
          src={images[selectedImage].image_url}
          alt={productName}
          fill
          priority
          className="object-contain p-4"
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
      </div>

      {/* الصور المصغرة */}
      {images.length > 1 && (
        <div className="mt-5 grid grid-cols-4 gap-3 sm:grid-cols-5">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setSelectedImage(index)}
              className={`relative aspect-square overflow-hidden rounded-2xl border-2 bg-gray-100 transition ${
                selectedImage === index
                  ? "border-orange-600 ring-2 ring-orange-600/20"
                  : "border-black/10 hover:border-orange-400"
              }`}
            >
              <NextImage
                src={image.image_url}
                alt={`${productName} - صورة ${index + 1}`}
                fill
                className="object-cover"
                sizes="120px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}