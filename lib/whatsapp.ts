/**
 * Helper utility for Meta WhatsApp Cloud API
 */
import { formatPhoneNumber } from "@/lib/whatsapp-phone";
import {
  isConversationWindowOpen,
  recordWhatsAppMessage,
} from "@/lib/whatsapp-inbox";

export { formatPhoneNumber };

function formatMetaApiError(data: any): string {
  const err = data?.error;
  if (!err || typeof err !== "object") {
    return typeof data === "string" ? data : JSON.stringify(data);
  }

  const baseMessage = err.error_user_msg
    ? `${err.message || "WhatsApp API Error"} — ${err.error_user_msg}`
    : err.message || "WhatsApp API Error";

  const extraDetails = err.error_data?.details ? ` (${err.error_data.details})` : "";
  const codes: string[] = [];
  if (err.code !== undefined) codes.push(`code: ${err.code}`);
  if (err.error_subcode !== undefined) codes.push(`subcode: ${err.error_subcode}`);
  if (err.fbtrace_id) codes.push(`fbtrace_id: ${err.fbtrace_id}`);

  return codes.length > 0
    ? `${baseMessage}${extraDetails} [${codes.join(", ")}]`
    : `${baseMessage}${extraDetails}`;
}

export interface WhatsAppTextMessagePayload {
  messaging_product: "whatsapp";
  to: string;
  type: "text";
  context?: {
    message_id: string;
  };
  text: {
    preview_url?: boolean;
    body: string;
  };
}

export interface WhatsAppTemplateParameter {
  type: "text" | "currency" | "date_time" | "document" | "image";
  text?: string;
  [key: string]: any;
}

export interface WhatsAppTemplateComponent {
  type: "header" | "body" | "button";
  sub_type?: string;
  index?: string;
  parameters: WhatsAppTemplateParameter[];
}

export interface WhatsAppTemplateMessagePayload {
  messaging_product: "whatsapp";
  recipient_type?: "individual";
  to: string;
  type: "template";
  template: {
    name: string;
    language: {
      code: string;
    };
    components?: WhatsAppTemplateComponent[];
  };
}

export type WhatsAppMessagePayload =
  | WhatsAppTextMessagePayload
  | WhatsAppTemplateMessagePayload;

/**
 * Send a WhatsApp text message via Meta WhatsApp Cloud API
 */
export async function sendWhatsAppMessage(
  to: string,
  bodyText: string,
  options?: {
    replyToWaId?: string;
    customerName?: string;
    recordInInbox?: boolean;
  }
) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.warn(
      "[WhatsApp] Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN in environment variables."
    );
    return { success: false, error: "Missing WhatsApp credentials" };
  }

  const recipient = formatPhoneNumber(to);
  if (!recipient) {
    return { success: false, error: "Invalid phone number" };
  }

  const payload: WhatsAppTextMessagePayload = {
    messaging_product: "whatsapp",
    to: recipient,
    type: "text",
    ...(options?.replyToWaId ? { context: { message_id: options.replyToWaId } } : {}),
    text: {
      preview_url: true,
      body: bodyText,
    },
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("[WhatsApp] API Error:", data);
      return { success: false, error: formatMetaApiError(data), details: data };
    }

    const messageId = data?.messages?.[0]?.id;
    let recorded = null;
    if (options?.recordInInbox !== false) {
      recorded = await recordWhatsAppMessage({
        phone: recipient,
        customerName: options?.customerName,
        waMessageId: messageId,
        direction: "out",
        msgType: "text",
        body: bodyText,
        replyToWaId: options?.replyToWaId || null,
        status: "sent",
      });
    }

    return {
      success: true,
      messageId,
      recorded,
      data,
    };
  } catch (error: any) {
    console.error("[WhatsApp] Request failed:", error);
    return { success: false, error: error?.message || error };
  }
}

export interface SendTemplateOptions {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParameters?: string[];
  headerUrl?: string;
  documentFilename?: string;
  customerName?: string;
  previewText?: string;
}

function isTemplateHeaderMismatchError(data: any): boolean {
  const code = Number(data?.error?.code);
  if (code === 132000 || code === 132012 || code === 131008) {
    return true;
  }
  const combined = `${data?.error?.message || ""} ${data?.error?.error_data?.details || ""}`;
  return /header|component|document|parameter/i.test(combined);
}

