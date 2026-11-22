export interface WhatsAppFailureInfo {
  title: string;
  reason: string;
  hint: string;
  raw?: string | null;
}

interface FailureRule {
  codes?: number[];
  patterns?: RegExp[];
  title: string;
  reason: string;
  hint: string;
}

const META_AND_SYSTEM_FAILURE_RULES: FailureRule[] = [
  {
    codes: [190, 10, 200],
    patterns: [
      /oauthexception/i,
      /access token/i,
      /session has expired/i,
      /missing whatsapp credentials/i,
      /WHATSAPP_ACCESS_TOKEN/,
      /WHATSAPP_PHONE_NUMBER_ID/,
    ],
    title: "انتهاء صلاحية رمز الربط (Token) أو نقص بيانات الإعداد",
    reason:
      "انتهت صلاحية WHATSAPP_ACCESS_TOKEN لدى Meta أو أن متغيرات الربط بالخادم ناقصة أو تفتقر إلى صلاحية whatsapp_business_messaging.",
    hint: "حدّث رمز الوصول الدائم (System User Token) وإعدادات الربط على الخادم ثم أعد المحاولة.",
  },
  {
    patterns: [/invalid_phone_format/i, /رقم الهاتف غير صالح/i, /رقم الهاتف غير صحيح/i],
    title: "رقم الهاتف غير صحيح أو ينقصه كود الدولة",
    reason:
      "الرقم المُدخل في الفاتورة لا يطابق الصيغة الدولية الصحيحة للواتساب (مثلاً رقم سعودي بـ 11 رقماً بدلاً من 10 أرقام، أو رقم ناقص لم يُضف له كود الدولة 966 تلقائياً).",
    hint: "تأكد من أن الرقم السعودي 10 أرقام يبدأ بـ 05 (مثل 0501234567) أو مكتوب دولياً بدون + (مثل 966501234567)، ثم صححه في أونكس وأعد الإرسال.",
  },
  {
    patterns: [/missingmandatorypdfheader/i, /يشترط إرفاق ملف pdf/i, /ملف pdf/i],
    title: "ملف PDF الخاص بالمستند غير متوفر",
    reason:
      "قالب واتساب المعتمد لهذا النوع من المستندات يشترط إرفاق ملف PDF من أونكس، ولم يصل الملف أو تعذر العثور عليه بعد.",
    hint: "تأكد من تفعيل إرسال الرسائل (SEND_MSG) للعميل وتفعيل تصدير PDF في شاشة ALRTS001 بأونكس، ثم اضغط إرسال -> واتساب من داخل أونكس.",
  },
  {
    codes: [131026],
    patterns: [/message undeliverable/i, /not a valid whatsapp/i, /re-?engagement.*not/i],
    title: "تعذر تسليم الرسالة على واتساب",
    reason:
      "الرقم غير مسجل على تطبيق واتساب، أو العميل يستخدم إصداراً قديماً جداً، أو لم يوافق على شروط خدمة واتساب الأخيرة.",
    hint: "تأكد من أن الرقم يمتلك حساب واتساب نشطاً بالفعل أو جرّب رقم جوال آخر للعميل.",
  },
  {
    codes: [131000, 100],
    patterns: [/recipient phone/i, /invalid parameter.*to/i, /phone_number/i, /parameter.*phone/i],
    title: "رفض Meta لصيغة رقم المستلم",
    reason:
      "رفضت خوادم Meta رقم الجوال المُرسل لأنه لا يتبع الترقيم الدولي الصحيح (E.164) أو يحتوي على أرقام زائدة/ناقصة.",
    hint: "راجع طول الرقم وكود الدولة (12 رقماً للسعودية يبدأ بـ 9665) ثم أعد الإرسال.",
  },
  {
    codes: [131021],
    patterns: [/recipient cannot be sender/i],
    title: "لا يمكن الإرسال لنفس رقم المؤسسة",
    reason: "رقم المستلم مطابق لرقم الواتساب الرسمي المربوط بالإرسال في Meta.",
    hint: "غيّر رقم المستلم في بطاقة العميل إلى رقم العميل الفعلي.",
  },
  {
    codes: [131052, 131053],
    patterns: [
      /did not respond back in time/i,
      /media upload/i,
      /media download/i,
      /unable to download/i,
      /hosting media content/i,
    ],
    title: "فشل تحميل أو رفع ملف PDF إلى Meta",
    reason:
      "انتهت مهلة تحميل ملف الـ PDF من السيرفر لدى Meta، أو الملف تالف/فارغ، أو حجمه يتجاوز الحد المسموح (100 ميجابايت).",
    hint: "تحقق من فتح رابط الـ PDF في المتصفح ثم أعد المحاولة؛ سيتم رفعه مباشرة عبر media_id.",
  },
  {
    codes: [132001],
    patterns: [/template name does not exist/i, /translation.*does not exist/i],
    title: "القالب غير موجود أو غير معتمد في Meta",
    reason:
      "اسم القالب المطلوب غير منشأ في مدير واتساب للأعمال لهذه اللغة (ar)، أو ما زال قيد المراجعة ولم تتم الموافقة عليه بعد.",
    hint: "راجع اسم القالب واللغة في Meta WhatsApp Manager وتأكد أن حالته Active / Approved.",
  },
  {
    codes: [132000],
    patterns: [/number of parameters does not match/i, /expected number of params/i],
    title: "عدم تطابق عدد متغيرات القالب",
    reason:
      "عدد الحقول/المتغيرات المرسلة لا يطابق عدد المتغيرات ({{1}}, {{2}}, ...) المعتمد داخل القالب في Meta.",
    hint: "راجع تصميم القالب في Meta أو تأكد من تعبئة جميع الحقول المطلوبة داخل نافذة القالب.",
  },
  {
    codes: [132005],
    patterns: [/translated text too long/i, /parameter.*too long/i],
    title: "نص أحد الحقول أطول من الحد المسموح",
    reason:
      "أحد المتغيرات المرسلة (مثل التفاصيل أو اسم العميل) تجاوز الحد الأقصى لعدد الأحرف المسموح به في Meta.",
    hint: "اختصر نص البيان أو التفاصيل في نافذة القالب ثم أعد الإرسال.",
  },
  {
    codes: [132007],
    patterns: [/format character policy/i, /new-?line/i, /too many consecutive spaces/i],
    title: "رموز أو مسافات غير مسموحة داخل المتغيرات",
    reason:
      "تحظر Meta وجود أسطر جديدة زائدة أو علامات Tab أو أكثر من 4 مسافات متتالية داخل متغيرات القالب.",
    hint: "احذف الأسطر الفارغة أو المسافات المتكررة من المتغيرات داخل نافذة القالب وحاول مجدداً.",
  },
  {
    codes: [132012, 131008],
    patterns: [/parameter format mismatch/i, /header.*expected/i, /required parameter is missing/i],
    title: "اختلاف صيغة الرأس أو نوع المتغيرات مع Meta",
    reason:
      "القالب في Meta يتوقع رأساً من نوع مختلف (مثل وثيقة PDF بدلاً من نص أو العكس) أو صيغة متغير غير متطابقة.",
    hint: "تأكد من ضبط ترويسة القالب في Meta على Document (PDF) ومن إرفاق رابط الملف الصحيح.",
  },
  {
    codes: [132015, 132016],
    patterns: [/template is paused/i, /template is disabled/i],
    title: "القالب موقوف مؤقتاً أو معطّل من Meta",
    reason:
      "أوقفت Meta هذا القالب مؤقتاً أو نهائياً بسبب انخفاض تقييم الجودة أو بلاغات من مستلمين.",
    hint: "افتح WhatsApp Manager في Meta للتحقق من حالة القالب وجودته أو إنشاء نسخة بديلة.",
  },
  {
    codes: [132068, 132069],
    patterns: [/flow is blocked/i, /flow is throttled/i],
    title: "القالب التفاعلي مقيد من Meta",
    reason: "تم تقييد أو إيقاف مسار الـ Flow المرتبط بالقالب لدى Meta.",
    hint: "راجع حالة الـ Flow داخل حساب Meta Business.",
  },
  {
    codes: [131049],
    patterns: [/healthy ecosystem engagement/i, /not delivered to maintain/i],
    title: "حجب وقائي من واتساب لحماية تجربة المستخدم",
    reason:
      "لم تسلم Meta هذه الرسالة ضمن سياسة الحد من كثرة الرسائل غير التفاعلية لحماية جودة التفاعل على حساب العميل.",
    hint: "هذا قيد مؤقت من واتساب على رقم العميل؛ انتظر فترة قبل إعادة المحاولة أو تواصل مع العميل عبر رسالة يبدأها هو.",
  },
  {
    codes: [131050],
    patterns: [/opted out/i, /(?:user|recipient|message).*blocked/i],
    title: "العميل أوقف أو حظر الرسائل",
    reason: "قام العميل بإلغاء الاشتراك أو حظر رقم واتساب المؤسسة.",
    hint: "لا يمكن إرسال رسائل آلية لهذا الرقم حتى يقوم العميل بإلغاء الحظر والموافقة مجدداً.",
  },
  {
    codes: [131047],
    patterns: [/re-?engagement/i, /more than 24 hours/i],
    title: "انتهت نافذة المحادثة (24 ساعة)",
    reason:
      "مرّ أكثر من 24 ساعة على آخر رسالة من العميل، لذلك تمنع Meta إرسال رسالة نصية عادية ويجب استخدام قالب رسمي معتمد.",
    hint: "اختر وضع «قالب Utility رسمي» بدلاً من «رسالة نصية مباشرة» ثم أعد الإرسال.",
  },
  {
    codes: [131051],
    patterns: [/unsupported message type/i],
    title: "نوع الرسالة غير مدعوم",
    reason: "صيغة الرسالة أو المرفق غير مدعومة لدى واتساب Cloud API.",
    hint: "تحقق من نوع الملف (PDF) وإعدادات القالب.",
  },
  {
    codes: [131042],
    patterns: [/payment issue/i, /business eligibility/i, /billing/i],
    title: "مشكلة فوترة أو وسيلة دفع في حساب Meta",
    reason:
      "رفضت Meta الإرسال بسبب مشكلة في البطاقة البنكية أو الفوترة أو أهلية الحساب الإعلاني والتجاري.",
    hint: "راجع إعدادات الدفع (Billing) في Meta Business Manager وتأكد من سداد أي مديونية أو صلاحية البطاقة.",
  },
  {
    codes: [131031, 368, 131057],
    patterns: [/account has been locked/i, /temporarily blocked/i, /account in maintenance/i],
    title: "حساب واتساب للأعمال مقيد أو مغلق",
    reason:
      "حساب Meta WhatsApp Business موقوف مؤقتاً، أو مقيد لمخالفة السياسات، أو تحت الصيانة.",
    hint: "تحقق من مركز أمان الحساب (Account Quality) في Meta Business Suite.",
  },
  {
    codes: [130429, 80007, 131048, 131056],
    patterns: [/rate limit/i, /spam rate/i, /too many requests/i, /throughput/i, /pair rate/i],
    title: "تجاوز حد الإرسال السريع (Rate Limit)",
    reason:
      "تم إرسال رسائل كثيرة خلال وقت قصير لنفس الرقم أو من نفس الحساب مما فعّل الحماية المؤقتة من Meta.",
    hint: "انتظر دقيقة أو بضع دقائق ثم أعد محاولة الإرسال.",
  },
  {
    codes: [133010, 133000],
    patterns: [/not registered/i, /phone number does not exist/i],
    title: "رقم إرسال المؤسسة غير مفعل على Cloud API",
    reason: "معرّف رقم الهاتف الخاص بالمؤسسة غير مسجل أو مفصول من واتساب Cloud API.",
    hint: "تحقق من حالة رقم المؤسسة ومن قيمة WHATSAPP_PHONE_NUMBER_ID.",
  },
  {
    patterns: [/permission/i],
    title: "نقص صلاحيات الإرسال في حساب Meta",
    reason: "رمز الربط أو التطبيق لدى Meta لا يمتلك صلاحية whatsapp_business_messaging المطلوبة.",
    hint: "راجع صلاحيات System User وربط رقم الواتساب في Meta Business Manager.",
  },
  {
    patterns: [/^مرفوض:/],
    title: "تم رفض العملية لحماية تطابق القوالب",
    reason: "تم إيقاف الإرسال محلياً لأن القالب المختار لا يطابق نوع المستند المسجل في أونكس.",
    hint: "استخدم القالب الافتراضي المرتبط بنوع المستند في أونكس فقط.",
  },
  {
    patterns: [/fetch failed/i, /etimedout/i, /econnrefused/i, /network/i, /aborted/i, /timeout/i],
    title: "فشل الاتصال بالشبكة أو انتهاء المهلة",
    reason: "تعذر الوصول إلى خوادم Meta WhatsApp API أثناء الإرسال بسبب انقطاع مؤقت أو بطء الاستجابة.",
    hint: "أعد المحاولة الآن؛ غالباً ما تكون مشكلة شبكة عابرة.",
  },
];

