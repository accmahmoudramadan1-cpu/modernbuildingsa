import Link from "next/link";
import NextImage from "next/image";

export const metadata = {
  title: "سياسة الخصوصية | مؤسسة البناء الحديث للتجارة",
  description: "سياسة الخصوصية وحماية بيانات العملاء لمؤسسة محل البناء الحديث للتجارة",
};

export default function PrivacyPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-[#f5f5f3] text-[#171717] w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200/90 bg-white/95 backdrop-blur-md shadow-xs w-full">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
          <Link href="/" className="flex items-center shrink-0 group py-0.5" title="مؤسسة البناء الحديث">
            <div className="relative h-10 sm:h-12 w-36 sm:w-44 transition group-hover:opacity-90">
              <NextImage
                src="/logo.png"
                alt="مؤسسة البناء الحديث"
                fill
                className="object-contain object-right"
                priority
              />
            </div>
          </Link>

          <Link
            href="/"
            className="rounded-xl bg-[#123B5D] px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold text-white transition hover:bg-[#0B2942] whitespace-nowrap shrink-0"
          >
            ← العودة للرئيسية
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <div className="rounded-3xl bg-white p-6 sm:p-10 shadow-sm border border-black/5">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 border-b border-gray-100 pb-4">
            سياسة الخصوصية
          </h1>

          <div className="mt-6 space-y-6 text-sm sm:text-base leading-relaxed text-gray-600">
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-2">1. مقدمة</h2>
              <p>
                نحن في <strong>مؤسسة محل البناء الحديث للتجارة</strong> نولي أهمية قصوى لخصوصية عملائنا وزوار موقعنا الإلكتروني. توضح هذه السياسة كيفية جمع واستخدام وحماية معلوماتك الشخصية عند تصفحك للموقع أو طلب منتجاتنا.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-2">2. المعلومات التي نجمعها</h2>
              <p>قد نقوم بجمع المعلومات التالية عند إتمام الطلب أو التواصل معنا:</p>
              <ul className="list-disc list-inside mt-2 space-y-1 pr-2">
                <li>الاسم الكامل وبيانات الاتصال (رقم الهاتف، رقم الواتساب، البريد الإلكتروني).</li>
                <li>عنوان التسليم وتفاصيل موقع المشروع أو المبنى.</li>
                <li>سجل الطلبات والمنتجات المطلوبة وعروض الأسعار.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-2">3. كيف نستخدم معلوماتك</h2>
              <p>نستخدم البيانات التي نجمعها للأغراض التالية فقط:</p>
              <ul className="list-disc list-inside mt-2 space-y-1 pr-2">
                <li>معالجة وتنفيذ طلبات الشراء وتوريد مواد البناء والتشطيب.</li>
                <li>التواصل المباشر بشأن الأسعار، التوافر، وحالة التوصيل.</li>
                <li>تقديم خدمات الدعم الفني وخدمة العملاء.</li>
                <li>الامتثال للمتطلبات والأنظمة القانونية والتجارية السارية في المملكة العربية السعودية.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-2">4. حماية وأمن البيانات</h2>
              <p>
                نلتزم بتطبيق تدابير أمنية ملائمة لحماية بياناتك من الوصول غير المصرح به أو التعديل أو الإفصاح. لا نقوم ببيع أو تأجير أو مشاركة معلوماتك الشخصية مع أي طرف ثالث لأغراض تسويقية.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-2">5. التواصل معنا</h2>
              <p>إذا كانت لديك أي استفسارات حول سياسة الخصوصية أو بياناتك، يمكنك التواصل معنا عبر:</p>
              <div className="mt-3 rounded-2xl bg-gray-50 p-4 border border-gray-100 text-sm space-y-1">
                <p><strong>مؤسسة محل البناء الحديث للتجارة</strong></p>
                <p>الهاتف: 0175420300 | الواتساب: 0554304322</p>
                <p>البريد الإلكتروني: Info@modernbuildingsa.com</p>
                <p>العنوان: نجران – أبا السعود – البلد، المملكة العربية السعودية</p>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Footer Bottom Bar */}
      <footer className="mt-auto border-t border-white/10 bg-[#0a0f14] py-6 px-4 sm:px-6 lg:px-8 w-full text-white">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-gray-400">
          <p>
            © {new Date().getFullYear()} مؤسسة محل البناء الحديث للتجارة. جميع الحقوق محفوظة.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="transition hover:text-white font-semibold underline underline-offset-4"
            >
              الرئيسية
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
