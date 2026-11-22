import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { downloadMetaMedia } from "@/lib/whatsapp";
import {
  recordWhatsAppMessage,
  saveMediaToMysql,
  updateWhatsAppMessageStatus,
} from "@/lib/whatsapp-inbox";

export const dynamic = "force-dynamic";

function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return true; // Skip strict HMAC only if secret is not configured
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;

  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function extensionFromMime(mimeType: string): string {
  const m = mimeType.toLowerCase();
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("mp4")) return "mp4";
  if (m.includes("pdf")) return "pdf";
  return "bin";
}

/**
 * GET Handler - Webhook Verification for Meta WhatsApp Cloud API
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken =
    process.env.WHATSAPP_VERIFY_TOKEN || "modern_building_verify_2026";

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[WhatsApp Webhook] Verification successful!");
    return new Response(challenge || "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new Response("Forbidden: Invalid verification token", {
    status: 403,
  });
}

/**
 * POST Handler - Receives incoming WhatsApp messages, media, and delivery/read status updates
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (!verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    if (body.object !== "whatsapp_business_account") {
      return NextResponse.json({ error: "Not a valid WhatsApp event" }, { status: 404 });
    }

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value;
        if (!value) continue;

        // Build wa_id -> profile.name lookup
        const contactNames = new Map<string, string>();
        if (Array.isArray(value.contacts)) {
          for (const c of value.contacts) {
            if (c?.wa_id && c?.profile?.name) {
              contactNames.set(String(c.wa_id).replace(/\D/g, ""), String(c.profile.name));
            }
          }
        }

        // 1. Process Inbound Messages (and store media permanently in MySQL media_files)
        if (Array.isArray(value.messages) && value.messages.length > 0) {
          console.log(`[WhatsApp Webhook] Inbound messages batch: count=${value.messages.length}`);
          for (const message of value.messages) {
            const from = String(message.from || "").replace(/\D/g, "");
            if (!from) continue;

            const waMessageId = message.id ? String(message.id) : null;
            const timestampMs = message.timestamp ? Number(message.timestamp) * 1000 : Date.now();
            const createdAt = new Date(Number.isFinite(timestampMs) ? timestampMs : Date.now());
            const type = String(message.type || "text");
            const customerName = contactNames.get(from) || null;
            const replyToWaId = message.context?.id ? String(message.context.id) : null;

            let textBody: string | null = null;
            let mediaId: string | null = null;
            let mediaUrl: string | null = null;
            let mediaMime: string | null = null;
            let mediaFilename: string | null = null;

            if (type === "text") {
              textBody = message.text?.body ? String(message.text.body) : "";
            } else if (type === "button") {
              textBody = message.button?.text ? String(message.button.text) : "رد زر سريع";
            } else if (type === "interactive") {
              textBody =
                message.interactive?.button_reply?.title ||
                message.interactive?.list_reply?.title ||
                "رد تفاعلي";
            } else if (type === "reaction") {
              textBody = `تفاعل: ${message.reaction?.emoji || "👍"}`;
            } else if (type === "location" && message.location) {
              const lat = message.location.latitude;
              const lng = message.location.longitude;
              const locName = message.location.name || message.location.address || "";
              textBody = `موقع: ${locName ? locName + " - " : ""}https://maps.google.com/?q=${lat},${lng}`;
            } else if (type === "contacts") {
              const firstContact = message.contacts?.[0];
              textBody = `جهة اتصال: ${firstContact?.name?.formatted_name || "غير مسمى"}`;
            } else if (
              type === "image" ||
              type === "audio" ||
              type === "video" ||
              type === "document" ||
              type === "sticker"
            ) {
              const mediaNode = message[type] || {};
              mediaId = mediaNode.id ? String(mediaNode.id) : null;
              mediaMime = mediaNode.mime_type ? String(mediaNode.mime_type) : null;
              mediaFilename = mediaNode.filename ? String(mediaNode.filename) : null;
              textBody = mediaNode.caption ? String(mediaNode.caption) : null;

              if (mediaId) {
                const downloaded = await downloadMetaMedia(mediaId);
                if (downloaded && downloaded.buffer.length <= 20 * 1024 * 1024) {
                  const ext = extensionFromMime(downloaded.mimeType);
                  const savedId = await saveMediaToMysql({
                    buffer: downloaded.buffer,
                    mimeType: downloaded.mimeType,
                    filename: mediaFilename || `${type}_${mediaId}.${ext}`,
                  });
                  if (savedId) {
                    mediaUrl = `/api/media/${savedId}`;
                    mediaMime = downloaded.mimeType;
                  }
                }
              }
            }

            await recordWhatsAppMessage({
              phone: from,
              customerName,
              waMessageId,
              direction: "in",
              msgType: type,
              body: textBody,
              mediaId,
              mediaUrl,
              mediaMime,
              mediaFilename,
              replyToWaId,
              status: "read",
              createdAt,
            });
          }
        }

        // 2. Process Message Status Updates (SENT, DELIVERED, READ/SEEN, FAILED)
        if (Array.isArray(value.statuses) && value.statuses.length > 0) {
          const summary = value.statuses
            .map((s: any) => String(s?.status || "unknown"))
            .join(",");
          console.log(`[WhatsApp Webhook] Status batch (${value.statuses.length}): ${summary}`);
          for (const st of value.statuses) {
            if (!st?.id || !st?.status) continue;
            const errObj = st.errors?.[0];
            const errMsg = errObj
              ? [
                  String(
                    errObj.error_data?.details ||
                      errObj.message ||
                      errObj.title ||
                      "WhatsApp delivery failed"
                  ),
                  errObj.code !== undefined ? `[code: ${errObj.code}]` : "",
                ]
                  .filter(Boolean)
                  .join(" ")
              : null;
            await updateWhatsAppMessageStatus({
              waMessageId: String(st.id),
              status: String(st.status),
              errorText: errMsg,
            });
          }
        }
      }
    }

    return NextResponse.json({ status: "EVENT_RECEIVED" }, { status: 200 });
  } catch (error) {
    console.error("[WhatsApp Webhook] Error processing event:", error);
    return NextResponse.json({ status: "EVENT_RECEIVED_WITH_WARN" }, { status: 200 });
  }
}
