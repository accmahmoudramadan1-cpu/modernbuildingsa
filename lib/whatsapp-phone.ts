/**
 * Clean and normalize phone number to WhatsApp international standard without '+'
 * Handles Saudi (+966), Egyptian (+20), and generic formats.
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return "";

  let cleaned = String(phone).replace(/\D/g, "");

  if (cleaned.startsWith("00")) {
    cleaned = cleaned.substring(2);
  }

  if (cleaned.startsWith("05") && cleaned.length === 10) {
    cleaned = "966" + cleaned.substring(1);
  } else if (cleaned.startsWith("5") && cleaned.length === 9) {
    cleaned = "966" + cleaned;
  } else if (cleaned.startsWith("01") && cleaned.length === 11) {
    cleaned = "20" + cleaned.substring(1);
  }

  return cleaned;
}

export function phoneSearchVariants(phone: string): string[] {
  const norm = formatPhoneNumber(phone);
  if (!norm) return [];
  const variants = new Set<string>([norm]);
  if (norm.startsWith("966") && norm.length === 12) {
    variants.add("0" + norm.slice(3));
    variants.add(norm.slice(3));
  } else if (norm.startsWith("20") && norm.length === 12) {
    variants.add("0" + norm.slice(2));
  }
  return Array.from(variants);
}
