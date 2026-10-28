/**
 * Helper utility for Meta WhatsApp Cloud API
 */

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
      return { success: false, error: data };
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

  const components: WhatsAppTemplateComponent[] = [];

  // 1. Header (e.g. Document PDF for invoice if provided)
  if (headerUrl) {
    components.push({
      type: "header",
      parameters: [
        {
          type: "document",
          document: {
            link: headerUrl,
            filename: `Invoice_${recipient}.pdf`,
          },
        },
      ],
    });
  }

  // 2. Body Parameters ({{1}}, {{2}}, {{3}}, etc.)
  if (bodyParameters && bodyParameters.length > 0) {
    components.push({
      type: "body",
      parameters: bodyParameters.map((val) => ({
        type: "text",
        text: String(val ?? "").trim(),
      })),
    });
  }

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
      console.error("[WhatsApp Template] API Error:", data);
      const errorMessage =
        data?.error?.message ||
        data?.error?.error_user_msg ||
        JSON.stringify(data);
      return { success: false, error: errorMessage, details: data };
    }

    return {
      success: true,
      messageId: data?.messages?.[0]?.id,
      data,
    };
  } catch (error: any) {
    console.error("[WhatsApp Template] Request exception:", error);
    return { success: false, error: error?.message || String(error) };
  }
}
