/**
 * Helper utility for Meta WhatsApp Cloud API
 */
import { formatPhoneNumber } from "@/lib/whatsapp-phone";
import { diagnosePhoneFormatIssue } from "@/lib/whatsapp-errors";
import { recordWhatsAppMessage } from "@/lib/whatsapp-inbox";
import {
  extractOraclePdfInvoiceNumber,
  getRepairedOnyxPdf,
} from "@/lib/oracle-pdfs";

function validateRecipientPhone(to: string): { recipient?: string; error?: string } {
  const recipient = formatPhoneNumber(to);
  const issue = diagnosePhoneFormatIssue(recipient || to);
  if (issue || !recipient) {
    return {
      error: `${issue || `رقم الهاتف غير صالح: ${to}`} [invalid_phone_format]`,
    };
  }
  return { recipient };
}

async function resolveTemplateDocumentMediaId(
  headerUrl: string,
  filename: string
): Promise<string | undefined> {
  try {
    let buffer: Buffer | null = null;
    let mimeType = "application/pdf";

    const invoiceNumber = extractOraclePdfInvoiceNumber(headerUrl);
    if (invoiceNumber) {
      const repaired = await getRepairedOnyxPdf(invoiceNumber);
      if (repaired) {
        buffer = repaired.buffer;
        mimeType = repaired.mimeType;
      }
    } else if (/^https?:\/\//i.test(headerUrl)) {
      const res = await fetch(headerUrl, {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const arrBuf = await res.arrayBuffer();
        if (arrBuf.byteLength > 0) {
          buffer = Buffer.from(arrBuf);
          const ct = res.headers.get("content-type");
          if (ct) mimeType = ct.split(";")[0].trim() || mimeType;
        }
      }
    }

    if (!buffer || buffer.length === 0) return undefined;

    const uploadRes = await uploadMediaToMeta({ buffer, mimeType, filename });
    if (uploadRes.success && uploadRes.mediaId) {
      console.log(
        `[WhatsApp Template] Pre-uploaded "${filename}" (${buffer.length} bytes) to Meta media_id=${uploadRes.mediaId}`
      );
      return uploadRes.mediaId;
    }

    console.warn(
      `[WhatsApp Template] Meta media upload failed for "${filename}", falling back to link: ${uploadRes.error || "unknown"}`
    );
    return undefined;
  } catch (err: any) {
    console.warn(
      `[WhatsApp Template] Direct media upload error for "${filename}":`,
      err?.message || err
    );
    return undefined;
  }
}

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

  const phoneCheck = validateRecipientPhone(to);
  if (!phoneCheck.recipient) {
    return { success: false, error: phoneCheck.error || "Invalid phone number" };
  }
  const recipient = phoneCheck.recipient;

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

  const phoneCheck = validateRecipientPhone(to);
  if (!phoneCheck.recipient) {
    return {
      success: false,
      error: phoneCheck.error || `رقم الهاتف غير صالح: ${to}`,
    };
  }
  const recipient = phoneCheck.recipient;

  const resolvedFilename = documentFilename || `${templateName}_${recipient}.pdf`;

  const buildComponents = (
    docHeader?: { id?: string; link?: string }
  ): WhatsAppTemplateComponent[] => {
    const components: WhatsAppTemplateComponent[] = [];
    if (docHeader && (docHeader.id || docHeader.link)) {
      components.push({
        type: "header",
        parameters: [
          {
            type: "document",
            document: docHeader.id
              ? {
                  id: docHeader.id,
                  filename: resolvedFilename,
                }
              : {
                  link: docHeader.link,
                  filename: resolvedFilename,
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
    let usedMediaId: string | undefined;

    if (cleanHeaderUrl) {
      usedMediaId = await resolveTemplateDocumentMediaId(
        cleanHeaderUrl,
        resolvedFilename
      );
    }

    const docHeader = usedMediaId
      ? { id: usedMediaId }
      : usedUrl
        ? { link: usedUrl }
        : undefined;

    let attempt = await postTemplate(buildComponents(docHeader));

    if (!attempt.ok && cleanHeaderUrl && isTemplateHeaderMismatchError(attempt.data)) {
      console.warn(
        `[WhatsApp Template] "${templateName}" rejected headerUrl (still BODY-only in Meta). Retrying without header...`
      );
      usedUrl = undefined;
      usedMediaId = undefined;
      attempt = await postTemplate(buildComponents(undefined));
    } else if (!attempt.ok && !cleanHeaderUrl && isTemplateHeaderMismatchError(attempt.data)) {
      return {
        success: false,
        missingMandatoryPdfHeader: true,
        error: `تعذر إرسال القالب بدون PDF لأن قالب (${templateName}) في Meta يشترط إرفاق ملف PDF؛ تأكد من تصدير الـ PDF من أونكس أولاً (أو فعّل خيار إرسال الرسائل SEND_MSG في بطاقة العميل).`,
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

    const hasDoc = Boolean(usedUrl || usedMediaId);
    const recorded = await recordWhatsAppMessage({
      phone: recipient,
      customerName,
      waMessageId: messageId,
      direction: "out",
      msgType: "template",
      body: bodySummary,
      mediaId: usedMediaId || null,
      mediaUrl: usedUrl || null,
      mediaMime: hasDoc ? "application/pdf" : null,
      mediaFilename: hasDoc ? documentFilename || `${templateName}.pdf` : null,
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

  const phoneCheck = validateRecipientPhone(params.to);
  if (!phoneCheck.recipient) {
    return { success: false, error: phoneCheck.error || "Invalid phone number" };
  }
  const recipient = phoneCheck.recipient;

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
