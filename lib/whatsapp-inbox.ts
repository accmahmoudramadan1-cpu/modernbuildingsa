import crypto from "crypto";
import { executeSql, isMysqlConfigured, queryRows } from "@/lib/mysql";
import { formatPhoneNumber, phoneSearchVariants } from "@/lib/whatsapp-phone";
import {
  extractTemplateParameters,
  formatTemplatePreviewText,
  getOnyxTemplate,
  type OnyxDocType,
} from "@/lib/onyx-templates";

export type WhatsAppMessageStatus = "sent" | "delivered" | "read" | "failed";
export type WhatsAppMessageDirection = "in" | "out";

export interface WhatsAppConversationRecord {
  phone: string;
  customer_name: string | null;
  last_message_text: string | null;
  last_message_type: string;
  last_message_direction: WhatsAppMessageDirection;
  last_message_status: WhatsAppMessageStatus;
  last_message_at: string;
  last_inbound_at: string | null;
  unread_count: number;
  is_window_open: boolean;
  window_expires_at: string | null;
}

export interface WhatsAppMessageRecord {
  id: string;
  phone: string;
  wa_message_id: string | null;
  direction: WhatsAppMessageDirection;
  msg_type: string;
  body: string | null;
  media_id: string | null;
  media_url: string | null;
  media_mime: string | null;
  media_filename: string | null;
  reply_to_wa_id: string | null;
  reply_preview: string | null;
  template_name: string | null;
  status: WhatsAppMessageStatus;
  error_text: string | null;
  created_at: string;
}

