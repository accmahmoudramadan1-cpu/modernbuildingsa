import { createClient as createSupabaseServerClient } from "@/lib/supabase-server";

export interface OracleInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  phone: string;
  invoice_date: string;
  amount: number | string;
  currency: string;
  details?: string;
  status: "pending" | "sent" | "failed";
  whatsapp_message_id?: string | null;
  sent_at?: string | null;
  created_at: string;
  updated_at?: string;
}

// In-memory fallback cache (used when Supabase table is not yet created or credentials missing)
let memoryInvoicesCache: OracleInvoice[] = [
  {
    id: "sample-1",
    invoice_number: "INV-2026-001",
    customer_name: "مؤسسة البناء الحديث للمقاولات",
    phone: "0554303422",
    invoice_date: new Date().toISOString().split("T")[0],
    amount: "4500.00",
    currency: "ر.س",
    details: "توريد مواد عزل وتشطيبات - دفعة أولى",
    status: "pending",
    whatsapp_message_id: null,
    sent_at: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "sample-2",
    invoice_number: "INV-2026-002",
    customer_name: "سعود بن فهد السبيعي",
    phone: "0558689100",
    invoice_date: new Date().toISOString().split("T")[0],
    amount: "1280.50",
    currency: "ر.س",
    details: "شراء سيراميك ورخام مستورد",
    status: "pending",
    whatsapp_message_id: null,
    sent_at: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "sample-3",
    invoice_number: "INV-2026-003",
    customer_name: "شركة آفاق العمران للتطوير",
    phone: "0501960009",
    invoice_date: new Date(Date.now() - 86400000).toISOString().split("T")[0],
    amount: "8950.00",
    currency: "ر.س",
    details: "فواتير حديد وإسمنت مقاوم",
    status: "sent",
    whatsapp_message_id: "wamid.SAMPLE_ID_MOCK_12345",
    sent_at: new Date(Date.now() - 40000000).toISOString(),
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

/**
 * Get all imported Oracle invoices
 */
export async function getOracleInvoices(): Promise<OracleInvoice[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("oracle_invoices")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data as OracleInvoice[];
    }
  } catch (err) {
    // Supabase table may not exist yet, fallback to cache
    console.warn("[OracleInvoices] Supabase query skipped or failed, using memory cache.");
  }

  return memoryInvoicesCache;
}

/**
 * Upsert invoices imported from Oracle (OraNT)
 */
export async function upsertOracleInvoices(
  incomingInvoices: Partial<OracleInvoice>[]
): Promise<{ success: boolean; count: number; error?: string }> {
  if (!Array.isArray(incomingInvoices) || incomingInvoices.length === 0) {
    return { success: true, count: 0 };
  }

  const now = new Date().toISOString();
  const formatted: OracleInvoice[] = incomingInvoices.map((item, idx) => ({
    id: item.id || `ora-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
    invoice_number: String(item.invoice_number || "").trim() || `INV-${Date.now()}-${idx}`,
    customer_name: String(item.customer_name || "عميل غير محدد").trim(),
    phone: String(item.phone || "").trim(),
    invoice_date: item.invoice_date || now.split("T")[0],
    amount: item.amount ?? 0,
    currency: item.currency || "ر.س",
    details: item.details || "",
    status: item.status || "pending",
    whatsapp_message_id: item.whatsapp_message_id || null,
    sent_at: item.sent_at || null,
    created_at: item.created_at || now,
    updated_at: now,
  }));

  // Try saving to Supabase first
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("oracle_invoices")
      .upsert(formatted, { onConflict: "invoice_number" });

    if (!error) {
      // Sync memory cache
      for (const item of formatted) {
        const existingIdx = memoryInvoicesCache.findIndex(
          (x) => x.invoice_number === item.invoice_number
        );
        if (existingIdx >= 0) {
          memoryInvoicesCache[existingIdx] = { ...memoryInvoicesCache[existingIdx], ...item };
        } else {
          memoryInvoicesCache.unshift(item);
        }
      }
      return { success: true, count: formatted.length };
    }
  } catch (err: any) {
    console.warn("[OracleInvoices] Supabase upsert error, falling back to memory:", err?.message);
  }

  // Update memory cache
  for (const item of formatted) {
    const existingIdx = memoryInvoicesCache.findIndex(
      (x) => x.invoice_number === item.invoice_number
    );
    if (existingIdx >= 0) {
      memoryInvoicesCache[existingIdx] = { ...memoryInvoicesCache[existingIdx], ...item };
    } else {
      memoryInvoicesCache.unshift(item);
    }
  }

  return { success: true, count: formatted.length };
}

/**
 * Update invoice status after sending WhatsApp message
 */
export async function updateInvoiceWhatsAppStatus({
  invoiceNumber,
  status,
  messageId,
}: {
  invoiceNumber: string;
  status: "sent" | "failed" | "pending";
  messageId?: string;
}): Promise<boolean> {
  const now = new Date().toISOString();

  // Try updating in Supabase
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("oracle_invoices")
      .update({
        status,
        whatsapp_message_id: messageId || null,
        sent_at: status === "sent" ? now : null,
        updated_at: now,
      })
      .eq("invoice_number", invoiceNumber);

    if (!error) {
      // Also update memory cache
      const item = memoryInvoicesCache.find((x) => x.invoice_number === invoiceNumber);
      if (item) {
        item.status = status;
        item.whatsapp_message_id = messageId || null;
        item.sent_at = status === "sent" ? now : null;
      }
      return true;
    }
  } catch (err) {
    console.warn("[OracleInvoices] Supabase update status error, updating memory cache only.");
  }

  // Update memory cache
  const item = memoryInvoicesCache.find((x) => x.invoice_number === invoiceNumber);
  if (item) {
    item.status = status;
    item.whatsapp_message_id = messageId || null;
    item.sent_at = status === "sent" ? now : null;
    return true;
  }

  return false;
}