function extractMetaErrorCode(raw: string): number | null {
  const codeMatch = raw.match(/(?:\bcode\s*[:=]\s*|\(#|\berror_subcode\s*[:=]\s*)(\d+)/i);
  if (!codeMatch) return null;
  const num = Number(codeMatch[1]);
  return Number.isFinite(num) ? num : null;
}

export function diagnosePhoneFormatIssue(phone?: string | null): string | null {
  const raw = String(phone || "").trim();
  if (!raw) return "رقم الهاتف فارغ في بيانات المستند.";
  const digits = raw.replace(/\D/g, "").replace(/^00/, "");
  if (!digits) return `رقم الهاتف (${raw}) لا يحتوي على أرقام صالحة.`;
  if (digits.startsWith("05") && digits.length !== 10) {
    return `رقم الهاتف (${raw}) يبدأ بـ 05 ولكنه يتكون من ${digits.length} رقماً بدلاً من 10 أرقام سعودية، لذلك لم يُضف كود الدولة 966 تلقائياً.`;
  }
  if (digits.startsWith("01") && digits.length !== 11) {
    return `رقم الهاتف (${raw}) يبدأ بـ 01 ولكنه يتكون من ${digits.length} أرقام بدلاً من 11 رقماً مصرياً.`;
  }
  if (digits.startsWith("0")) {
    return `رقم الهاتف (${raw}) يبدأ بصفر محلي ولا يطابق صيغة جوال معروفة لإضافة كود الدولة تلقائياً.`;
  }
  if (digits.length < 9 || digits.length > 15) {
    return `طول رقم الهاتف (${raw}) غير صالح دولياً (${digits.length} أرقام؛ المطلوب 9 إلى 15 رقماً بكود الدولة).`;
  }
  return null;
}

export function translateWhatsAppFailureToArabic(
  rawError?: string | null,
  context?: { phone?: string | null; docTypeLabel?: string }
): WhatsAppFailureInfo {
  const raw = rawError ? String(rawError).trim() : "";

  if (raw) {
    const code = extractMetaErrorCode(raw);
    for (const rule of META_AND_SYSTEM_FAILURE_RULES) {
      const matchedCode = code !== null && rule.codes?.includes(code);
      const matchedPattern = rule.patterns?.some((re) => re.test(raw));
      if (matchedCode || matchedPattern) {
        return {
          title: rule.title,
          reason: rule.reason,
          hint: rule.hint,
          raw,
        };
      }
    }

    // Also inspect phone if Meta returned a generic error and local phone is visibly malformed
    const phoneIssue = diagnosePhoneFormatIssue(context?.phone);
    if (phoneIssue) {
      return {
        title: "رفض الإرسال غالباً بسبب رقم الهاتف",
        reason: phoneIssue,
        hint: "عدّل رقم الهاتف ليصبح بصيغة صحيحة (10 أرقام يبدأ بـ 05 أو 12 رقماً يبدأ بـ 9665) ثم أعد الإرسال.",
        raw,
      };
    }

    return {
      title: "تعذر إرسال رسالة الواتساب عبر Meta",
      reason: raw.startsWith("مرفوض") || /[\u0600-\u06FF]/.test(raw)
        ? raw
        : "ردّت خوادم Meta برفض الإرسال بسبب خطأ في البيانات أو إعدادات القالب/الحساب.",
      hint: "راجع التفاصيل التقنية أدناه وتأكد من رقم الهاتف ومن اعتماد القالب في Meta.",
      raw,
    };
  }

  // Legacy records before failure_reason persistence
  const phoneIssue = diagnosePhoneFormatIssue(context?.phone);
  if (phoneIssue) {
    return {
      title: "رقم الهاتف غير صحيح",
      reason: phoneIssue,
      hint: "قم بتصحيح رقم الجوال في أونكس (أو تواصل مع الدعم لتعديله) ثم أعد الإرسال.",
      raw: null,
    };
  }

  return {
    title: "فشل الإرسال عبر Meta",
    reason:
      "فشل إرسال هذا المستند سابقاً قبل تسجيل نص السبب التفصيلي (غالباً بسبب عدم تسجيل الرقم في واتساب، أو مشكلة مؤقتة في القالب/الـ PDF أو حد الإرسال).",
    hint: "افتح نافذة الإرسال واضغط «إرسال عبر واتساب الآن» لإعادة المحاولة وعرض سبب الاستجابة اللحظي إن استمر الفشل.",
    raw: null,
  };
}

export function formatWhatsAppFailureBannerText(
  rawError?: string | null,
  context?: { phone?: string | null; docTypeLabel?: string }
): string {
  const info = translateWhatsAppFailureToArabic(rawError, context);
  return `${info.title}: ${info.reason}`;
}
