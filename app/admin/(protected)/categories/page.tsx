"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-client";

type Category = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
};

export default function CategoriesPage() {
  const supabase = createClient();

  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
const [editingCategory, setEditingCategory] =
  useState<Category | null>(null);

const [editName, setEditName] = useState("");
const [editDescription, setEditDescription] = useState("");
const [editImageFile, setEditImageFile] = useState<File | null>(null);
const [editPreviewUrl, setEditPreviewUrl] = useState("");
  async function loadCategories() {
    setLoading(true);

    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("حدث خطأ أثناء تحميل الأقسام");
      setLoading(false);
      return;
    }

    setCategories(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadCategories();
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

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setMessage("اكتب اسم القسم أولًا");
      return;
    }

    setSaving(true);
    setMessage("");

    let uploadedImagePath: string | null = null;
    let imageUrl: string | null = null;

    try {
      // رفع الصورة إذا تم اختيار صورة
      if (imageFile) {
        const fileExtension =
          imageFile.name.split(".").pop()?.toLowerCase() || "jpg";

        const fileName = `${crypto.randomUUID()}.${fileExtension}`;
        const filePath = `categories/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(filePath, imageFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          setMessage("حدث خطأ أثناء رفع الصورة");
          setSaving(false);
          return;
        }

        uploadedImagePath = filePath;

        const { data: publicUrlData } = supabase.storage
          .from("product-images")
          .getPublicUrl(filePath);

        imageUrl = publicUrlData.publicUrl;
      }

      // إضافة القسم إلى قاعدة البيانات
      const { error: insertError } = await supabase
        .from("categories")
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          image_url: imageUrl,
        });

      if (insertError) {
        // لو حصل خطأ في قاعدة البيانات، نحذف الصورة التي رفعناها
        if (uploadedImagePath) {
          await supabase.storage
            .from("product-images")
            .remove([uploadedImagePath]);
        }

        setMessage("حدث خطأ أثناء إضافة القسم");
        setSaving(false);
        return;
      }

      setName("");
      setDescription("");
      setImageFile(null);
      setPreviewUrl("");
      setMessage("تم إضافة القسم بنجاح ✅");

      await loadCategories();
    } catch {
      setMessage("حدث خطأ غير متوقع");
    }

    setSaving(false);
  }
function startEditing(category: Category) {
  setEditingCategory(category);
  setEditName(category.name);
  setEditDescription(category.description || "");
  setEditImageFile(null);
  setEditPreviewUrl(category.image_url || "");
  setMessage("");
}

function cancelEditing() {
  setEditingCategory(null);
  setEditName("");
  setEditDescription("");
  setEditImageFile(null);
  setEditPreviewUrl("");
  setMessage("");
}

function handleEditImageChange(
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

  setEditImageFile(file);
  setEditPreviewUrl(URL.createObjectURL(file));
  setMessage("");
}

async function updateCategory(e: React.FormEvent) {
  e.preventDefault();

  if (!editingCategory) return;

  if (!editName.trim()) {
    setMessage("اكتب اسم القسم أولًا");
    return;
  }

  setSaving(true);
  setMessage("");

  let newImageUrl = editingCategory.image_url;
  let uploadedImagePath: string | null = null;

  try {
    if (editImageFile) {
      const fileExtension =
        editImageFile.name.split(".").pop()?.toLowerCase() || "jpg";

      const fileName = `${crypto.randomUUID()}.${fileExtension}`;
      const filePath = `categories/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, editImageFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        setMessage("حدث خطأ أثناء رفع الصورة الجديدة");
        setSaving(false);
        return;
      }

      uploadedImagePath = filePath;

      const { data: publicUrlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      newImageUrl = publicUrlData.publicUrl;
    }

    const { error: updateError } = await supabase
      .from("categories")
      .update({
        name: editName.trim(),
        description: editDescription.trim() || null,
        image_url: newImageUrl,
      })
      .eq("id", editingCategory.id);

    if (updateError) {
      if (uploadedImagePath) {
        await supabase.storage
          .from("product-images")
          .remove([uploadedImagePath]);
      }

      setMessage(`حدث خطأ أثناء تعديل القسم: ${updateError.message}`);
      setSaving(false);
      return;
    }

    setMessage("تم تعديل القسم بنجاح ✅");

    cancelEditing();
    await loadCategories();
  } catch {
    setMessage("حدث خطأ غير متوقع");
  }

  setSaving(false);
}
  async function deleteCategory(category: Category) {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف قسم "${category.name}"؟`
    );

    if (!confirmed) return;

    setMessage("");

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", category.id);

    if (error) {
      setMessage("حدث خطأ أثناء حذف القسم");
      return;
    }

    setMessage("تم حذف القسم بنجاح ✅");

    await loadCategories();
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
              إدارة الأقسام
            </h1>

            <p className="mt-1 text-sm text-gray-400">
              إضافة وإدارة أقسام متجر البناء الحديث
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
        <div className="grid gap-8 lg:grid-cols-[380px_1fr]">

          {/* إضافة قسم */}
          <div className="h-fit rounded-2xl border border-white/10 bg-[#1b1b1b] p-6">
            <h2 className="text-xl font-bold">
              إضافة قسم جديد
            </h2>

            <form
              onSubmit={addCategory}
              className="mt-6 space-y-5"
            >
              {/* اسم القسم */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  اسم القسم
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: الأسمنت"
                  className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-white outline-none focus:border-orange-500"
                />
              </div>

              {/* الوصف */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  وصف القسم
                </label>

                <textarea
                  value={description}
                  onChange={(e) =>
                    setDescription(e.target.value)
                  }
                  placeholder="وصف مختصر للقسم"
                  rows={4}
                  className="w-full resize-none rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-white outline-none focus:border-orange-500"
                />
              </div>

              {/* الصورة */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  صورة القسم
                </label>

                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-[#111111] px-4 py-6 text-center transition hover:border-orange-500">
                  <span className="text-3xl">📷</span>

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

                {imageFile && (
                  <p className="mt-2 truncate text-xs text-gray-400">
                    الصورة المختارة: {imageFile.name}
                  </p>
                )}

                {previewUrl && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
                    <img
                      src={previewUrl}
                      alt="معاينة الصورة"
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
                  ? "جاري الحفظ ورفع الصورة..."
                  : "إضافة القسم"}
              </button>
            </form>
          </div>
{/* تعديل القسم */}
{editingCategory && (
  <div className="mt-8 rounded-2xl border border-orange-500/20 bg-[#1b1b1b] p-6">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-xl font-bold">
          تعديل القسم
        </h2>

        <p className="mt-1 text-sm text-gray-400">
          تعديل بيانات قسم {editingCategory.name}
        </p>
      </div>

      <button
        type="button"
        onClick={cancelEditing}
        className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
      >
        إلغاء
      </button>
    </div>

    <form
      onSubmit={updateCategory}
      className="mt-6 space-y-5"
    >
      <div>
        <label className="mb-2 block text-sm font-semibold">
          اسم القسم
        </label>

        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-white outline-none focus:border-orange-500"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold">
          وصف القسم
        </label>

        <textarea
          value={editDescription}
          onChange={(e) =>
            setEditDescription(e.target.value)
          }
          rows={4}
          className="w-full resize-none rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-white outline-none focus:border-orange-500"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold">
          تغيير صورة القسم
        </label>

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-[#111111] px-4 py-6 text-center transition hover:border-orange-500">
          <span className="text-3xl">📷</span>

          <span className="mt-2 font-semibold">
            اختيار صورة جديدة
          </span>

          <span className="mt-1 text-xs text-gray-500">
            JPG / PNG / WEBP — بحد أقصى 5MB
          </span>

          <input
            type="file"
            accept="image/*"
            onChange={handleEditImageChange}
            className="hidden"
          />
        </label>

        {editPreviewUrl && (
          <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
            <img
              src={editPreviewUrl}
              alt="معاينة صورة القسم"
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
          ? "جاري حفظ التعديلات..."
          : "حفظ التعديلات"}
      </button>
    </form>
  </div>
)}
          {/* الأقسام الموجودة */}
          <div>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                الأقسام الموجودة
              </h2>

              <span className="rounded-full bg-white/5 px-4 py-2 text-sm text-gray-400">
                {categories.length} قسم
              </span>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-[#1b1b1b] p-8 text-center text-gray-400">
                جاري تحميل الأقسام...
              </div>
            ) : categories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#1b1b1b] p-10 text-center">
                <p className="text-lg font-semibold">
                  لا توجد أقسام حتى الآن
                </p>

                <p className="mt-2 text-sm text-gray-500">
                  أضف أول قسم من النموذج الموجود بجانبك.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-[#1b1b1b]"
                  >
                    {category.image_url ? (
                      <img
                        src={category.image_url}
                        alt={category.name}
                        className="h-48 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-48 items-center justify-center bg-[#151515] text-gray-600">
                        لا توجد صورة
                      </div>
                    )}

                    <div className="p-5">
                      <h3 className="text-lg font-bold">
                        {category.name}
                      </h3>

                      {category.description && (
                        <p className="mt-2 text-sm leading-6 text-gray-400">
                          {category.description}
                        </p>
                      )}

                      <div className="mt-5 grid grid-cols-2 gap-3">
  <button
    type="button"
    onClick={() => startEditing(category)}
    className="rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
  >
    ✏️ تعديل
  </button>

  <button
    type="button"
    onClick={() =>
      deleteCategory(category)
    }
    className="rounded-xl border border-red-500/20 bg-red-500/10 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/20"
  >
    🗑️ حذف
  </button>
</div>

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