/**
 * Send a WhatsApp Utility Template message (e.g. Invoices, Receipts) via Meta Cloud API
 */
export async function sendWhatsAppTemplate({
  to,
  templateName,
  languageCode = "ar",
  bodyParameters = [],
  headerUrl,
  documentFilename,
  customerName,
  previewText,
}: SendTemplateOptions) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.warn(
      "[WhatsApp] Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN in environment variables."
    );
    return {
      success: false,
      error: "يرجى ضبط بيانات WHATSAPP_PHONE_NUMBER_ID و WHATSAPP_ACCESS_TOKEN في إعدادات البيئة السحابية.",
    };
  }

  const recipient = formatPhoneNumber(to);
  if (!recipient || recipient.length < 9) {
    return {
      success: false,
      error: `رقم الهاتف غير صالح: ${to}`,
    };
  }

  const buildComponents = (docHeaderUrl?: string): WhatsAppTemplateComponent[] => {
    const components: WhatsAppTemplateComponent[] = [];
    if (docHeaderUrl) {
      components.push({
        type: "header",
        parameters: [
          {
            type: "document",
            document: {
              link: docHeaderUrl,
              filename: documentFilename || `${templateName}_${recipient}.pdf`,
            },
          },
        ],
      });
    }
    if (bodyParameters && bodyParameters.length > 0) {
      components.push({
        type: "body",
        parameters: bodyParameters.map((val) => ({
          type: "text",
          text: String(val ?? "").trim(),
        })),
      });
    }
    return components;
  };

  const postTemplate = async (components: WhatsAppTemplateComponent[]) => {
    const payload: WhatsAppTemplateMessagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
        ...(components.length > 0 ? { components } : {}),
      },
    };

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();
    return { ok: response.ok, data };
  };

  try {
    const cleanHeaderUrl = headerUrl ? String(headerUrl).trim() : "";

    let usedUrl: string | undefined = cleanHeaderUrl || undefined;
    let attempt = await postTemplate(buildComponents(usedUrl));

    if (!attempt.ok && cleanHeaderUrl && isTemplateHeaderMismatchError(attempt.data)) {
      console.warn(
        `[WhatsApp Template] "${templateName}" rejected headerUrl (still BODY-only in Meta). Retrying without header...`
      );
      usedUrl = undefined;
      attempt = await postTemplate(buildComponents(undefined));
    } else if (!attempt.ok && !cleanHeaderUrl && isTemplateHeaderMismatchError(attempt.data)) {
      // Meta template has a mandatory Document Header, so Meta won't allow template dispatch without PDF.
      // If customer has an open 24h window, send the exact message text directly without any PDF.
      const windowOpen = await isConversationWindowOpen(recipient);
      const fallbackText =
        previewText ||
        (bodyParameters.length > 0 ? `[${templateName}] ${bodyParameters.join(" | ")}` : "");
      if (windowOpen && fallbackText) {
        const directRes = await sendWhatsAppMessage(recipient, fallbackText, { customerName });
        if (directRes.success) {
          return {
            success: true,
            messageId: directRes.messageId,
            recorded: directRes.recorded,
            data: directRes.data,
          };
        }
      }

      return {
        success: false,
        missingMandatoryPdfHeader: true,
        error: `تعذر إرسال القالب بدون PDF لأن قالب (${templateName}) في Meta مضبوط بهيدر ملف PDF إلزامي؛ قم بإزالة هيدر الـ PDF من القالب في Meta أو انتظر تصدير الـ PDF من أونكس (أو راسل العميل بعد فتح نافذة الـ 24 ساعة).`,
        details: attempt.data,
      };
    }

    if (!attempt.ok) {
      console.error("[WhatsApp Template] API Error:", attempt.data);
      return { success: false, error: formatMetaApiError(attempt.data), details: attempt.data };
    }

    const messageId = attempt.data?.messages?.[0]?.id;
    const bodySummary =
      previewText ||
      (bodyParameters.length > 0 ? `[${templateName}] ${bodyParameters.join(" | ")}` : `[${templateName}]`);

    const recorded = await recordWhatsAppMessage({
      phone: recipient,
      customerName,
      waMessageId: messageId,
      direction: "out",
      msgType: "template",
      body: bodySummary,
      mediaUrl: usedUrl || null,
      mediaMime: usedUrl ? "application/pdf" : null,
      mediaFilename: usedUrl ? documentFilename || `${templateName}.pdf` : null,
      templateName,
      status: "sent",
    });

    return {
      success: true,
      messageId,
      recorded,
      data: attempt.data,
    };
  } catch (error: any) {
    console.error("[WhatsApp Template] Request exception:", error);
    return { success: false, error: error?.message || String(error) };
  }
}

