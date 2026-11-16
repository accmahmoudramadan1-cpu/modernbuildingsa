/**
 * Helper utility for Meta WhatsApp Cloud API
 */

/**
 * Format Meta Graph API error payloads cleanly while exposing diagnostic codes
 * (error code, subcode, user message, and fbtrace_id) for fast troubleshooting.
 */
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
 * Clean and normalize phone number to WhatsApp international standard without '+'
 * Handles Saudi (+966), Egyptian (+20), and generic formats.
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return "";

  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, "");

  // If starts with 00, strip leading 00
  if (cleaned.startsWith("00")) {
    cleaned = cleaned.substring(2);
  }

  // Saudi Arabia: 05xxxxxxxx -> 9665xxxxxxxx
  if (cleaned.startsWith("05") && cleaned.length === 10) {
    cleaned = "966" + cleaned.substring(1);
  } else if (cleaned.startsWith("5") && cleaned.length === 9) {
    // 5xxxxxxxx -> 9665xxxxxxxx
    cleaned = "966" + cleaned;
  } else if (cleaned.startsWith("01") && cleaned.length === 11) {
    // Egypt: 010/011/012/015 -> 201xxxxxxxxx
    cleaned = "20" + cleaned.substring(1);
  }

  return cleaned;
}

/**
 * Send a WhatsApp text message via Meta WhatsApp Cloud API
 */
export async function sendWhatsAppMessage(to: string, bodyText: string) {
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
    text: {
      preview_url: false,
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

    return {
      success: true,
      messageId: data?.messages?.[0]?.id,
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
  headerUrl?: string; // Optional PDF or Image for invoices
  fallbackPdfUrl?: string; // Auto-attached if Meta template expects a Document Header
  documentFilename?: string;
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
  fallbackPdfUrl,
  documentFilename,
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
    const cleanFallbackUrl = fallbackPdfUrl ? String(fallbackPdfUrl).trim() : "";

    let attempt = await postTemplate(buildComponents(cleanHeaderUrl || undefined));

    // Case A: headerUrl provided, but Meta template is still BODY-only -> retry without header
    if (!attempt.ok && cleanHeaderUrl && isTemplateHeaderMismatchError(attempt.data)) {
      console.warn(
        `[WhatsApp Template] "${templateName}" rejected headerUrl (still BODY-only in Meta). Retrying without header...`
      );
      attempt = await postTemplate(buildComponents(undefined));
    }
    // Case B: no headerUrl provided, but Meta template was upgraded to require a Document Header -> retry with PDF
    else if (
      !attempt.ok &&
      !cleanHeaderUrl &&
      cleanFallbackUrl &&
      isTemplateHeaderMismatchError(attempt.data)
    ) {
      console.warn(
        `[WhatsApp Template] "${templateName}" requires a Document Header. Retrying with generated PDF (${cleanFallbackUrl})...`
      );
      attempt = await postTemplate(buildComponents(cleanFallbackUrl));
    }

    if (!attempt.ok) {
      console.error("[WhatsApp Template] API Error:", attempt.data);
      return { success: false, error: formatMetaApiError(attempt.data), details: attempt.data };
    }

    return {
      success: true,
      messageId: attempt.data?.messages?.[0]?.id,
      data: attempt.data,
    };
  } catch (error: any) {
    console.error("[WhatsApp Template] Request exception:", error);
    return { success: false, error: error?.message || String(error) };
  }
}
