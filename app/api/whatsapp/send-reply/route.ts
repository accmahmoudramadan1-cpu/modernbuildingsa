import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppSession } from "@/lib/whatsapp-auth";
import {
  sendWhatsAppMedia,
  sendWhatsAppMessage,
  uploadMediaToMeta,
} from "@/lib/whatsapp";
import { saveMediaToMysql } from "@/lib/whatsapp-inbox";
import { remuxWebmOpusToOgg } from "@/lib/webm-to-ogg";

export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 16 * 1024 * 1024; // 16 MB

function resolveMediaCategory(mimeType: string, filename: string, isVoice: boolean): "image" | "audio" | "video" | "document" {
  const mime = mimeType.toLowerCase();
  const name = filename.toLowerCase();
  if (isVoice || mime.startsWith("audio/") || name.endsWith(".ogg") || name.endsWith(".mp3") || name.endsWith(".m4a")) {
    return "audio";
  }
  if (mime.startsWith("image/") && !mime.includes("svg")) {
    return "image";
  }
  if (mime.startsWith("video/") || name.endsWith(".mp4") || name.endsWith(".mov")) {
    return "video";
  }
  return "document";
}

export async function POST(request: NextRequest) {
  const session = await getWhatsAppSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "يرجى تسجيل الدخول أولاً." },
      { status: 401 }
    );
  }

  try {
    const contentType = request.headers.get("content-type") || "";

    // 1. Plain JSON text message inside 24h window
    if (contentType.includes("application/json")) {
      const body = await request.json();
      const phone = String(body?.phone || "").trim();
      const text = String(body?.text || "").trim();
      const replyToWaId = body?.replyToWaId ? String(body.replyToWaId).trim() : undefined;
      const customerName = body?.customerName ? String(body.customerName).trim() : undefined;

      if (!phone || !text) {
        return NextResponse.json(
          { success: false, error: "رقم الهاتف ونص الرسالة حقول مطلوبة." },
          { status: 400 }
        );
      }

      const result = await sendWhatsAppMessage(phone, text, {
        replyToWaId,
        customerName,
      });

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error || "تعذر إرسال الرسالة." },
          { status: 502 }
        );
      }

      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        message: result.recorded,
      });
    }

    // 2. Multipart form-data (Voice note, Image, Video, or Document)
    const form = await request.formData();
    const phone = String(form.get("phone") || "").trim();
    const caption = String(form.get("caption") || "").trim();
    const replyToWaId = form.get("replyToWaId") ? String(form.get("replyToWaId")).trim() : undefined;
    const customerName = form.get("customerName") ? String(form.get("customerName")).trim() : undefined;
    const isVoice = String(form.get("isVoice") || "") === "true";
    const file = form.get("file");

    if (!phone || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "رقم الهاتف والملف المرفق حقول مطلوبة." },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { success: false, error: "حجم الملف غير صالح أو يتجاوز 16 ميجابايت." },
        { status: 400 }
      );
    }

    let rawBuffer: Buffer = Buffer.from(await file.arrayBuffer());
    let mimeType = (file.type || "application/octet-stream").split(";")[0].trim();
    let filename = file.name || "attachment";
    const category = resolveMediaCategory(mimeType, filename, isVoice);

    // Remux browser WebM-Opus recordings into standard OGG-Opus so Meta WhatsApp plays them natively
    if (category === "audio" && (mimeType.includes("webm") || filename.endsWith(".webm"))) {
      const oggBuffer = remuxWebmOpusToOgg(rawBuffer);
      if (!oggBuffer) {
        return NextResponse.json(
          {
            success: false,
            error: "تعذر تحويل التسجيل الصوتي لصيغة OGG المدعومة في واتساب. جرب متصفح Chrome/Edge محدث أو أرسل ملف MP3/M4A.",
          },
          { status: 400 }
        );
      }
      rawBuffer = oggBuffer;
      mimeType = "audio/ogg";
      filename = filename.replace(/\.webm$/i, "") + ".ogg";
    }

    const savedId = await saveMediaToMysql({
      buffer: rawBuffer,
      mimeType,
      filename,
    });
    const localMediaUrl = savedId ? `/api/media/${savedId}` : undefined;

    const uploadRes = await uploadMediaToMeta({
      buffer: rawBuffer,
      mimeType,
      filename,
    });

    if (!uploadRes.success || !uploadRes.mediaId) {
      return NextResponse.json(
        {
          success: false,
          error: uploadRes.error || "تعذر رفع المرفق إلى خوادم ميتا واتساب.",
        },
        { status: 502 }
      );
    }

    const sendRes = await sendWhatsAppMedia({
      to: phone,
      type: category,
      metaMediaId: uploadRes.mediaId,
      caption: caption || undefined,
      filename,
      isVoice: category === "audio" && (isVoice || mimeType.includes("ogg")),
      localMediaId: savedId || undefined,
      localMediaUrl,
      mimeType,
      replyToWaId,
      customerName,
    });

    if (!sendRes.success) {
      return NextResponse.json(
        { success: false, error: sendRes.error || "فشل إرسال المرفق عبر واتساب." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: sendRes.messageId,
      message: sendRes.recorded,
    });
  } catch (err: any) {
    console.error("[API /api/whatsapp/send-reply] Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "حدث خطأ غير متوقع أثناء الإرسال." },
      { status: 500 }
    );
  }
}