/**
 * Upload a media binary (OGG/MP4 voice note, image, PDF, video) to Meta Cloud API /media
 */
export async function uploadMediaToMeta(params: {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return { success: false, error: "Missing WhatsApp credentials" };
  }

  try {
    const cleanMime = params.mimeType.split(";")[0].trim() || "application/octet-stream";
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", cleanMime);
    form.append(
      "file",
      new Blob([new Uint8Array(params.buffer)], { type: cleanMime }),
      params.filename || "media"
    );

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/media`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: form,
      }
    );

    const data = await response.json();
    if (!response.ok || !data?.id) {
      return { success: false, error: formatMetaApiError(data) };
    }
    return { success: true, mediaId: String(data.id) };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
}

/**
 * Download an inbound media binary from Meta Cloud API by its media_id
 */
export async function downloadMetaMedia(mediaId: string): Promise<{
  buffer: Buffer;
  mimeType: string;
} | null> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken || !mediaId) return null;

  try {
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(mediaId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) return null;
    const metaJson = await metaRes.json();
    const downloadUrl = metaJson?.url;
    if (!downloadUrl) return null;

    const fileRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!fileRes.ok) return null;

    const arrayBuf = await fileRes.arrayBuffer();
    const mimeType =
      metaJson?.mime_type ||
      fileRes.headers.get("content-type") ||
      "application/octet-stream";

    return {
      buffer: Buffer.from(arrayBuf),
      mimeType: String(mimeType).split(";")[0].trim(),
    };
  } catch (err) {
    console.warn("[WhatsApp] Failed to download inbound Meta media:", err);
    return null;
  }
}

/**
 * Send an outbound Image / Audio (Voice Note) / Video / Document via Meta Cloud API
 */
export async function sendWhatsAppMedia(params: {
  to: string;
  type: "image" | "audio" | "video" | "document";
  metaMediaId?: string;
  link?: string;
  caption?: string;
  filename?: string;
  isVoice?: boolean;
  localMediaUrl?: string;
  localMediaId?: string;
  mimeType?: string;
  replyToWaId?: string;
  customerName?: string;
}) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return { success: false, error: "Missing WhatsApp credentials" };
  }

  const recipient = formatPhoneNumber(params.to);
  if (!recipient) {
    return { success: false, error: "Invalid phone number" };
  }

  const mediaObject: Record<string, any> = params.metaMediaId
    ? { id: params.metaMediaId }
    : { link: params.link };

  if (params.caption && params.type !== "audio") {
    mediaObject.caption = params.caption;
  }
  if (params.type === "document" && params.filename) {
    mediaObject.filename = params.filename;
  }
  if (params.type === "audio" && params.isVoice) {
    mediaObject.voice = true;
  }

  const payload: Record<string, any> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: params.type,
    ...(params.replyToWaId ? { context: { message_id: params.replyToWaId } } : {}),
    [params.type]: mediaObject,
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("[WhatsApp Media] API Error:", data);
      return { success: false, error: formatMetaApiError(data), details: data };
    }

    const messageId = data?.messages?.[0]?.id;
    const recorded = await recordWhatsAppMessage({
      phone: recipient,
      customerName: params.customerName,
      waMessageId: messageId,
      direction: "out",
      msgType: params.type,
      body: params.caption || null,
      mediaId: params.localMediaId || params.metaMediaId || null,
      mediaUrl: params.localMediaUrl || params.link || null,
      mediaMime: params.mimeType || null,
      mediaFilename: params.filename || null,
      replyToWaId: params.replyToWaId || null,
      status: "sent",
    });

    return {
      success: true,
      messageId,
      recorded,
      data,
    };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
}