const STATUS_RANK: Record<string, number> = {
  failed: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

const WINDOW_MS = 24 * 60 * 60 * 1000;

function toMysqlDateTime(isoOrDate?: string | Date | null): string {
  const d =
    isoOrDate instanceof Date
      ? isoOrDate
      : isoOrDate
        ? new Date(isoOrDate)
        : new Date();
  const valid = Number.isNaN(d.getTime()) ? new Date() : d;
  return valid.toISOString().slice(0, 23).replace("T", " ");
}

function normalizeMysqlTimestampToIso(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const trimmed = String(ts).trim();
  if (!trimmed) return null;
  if (trimmed.endsWith("Z") || trimmed.includes("T")) {
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? trimmed : new Date(parsed).toISOString();
  }
  // MySQL DATETIME(3) stored as UTC via toMysqlDateTime
  const isoCandidate = trimmed.replace(" ", "T") + "Z";
  const parsed = Date.parse(isoCandidate);
  return Number.isNaN(parsed) ? trimmed : new Date(parsed).toISOString();
}

export function computeWindowState(lastInboundRaw: string | null | undefined): {
  is_window_open: boolean;
  window_expires_at: string | null;
} {
  const iso = normalizeMysqlTimestampToIso(lastInboundRaw);
  if (!iso) return { is_window_open: false, window_expires_at: null };
  const inboundMs = Date.parse(iso);
  if (Number.isNaN(inboundMs)) return { is_window_open: false, window_expires_at: null };
  const expiresMs = inboundMs + WINDOW_MS;
  return {
    is_window_open: Date.now() < expiresMs,
    window_expires_at: new Date(expiresMs).toISOString(),
  };
}

function buildTypePreviewLabel(msgType: string, body?: string | null, filename?: string | null): string {
  const text = String(body || "").trim();
  if (text) return text;
  switch (msgType) {
    case "image":
      return "صورة";
    case "audio":
      return "رسالة صوتية";
    case "video":
      return "فيديو";
    case "document":
      return filename ? `مستند: ${filename}` : "مستند PDF";
    case "sticker":
      return "ملصق";
    case "location":
      return "موقع جغرافي";
    case "contacts":
      return "جهة اتصال";
    case "template":
      return "رسالة قالب رسمي";
    default:
      return "رسالة";
  }
}

async function resolveContactName(phone: string, preferredName?: string | null): Promise<string | null> {
  if (preferredName && preferredName.trim()) {
    return preferredName.trim();
  }
  if (!isMysqlConfigured()) return null;

  try {
    const existing = await queryRows<any>(
      `SELECT customer_name FROM whatsapp_conversations WHERE phone = ? LIMIT 1`,
      [phone]
    );
    if (existing[0]?.customer_name) {
      return String(existing[0].customer_name);
    }

    const variants = phoneSearchVariants(phone);
    if (variants.length > 0) {
      const placeholders = variants.map(() => "?").join(", ");
      const invRows = await queryRows<any>(
        `SELECT customer_name FROM oracle_invoices WHERE phone IN (${placeholders}) ORDER BY created_at DESC LIMIT 1`,
        variants
      );
      if (invRows[0]?.customer_name) {
        return String(invRows[0].customer_name);
      }
    }
  } catch {
    // Ignore lookup fallback errors
  }
  return null;
}

export interface RecordMessageInput {
  phone: string;
  customerName?: string | null;
  waMessageId?: string | null;
  direction: WhatsAppMessageDirection;
  msgType: string;
  body?: string | null;
  mediaId?: string | null;
  mediaUrl?: string | null;
  mediaMime?: string | null;
  mediaFilename?: string | null;
  replyToWaId?: string | null;
  replyPreview?: string | null;
  templateName?: string | null;
  status?: WhatsAppMessageStatus;
  errorText?: string | null;
  createdAt?: string | Date | null;
}

export async function recordWhatsAppMessage(
  input: RecordMessageInput
): Promise<WhatsAppMessageRecord | null> {
  const normPhone = formatPhoneNumber(input.phone);
  if (!normPhone || !isMysqlConfigured()) return null;

  const id = crypto.randomUUID();
  const status: WhatsAppMessageStatus =
    input.status || (input.direction === "in" ? "read" : "sent");
  const createdMysql = toMysqlDateTime(input.createdAt || new Date());
  const previewText = buildTypePreviewLabel(
    input.msgType,
    input.body,
    input.mediaFilename
  );

  let replyPreview = input.replyPreview ? String(input.replyPreview).trim() : null;
  if (!replyPreview && input.replyToWaId) {
    try {
      const refRows = await queryRows<any>(
        `SELECT direction, msg_type, body, media_filename FROM whatsapp_messages WHERE wa_message_id = ? LIMIT 1`,
        [input.replyToWaId]
      );
      if (refRows.length > 0) {
        const who = refRows[0].direction === "out" ? "أنت" : "العميل";
        const snippet = buildTypePreviewLabel(
          refRows[0].msg_type,
          refRows[0].body,
          refRows[0].media_filename
        ).slice(0, 80);
        replyPreview = `${who} • ${snippet}`;
      }
    } catch {
      // Ignore reply preview lookup error
    }
  }

  try {
    const resolvedName = await resolveContactName(normPhone, input.customerName);

    await executeSql(
      `INSERT INTO whatsapp_messages (
         id, phone, wa_message_id, direction, msg_type, body,
         media_id, media_url, media_mime, media_filename,
         reply_to_wa_id, reply_preview, template_name, status, error_text,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE
         status = IF(
           status = 'read' OR (status = 'delivered' AND VALUES(status) = 'sent'),
           status,
           VALUES(status)
         ),
         updated_at = NOW(3)`,
      [
        id,
        normPhone,
        input.waMessageId || null,
        input.direction,
        input.msgType || "text",
        input.body ?? null,
        input.mediaId ?? null,
        input.mediaUrl ?? null,
        input.mediaMime ?? null,
        input.mediaFilename ?? null,
        input.replyToWaId ?? null,
        replyPreview,
        input.templateName ?? null,
        status,
        input.errorText ?? null,
        createdMysql,
      ]
    );

    const inboundInc = input.direction === "in" ? 1 : 0;
    const inboundTs = input.direction === "in" ? createdMysql : null;

    await executeSql(
      `INSERT INTO whatsapp_conversations (
         phone, customer_name, last_message_text, last_message_type,
         last_message_direction, last_message_status, last_message_at,
         last_inbound_at, unread_count, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE
         customer_name = COALESCE(NULLIF(VALUES(customer_name), ''), customer_name),
         last_message_text = IF(VALUES(last_message_at) >= last_message_at, VALUES(last_message_text), last_message_text),
         last_message_type = IF(VALUES(last_message_at) >= last_message_at, VALUES(last_message_type), last_message_type),
         last_message_direction = IF(VALUES(last_message_at) >= last_message_at, VALUES(last_message_direction), last_message_direction),
         last_message_status = IF(VALUES(last_message_at) >= last_message_at, VALUES(last_message_status), last_message_status),
         last_message_at = GREATEST(last_message_at, VALUES(last_message_at)),
         last_inbound_at = COALESCE(
           IF(
             last_inbound_at IS NULL OR (VALUES(last_inbound_at) IS NOT NULL AND VALUES(last_inbound_at) > last_inbound_at),
             VALUES(last_inbound_at),
             last_inbound_at
           ),
           last_inbound_at
         ),
         unread_count = unread_count + VALUES(unread_count),
         updated_at = NOW(3)`,
      [
        normPhone,
        resolvedName,
        previewText.slice(0, 500),
        input.msgType || "text",
        input.direction,
        status,
        createdMysql,
        inboundTs,
        inboundInc,
      ]
    );

    return {
      id,
      phone: normPhone,
      wa_message_id: input.waMessageId || null,
      direction: input.direction,
      msg_type: input.msgType || "text",
      body: input.body ?? null,
      media_id: input.mediaId ?? null,
      media_url: input.mediaUrl ?? null,
      media_mime: input.mediaMime ?? null,
      media_filename: input.mediaFilename ?? null,
      reply_to_wa_id: input.replyToWaId ?? null,
      reply_preview: replyPreview,
      template_name: input.templateName ?? null,
      status,
      error_text: input.errorText ?? null,
      created_at: normalizeMysqlTimestampToIso(createdMysql) || new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[WhatsApp Inbox] Failed to record message:", err);
    return null;
  }
}

export async function updateWhatsAppMessageStatus(params: {
  waMessageId: string;
  status: string;
  errorText?: string | null;
}): Promise<void> {
  if (!isMysqlConfigured() || !params.waMessageId) return;

  const rawStatus = String(params.status || "").toLowerCase();
  const normalizedStatus: WhatsAppMessageStatus =
    rawStatus === "read"
      ? "read"
      : rawStatus === "delivered"
        ? "delivered"
        : rawStatus === "failed"
          ? "failed"
          : "sent";

  try {
    const rows = await queryRows<any>(
      `SELECT id, phone, status, created_at FROM whatsapp_messages WHERE wa_message_id = ? LIMIT 1`,
      [params.waMessageId]
    );

    if (rows.length > 0) {
      const current = rows[0];
      const curRank = STATUS_RANK[current.status] ?? 1;
      const newRank = STATUS_RANK[normalizedStatus] ?? 1;

      if (normalizedStatus === "failed" || newRank > curRank) {
        await executeSql(
          `UPDATE whatsapp_messages SET status = ?, error_text = COALESCE(?, error_text), updated_at = NOW(3) WHERE id = ?`,
          [normalizedStatus, params.errorText || null, current.id]
        );

        // Update conversation preview tick status if this message is the latest outbound one
        const convRows = await queryRows<any>(
          `SELECT last_message_direction, last_message_at FROM whatsapp_conversations WHERE phone = ? LIMIT 1`,
          [current.phone]
        );
        if (convRows.length > 0 && convRows[0].last_message_direction === "out") {
          const msgTime = Date.parse(normalizeMysqlTimestampToIso(current.created_at) || "");
          const convTime = Date.parse(
            normalizeMysqlTimestampToIso(convRows[0].last_message_at) || ""
          );
          if (Number.isNaN(msgTime) || Number.isNaN(convTime) || Math.abs(convTime - msgTime) <= 2000) {
            await executeSql(
              `UPDATE whatsapp_conversations SET last_message_status = ?, updated_at = NOW(3) WHERE phone = ?`,
              [normalizedStatus, current.phone]
            );
          }
        }
      }
    }

    if (normalizedStatus === "failed") {
      await executeSql(
        `UPDATE oracle_invoices SET status = 'failed', updated_at = NOW(3) WHERE whatsapp_message_id = ?`,
        [params.waMessageId]
      ).catch(() => {});
    }
  } catch (err) {
    console.warn("[WhatsApp Inbox] Failed to update status:", err);
  }
}

declare global {
  var __waOracleBackfillPromise: Promise<void> | undefined;
}

async function runHistoricalOracleBackfill(): Promise<void> {
  try {
    const countRows = await queryRows<any>(
      `SELECT COUNT(*) AS c FROM whatsapp_conversations`
    );
    const convCount = Number(countRows[0]?.c || 0);
    if (convCount > 3) return;

    const missing = await queryRows<any>(
      `SELECT o.invoice_number, o.doc_type, o.customer_name, o.phone,
              o.invoice_date, o.amount, o.currency, o.remaining_balance,
              o.payment_method, o.attachment_url, o.details, o.status,
              o.whatsapp_message_id, o.sent_at, o.created_at
       FROM oracle_invoices o
       WHERE o.status IN ('sent', 'failed')
         AND o.whatsapp_message_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM whatsapp_messages m WHERE m.wa_message_id = o.whatsapp_message_id
         )
       ORDER BY COALESCE(o.sent_at, o.created_at) ASC
       LIMIT 300`
    );

    for (const row of missing) {
      const docType = (row.doc_type || "cash_invoice") as OnyxDocType;
      const tpl = getOnyxTemplate(docType);
      const params = extractTemplateParameters(docType, row);
      const bodyText = formatTemplatePreviewText(docType, params);
      const attachUrl = row.attachment_url ? String(row.attachment_url).trim() : null;

      await recordWhatsAppMessage({
        phone: String(row.phone),
        customerName: row.customer_name ? String(row.customer_name) : null,
        waMessageId: String(row.whatsapp_message_id),
        direction: "out",
        msgType: attachUrl ? "document" : "template",
        body: bodyText,
        mediaUrl: attachUrl,
        mediaMime: attachUrl ? "application/pdf" : null,
        mediaFilename: attachUrl ? `${row.invoice_number}.pdf` : null,
        templateName: tpl.defaultMetaTemplateName,
        status: row.status === "failed" ? "failed" : "sent",
        createdAt: row.sent_at || row.created_at || new Date(),
      });
    }
  } catch (err) {
    globalThis.__waOracleBackfillPromise = undefined;
    console.warn("[WhatsApp Inbox] Historical Oracle backfill skipped:", err);
  }
}

async function ensureHistoricalOracleBackfill(): Promise<void> {
  if (!isMysqlConfigured()) return;
  if (!globalThis.__waOracleBackfillPromise) {
    globalThis.__waOracleBackfillPromise = runHistoricalOracleBackfill();
  }
  await globalThis.__waOracleBackfillPromise;
}

export async function getInboxConversations(
  search?: string
): Promise<WhatsAppConversationRecord[]> {
  if (!isMysqlConfigured()) return [];

  await ensureHistoricalOracleBackfill();

  try {
    const trimmed = String(search || "").trim();
    const rows = trimmed
      ? await queryRows<any>(
          `SELECT phone, customer_name, last_message_text, last_message_type,
                  last_message_direction, last_message_status, last_message_at,
                  last_inbound_at, unread_count
           FROM whatsapp_conversations
           WHERE phone LIKE ? OR COALESCE(customer_name, '') LIKE ? OR COALESCE(last_message_text, '') LIKE ?
           ORDER BY last_message_at DESC
           LIMIT 150`,
          [`%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`]
        )
      : await queryRows<any>(
          `SELECT phone, customer_name, last_message_text, last_message_type,
                  last_message_direction, last_message_status, last_message_at,
                  last_inbound_at, unread_count
           FROM whatsapp_conversations
           ORDER BY last_message_at DESC
           LIMIT 150`
        );

    return rows.map((row: any) => {
      const win = computeWindowState(row.last_inbound_at);
      return {
        phone: String(row.phone),
        customer_name: row.customer_name ? String(row.customer_name) : null,
        last_message_text: row.last_message_text ? String(row.last_message_text) : null,
        last_message_type: String(row.last_message_type || "text"),
        last_message_direction: (row.last_message_direction || "out") as WhatsAppMessageDirection,
        last_message_status: (row.last_message_status || "sent") as WhatsAppMessageStatus,
        last_message_at:
          normalizeMysqlTimestampToIso(row.last_message_at) || new Date().toISOString(),
        last_inbound_at: normalizeMysqlTimestampToIso(row.last_inbound_at),
        unread_count: Number(row.unread_count || 0),
        is_window_open: win.is_window_open,
        window_expires_at: win.window_expires_at,
      };
    });
  } catch (err) {
    console.warn("[WhatsApp Inbox] Failed to load conversations:", err);
    return [];
  }
}

export async function getConversationDetail(rawPhone: string): Promise<{
  conversation: WhatsAppConversationRecord | null;
  messages: WhatsAppMessageRecord[];
  relatedInvoices: any[];
}> {
  const normPhone = formatPhoneNumber(rawPhone);
  if (!normPhone || !isMysqlConfigured()) {
    return { conversation: null, messages: [], relatedInvoices: [] };
  }

  await executeSql(
    `UPDATE whatsapp_conversations SET unread_count = 0 WHERE phone = ? AND unread_count > 0`,
    [normPhone]
  ).catch(() => {});

  const convRows = await queryRows<any>(
    `SELECT phone, customer_name, last_message_text, last_message_type,
            last_message_direction, last_message_status, last_message_at,
            last_inbound_at, unread_count
     FROM whatsapp_conversations
     WHERE phone = ?
     LIMIT 1`,
    [normPhone]
  );

  const msgRows = await queryRows<any>(
    `SELECT id, phone, wa_message_id, direction, msg_type, body,
            media_id, media_url, media_mime, media_filename,
            reply_to_wa_id, reply_preview, template_name, status, error_text, created_at
     FROM whatsapp_messages
     WHERE phone = ?
     ORDER BY created_at ASC
     LIMIT 300`,
    [normPhone]
  );

  const variants = phoneSearchVariants(normPhone);
  let relatedInvoices: any[] = [];
  if (variants.length > 0) {
    const placeholders = variants.map(() => "?").join(", ");
    const rows = await queryRows<any>(
      `SELECT o.invoice_number, o.doc_type, o.customer_name, o.phone, o.invoice_date,
              o.amount, o.currency, o.remaining_balance, o.payment_method,
              o.attachment_url, o.details, o.status,
              (p.invoice_number IS NOT NULL) AS has_pdf_blob
       FROM oracle_invoices o
       LEFT JOIN oracle_pdfs p ON p.invoice_number = o.invoice_number
       WHERE o.phone IN (${placeholders})
       ORDER BY o.created_at DESC
       LIMIT 30`,
      variants
    ).catch(() => []);
    relatedInvoices = rows.map(mapOracleInvoiceWithPdf);
  }

  const convRow = convRows[0];
  let conversation: WhatsAppConversationRecord | null = null;
  if (convRow) {
    const win = computeWindowState(convRow.last_inbound_at);
    conversation = {
      phone: String(convRow.phone),
      customer_name: convRow.customer_name ? String(convRow.customer_name) : null,
      last_message_text: convRow.last_message_text ? String(convRow.last_message_text) : null,
      last_message_type: String(convRow.last_message_type || "text"),
      last_message_direction: (convRow.last_message_direction || "out") as WhatsAppMessageDirection,
      last_message_status: (convRow.last_message_status || "sent") as WhatsAppMessageStatus,
      last_message_at:
        normalizeMysqlTimestampToIso(convRow.last_message_at) || new Date().toISOString(),
      last_inbound_at: normalizeMysqlTimestampToIso(convRow.last_inbound_at),
      unread_count: 0,
      is_window_open: win.is_window_open,
      window_expires_at: win.window_expires_at,
    };
  } else {
    conversation = {
      phone: normPhone,
      customer_name: relatedInvoices[0]?.customer_name || null,
      last_message_text: null,
      last_message_type: "text",
      last_message_direction: "out",
      last_message_status: "sent",
      last_message_at: new Date().toISOString(),
      last_inbound_at: null,
      unread_count: 0,
      is_window_open: false,
      window_expires_at: null,
    };
  }

  const messages: WhatsAppMessageRecord[] = msgRows.map((m: any) => ({
    id: String(m.id),
    phone: String(m.phone),
    wa_message_id: m.wa_message_id ? String(m.wa_message_id) : null,
    direction: (m.direction || "out") as WhatsAppMessageDirection,
    msg_type: String(m.msg_type || "text"),
    body: m.body !== null && m.body !== undefined ? String(m.body) : null,
    media_id: m.media_id ? String(m.media_id) : null,
    media_url: m.media_url ? String(m.media_url) : null,
    media_mime: m.media_mime ? String(m.media_mime) : null,
    media_filename: m.media_filename ? String(m.media_filename) : null,
    reply_to_wa_id: m.reply_to_wa_id ? String(m.reply_to_wa_id) : null,
    reply_preview: m.reply_preview ? String(m.reply_preview) : null,
    template_name: m.template_name ? String(m.template_name) : null,
    status: (m.status || "sent") as WhatsAppMessageStatus,
    error_text: m.error_text ? String(m.error_text) : null,
    created_at: normalizeMysqlTimestampToIso(m.created_at) || new Date().toISOString(),
  }));

  return { conversation, messages, relatedInvoices };
}

export async function deleteConversation(rawPhone: string): Promise<void> {
  const normPhone = formatPhoneNumber(rawPhone);
  if (!normPhone || !isMysqlConfigured()) return;
  await executeSql(`DELETE FROM whatsapp_messages WHERE phone = ?`, [normPhone]);
  await executeSql(`DELETE FROM whatsapp_conversations WHERE phone = ?`, [normPhone]);
}

export async function deleteSelectedMessages(rawPhone: string, ids: string[]): Promise<void> {
  const normPhone = formatPhoneNumber(rawPhone);
  if (!normPhone || !ids.length || !isMysqlConfigured()) return;
  const placeholders = ids.map(() => "?").join(", ");
  await executeSql(
    `DELETE FROM whatsapp_messages WHERE phone = ? AND id IN (${placeholders})`,
    [normPhone, ...ids]
  );

  // Recompute conversation preview from newest remaining message
  const latest = await queryRows<any>(
    `SELECT direction, msg_type, body, media_filename, status, created_at
     FROM whatsapp_messages
     WHERE phone = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [normPhone]
  );

  if (latest.length > 0) {
    const m = latest[0];
    const txt = buildTypePreviewLabel(m.msg_type, m.body, m.media_filename);
    await executeSql(
      `UPDATE whatsapp_conversations
       SET last_message_text = ?, last_message_type = ?, last_message_direction = ?,
           last_message_status = ?, last_message_at = ?, updated_at = NOW(3)
       WHERE phone = ?`,
      [txt.slice(0, 500), m.msg_type, m.direction, m.status, m.created_at, normPhone]
    );
  } else {
    await executeSql(
      `UPDATE whatsapp_conversations SET last_message_text = NULL WHERE phone = ?`,
      [normPhone]
    );
  }
}

export function buildOnyxPdfPublicUrl(invoiceNumber: string): string {
  const base =
    (process.env.NEXT_PUBLIC_SITE_URL || "https://www.modernbuildingsa.com").replace(/\/+$/, "");
  return `${base}/api/oracle-orders/pdf/${encodeURIComponent(String(invoiceNumber).trim())}`;
}

function mapOracleInvoiceWithPdf(row: any) {
  const invNum = String(row.invoice_number || "").trim();
  const explicitUrl = row.attachment_url ? String(row.attachment_url).trim() : "";
  const hasPdfBlob = Boolean(Number(row.has_pdf_blob || 0));
  const resolvedPdfUrl = explicitUrl || (hasPdfBlob && invNum ? buildOnyxPdfPublicUrl(invNum) : null);

  return {
    invoice_number: invNum,
    doc_type: String(row.doc_type || "cash_invoice"),
    customer_name: row.customer_name ? String(row.customer_name) : "",
    phone: row.phone ? String(row.phone) : "",
    invoice_date: row.invoice_date ? String(row.invoice_date) : "",
    amount: Number(row.amount ?? 0),
    currency: row.currency ? String(row.currency) : "ر.س",
    remaining_balance:
      row.remaining_balance !== null && row.remaining_balance !== undefined
        ? Number(row.remaining_balance)
        : null,
    payment_method: row.payment_method ? String(row.payment_method) : null,
    attachment_url: resolvedPdfUrl,
    has_onyx_pdf: Boolean(resolvedPdfUrl),
    details: row.details ? String(row.details) : "",
    status: row.status ? String(row.status) : "pending",
  };
}

export async function lookupOracleInvoiceWithPdf(invoiceNumber: string) {
  const cleanNum = String(invoiceNumber || "").trim();
  if (!cleanNum || !isMysqlConfigured()) return null;

  try {
    const rows = await queryRows<any>(
      `SELECT o.invoice_number, o.doc_type, o.customer_name, o.phone, o.invoice_date,
              o.amount, o.currency, o.remaining_balance, o.payment_method,
              o.attachment_url, o.details, o.status,
              (p.invoice_number IS NOT NULL) AS has_pdf_blob
       FROM oracle_invoices o
       LEFT JOIN oracle_pdfs p ON p.invoice_number = o.invoice_number
       WHERE o.invoice_number = ?
       LIMIT 1`,
      [cleanNum]
    );
    if (rows.length > 0) {
      return mapOracleInvoiceWithPdf(rows[0]);
    }

    // Also check oracle_pdfs directly in case PDF was uploaded before invoice metadata sync
    const pdfRows = await queryRows<any>(
      `SELECT invoice_number, created_at FROM oracle_pdfs WHERE invoice_number = ? LIMIT 1`,
      [cleanNum]
    );
    if (pdfRows.length > 0) {
      return {
        invoice_number: cleanNum,
        doc_type: "cash_invoice",
        customer_name: "",
        phone: "",
        invoice_date: new Date().toISOString().slice(0, 10),
        amount: 0,
        currency: "ر.س",
        remaining_balance: null,
        payment_method: null,
        attachment_url: buildOnyxPdfPublicUrl(cleanNum),
        has_onyx_pdf: true,
        details: "",
        status: "pending",
      };
    }
  } catch (err) {
    console.warn("[WhatsApp Inbox] Invoice lookup failed:", err);
  }
  return null;
}

export async function getRecentOnyxPdfInvoices(limit = 20) {
  if (!isMysqlConfigured()) return [];
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));
  try {
    const rows = await queryRows<any>(
      `SELECT o.invoice_number, o.doc_type, o.customer_name, o.phone, o.invoice_date,
              o.amount, o.currency, o.remaining_balance, o.payment_method,
              o.attachment_url, o.details, o.status,
              1 AS has_pdf_blob
       FROM oracle_invoices o
       LEFT JOIN oracle_pdfs p ON p.invoice_number = o.invoice_number
       WHERE (o.attachment_url IS NOT NULL AND o.attachment_url <> '')
          OR p.invoice_number IS NOT NULL
       ORDER BY COALESCE(p.created_at, o.created_at) DESC
       LIMIT ${safeLimit}`
    );
    return rows.map(mapOracleInvoiceWithPdf);
  } catch (err) {
    console.warn("[WhatsApp Inbox] Failed to load PDF invoices:", err);
    return [];
  }
}

export async function saveMediaToMysql(params: {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}): Promise<string | null> {
  if (!isMysqlConfigured()) return null;
  const id = crypto.randomUUID();
  const safeName =
    params.filename.replace(/[^A-Za-z0-9_.-]/g, "_") || `${id}.bin`;
  await executeSql(
    `INSERT INTO media_files (id, filename, mime_type, file_data, size_bytes, created_at)
     VALUES (?, ?, ?, ?, ?, NOW(3))`,
    [id, safeName, params.mimeType, params.buffer, params.buffer.length]
  );
  return id;
}
