"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-client";

type Category = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  show_price: boolean;
  image_url: string | null;
  available: boolean;
  created_at: string;
};

export default function ProductsPage() {
  const supabase = createClient();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("");
  const [showPrice, setShowPrice] = useState(false);
  const [available, setAvailable] = useState(true);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
const [additionalImageFiles, setAdditionalImageFiles] = useState<File[]>(
  []
);

const [additionalPreviewUrls, setAdditionalPreviewUrls] = useState<string[]>(
  []
);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);

    const [categoriesResult, productsResult] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name")
        .order("name"),

      supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    if (categoriesResult.error || productsResult.error) {
      setMessage("حدث خطأ أثناء تحميل البيانات");
      setLoading(false);
      return;
    }

    setCategories(categoriesResult.data || []);
    setProducts(productsResult.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleImageChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("من فضلك اختر ملف صورة فقط");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("حجم الصورة يجب ألا يتجاوز 5 ميجابايت");
      return;
    }

    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setMessage("");
  }
function handleAdditionalImagesChange(
  e: React.ChangeEvent<HTMLInputElement>
) {
  const files = Array.from(e.target.files || []);

  const validFiles = files.filter(
    (file) =>
      file.type.startsWith("image/") &&
      file.size <= 5 * 1024 * 1024
  );

  if (validFiles.length !== files.length) {
    setMessage("بعض الصور غير صالحة أو أكبر من 5 ميجابايت");
  } else {
    setMessage("");
  }

  setAdditionalImageFiles(validFiles);
  setAdditionalPreviewUrls(
    validFiles.map((file) => URL.createObjectURL(file))
  );
}
  async function addProduct(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setMessage("اكتب اسم المنتج أولًا");
      return;
    }

    if (!categoryId) {
      setMessage("اختر قسم المنتج");
      return;
    }

    setSaving(true);
    setMessage("");

    let uploadedImagePath: string | null = null;
    let imageUrl: string | null = null;

    try {
      if (imageFile) {
        const extension =
          imageFile.name.split(".").pop()?.toLowerCase() || "jpg";

        const fileName = `${crypto.randomUUID()}.${extension}`;
        const filePath = `products/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(filePath, imageFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          setMessage(
            `حدث خطأ أثناء رفع الصورة: ${uploadError.message}`
          );
          setSaving(false);
          return;
        }

        uploadedImagePath = filePath;

        const { data: publicUrlData } = supabase.storage
          .from("product-images")
          .getPublicUrl(filePath);

        imageUrl = publicUrlData.publicUrl;
      }

      const parsedPrice =
        price.trim() === "" ? null : Number(price);

      if (
        parsedPrice !== null &&
        (!Number.isFinite(parsedPrice) || parsedPrice < 0)
      ) {
        if (uploadedImagePath) {
          await supabase.storage
            .from("product-images")
            .remove([uploadedImagePath]);
        }

        setMessage("اكتب سعرًا صحيحًا");
        setSaving(false);
        return;
      }

     const { data: insertedProduct, error: insertError } = await supabase
  .from("products")
  .insert({
    name: name.trim(),
    category_id: categoryId,
    description: description.trim() || null,
    price: parsedPrice,
    currency: currency.trim() || null,
    show_price: showPrice,
    image_url: imageUrl,
    available,
  })
  .select("id")
  .single();

      if (insertError) {
        if (uploadedImagePath) {
          await supabase.storage
            .from("product-images")
            .remove([uploadedImagePath]);
        }

        setMessage(
          `حدث خطأ أثناء إضافة المنتج: ${insertError.message}`
        );
        setSaving(false);
        return;
      }
  if (insertedProduct && additionalImageFiles.length > 0) {
    for (const file of additionalImageFiles) {
      const extension =
        file.name.split(".").pop()?.toLowerCase() || "jpg";

      const fileName = `${crypto.randomUUID()}.${extension}`;
      const filePath = `products/additional/${fileName}`;

      const { error: additionalUploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (additionalUploadError) {
        console.error(
          "خطأ في رفع صورة إضافية:",
          additionalUploadError.message
        );
        continue;
      }

      const {
        data: { publicUrl },
      } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      const { error: imageInsertError } = await supabase
        .from("product_images")
        .insert({
          product_id: insertedProduct.id,
          image_url: publicUrl,
        });

      if (imageInsertError) {
        console.error(
          "خطأ في حفظ الصورة الإضافية:",
          imageInsertError.message
        );

        await supabase.storage
          .from("product-images")
          .remove([filePath]);
      }
    }
  }
      setName("");
      setCategoryId("");
      setDescription("");
      setPrice("");
      setCurrency("");
      setShowPrice(false);
      setAvailable(true);
      setImageFile(null);
      setPreviewUrl("");
setAdditionalImageFiles([]);
setAdditionalPreviewUrls([]);
      setMessage("تم إضافة المنتج بنجاح ✅");

      await loadData();
    } catch {
      setMessage("حدث خطأ غير متوقع");
    }

    setSaving(false);
  }

  async function deleteProduct(product: Product) {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف المنتج "${product.name}"؟`
    );

    if (!confirmed) return;

    setMessage("");

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", product.id);

    if (error) {
      setMessage(
        `حدث خطأ أثناء حذف المنتج: ${error.message}`
      );
      return;
    }

    setMessage("تم حذف المنتج بنجاح ✅");

    await loadData();
  }

  function getCategoryName(categoryId: string | null) {
    if (!categoryId) return "بدون قسم";

    return (
      categories.find(
        (category) => category.id === categoryId
      )?.name || "قسم غير معروف"
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#111111] text-white"
    >
      <header className="border-b border-white/10 bg-[#1b1b1b]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold">
              إدارة المنتجات
            </h1>

            <p className="mt-1 text-sm text-gray-400">
              إضافة وإدارة منتجات متجر البناء الحديث
            </p>
          </div>

          <a
            href="/admin"
            className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold hover:bg-white/5"
          >
            العودة للوحة التحكم
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[400px_1fr]">

          {/* إضافة منتج */}
          <div className="h-fit rounded-2xl border border-white/10 bg-[#1b1b1b] p-6">
            <h2 className="text-xl font-bold">
              إضافة منتج جديد
            </h2>

            <form
              onSubmit={addProduct}
              className="mt-6 space-y-5"
            >
              {/* الاسم */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  اسم المنتج
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: أسمنت مسلح"
                  className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-white outline-none focus:border-orange-500"
                />
              </div>

              {/* القسم */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  القسم
                </label>

                <select
                  value={categoryId}
                  onChange={(e) =>
                    setCategoryId(e.target.value)
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-white outline-none focus:border-orange-500"
                >
                  <option value="">
                    اختر القسم
                  </option>

                  {categories.map((category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* الوصف */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  وصف المنتج
                </label>

                <textarea
                  value={description}
                  onChange={(e) =>
                    setDescription(e.target.value)
                  }
                  placeholder="وصف المنتج ومواصفاته"
                  rows={4}
                  className="w-full resize-none rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-white outline-none focus:border-orange-500"
                />
              </div>

              {/* السعر */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  السعر
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="اتركه فارغًا إذا كان السعر عند الطلب"
                  className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-white outline-none focus:border-orange-500"
                />
              </div>

              {/* العملة */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  العملة
                </label>

                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="EGP / USD / EUR..."
                  className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-white outline-none focus:border-orange-500"
                />
              </div>

              {/* إظهار السعر */}
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-[#111111] p-4">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) =>
                    setShowPrice(e.target.checked)
                  }
                  className="h-5 w-5 accent-orange-500"
                />

                <div>
                  <p className="font-semibold">
                    إظهار السعر للزوار
                  </p>

                  <p className="text-xs text-gray-500">
                    إذا لم تفعلها سيظهر للزائر: تواصل معنا لمعرفة السعر
                  </p>
                </div>
              </label>

              {/* متاح */}
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-[#111111] p-4">
                <input
                  type="checkbox"
                  checked={available}
                  onChange={(e) =>
                    setAvailable(e.target.checked)
                  }
                  className="h-5 w-5 accent-orange-500"
                />

                <div>
                  <p className="font-semibold">
                    المنتج متاح
                  </p>

                  <p className="text-xs text-gray-500">
                    ألغِ الاختيار إذا كان المنتج غير متوفر
                  </p>
                </div>
              </label>

              {/* الصورة */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  الصورة الرئيسية
                </label>

                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-[#111111] px-4 py-6 text-center transition hover:border-orange-500">
                  <span className="text-3xl">
                    📷
                  </span>

                  <span className="mt-2 font-semibold">
                    اختيار صورة من الجهاز
                  </span>

                  <span className="mt-1 text-xs text-gray-500">
                    JPG / PNG / WEBP — بحد أقصى 5MB
                  </span>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
<div className="mt-4">
  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-5 text-center transition hover:border-orange-500/50">
    <span className="text-3xl">🖼️</span>

    <span className="mt-2 font-semibold">
      اختيار صور إضافية للمنتج
    </span>

    <span className="mt-1 text-xs text-gray-500">
      يمكنك اختيار أكثر من صورة — JPG / PNG / WEBP — 5MB كحد أقصى للصورة
    </span>

    <input
      type="file"
      accept="image/*"
      multiple
      onChange={handleAdditionalImagesChange}
      className="hidden"
    />
  </label>

  {additionalImageFiles.length > 0 && (
    <div className="mt-3">
      <p className="mb-2 text-xs text-gray-400">
        الصور المختارة: {additionalImageFiles.length}
      </p>

      <div className="grid grid-cols-3 gap-3">
        {additionalPreviewUrls.map((url, index) => (
          <div
            key={url}
            className="overflow-hidden rounded-xl border border-white/10"
          >
            <img
              src={url}
              alt={`صورة إضافية ${index + 1}`}
              className="h-24 w-full object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  )}
</div>
                {imageFile && (
                  <p className="mt-2 truncate text-xs text-gray-400">
                    {imageFile.name}
                  </p>
                )}

                {previewUrl && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
                    <img
                      src={previewUrl}
                      alt="معاينة المنتج"
                      className="h-48 w-full object-cover"
                    />
                  </div>
                )}
              </div>

              {message && (
                <div className="rounded-xl border border-white/10 bg-[#111111] p-3 text-sm text-orange-400">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-orange-500 py-3 font-bold transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "جاري الحفظ..."
                  : "إضافة المنتج"}
              </button>
            </form>
          </div>

          {/* المنتجات الموجودة */}
          <div>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                المنتجات الموجودة
              </h2>

              <span className="rounded-full bg-white/5 px-4 py-2 text-sm text-gray-400">
                {products.length} منتج
              </span>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-[#1b1b1b] p-8 text-center text-gray-400">
                جاري تحميل المنتجات...
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#1b1b1b] p-10 text-center">
                <p className="text-lg font-semibold">
                  لا توجد منتجات حتى الآن
                </p>

                <p className="mt-2 text-sm text-gray-500">
                  أضف أول منتج من النموذج الموجود بجانبك.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-[#1b1b1b]"
                  >
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-48 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-48 items-center justify-center bg-[#151515] text-gray-600">
                        لا توجد صورة
                      </div>
                    )}

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-lg font-bold">
                          {product.name}
                        </h3>

                        <span
                          className={`rounded-full px-3 py-1 text-xs ${
                            product.available
                              ? "bg-green-500/10 text-green-400"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {product.available
                            ? "متاح"
                            : "غير متاح"}
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-orange-400">
                        {getCategoryName(product.category_id)}
                      </p>

                      {product.description && (
                        <p className="mt-3 text-sm leading-6 text-gray-400">
                          {product.description}
                        </p>
                      )}

                      <div className="mt-4 rounded-xl bg-[#111111] p-3">
                        {product.show_price &&
                        product.price !== null ? (
                          <p className="font-bold text-orange-400">
                            {product.price}{" "}
                            {product.currency || ""}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-400">
                            تواصل معنا لمعرفة السعر
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          deleteProduct(product)
                        }
                        className="mt-5 w-full rounded-xl border border-red-500/20 bg-red-500/10 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/20"
                      >
                        🗑️ حذف المنتج
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

