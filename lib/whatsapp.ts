/**
 * Helper utility for Meta WhatsApp Cloud API
 */

export interface WhatsAppMessagePayload {
  messaging_product: "whatsapp";
  to: string;
  type: "text" | "template";
  text?: {
    preview_url?: boolean;
    body: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: any[];
  };
}

/**
 * Clean phone number to WhatsApp international standard (e.g. 96650xxxxxxx or 2010xxxxxxxx)
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, "");

  // If starts with 05 in Saudi Arabia, convert to 9665
  if (cleaned.startsWith("05") && cleaned.length === 10) {
    cleaned = "966" + cleaned.substring(1);
  } else if (cleaned.startsWith("01") && cleaned.length === 11) {
    // Egyptian mobile numbers (010, 011, 012, 015)
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

  const payload: WhatsAppMessagePayload = {
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

    return { success: true, data };
  } catch (error) {
    console.error("[WhatsApp] Request failed:", error);
    return { success: false, error };
  }
}
