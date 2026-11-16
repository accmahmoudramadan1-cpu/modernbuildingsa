"use client";

import type { ReactNode } from "react";
import type {
  WhatsAppConversationRecord,
  WhatsAppMessageRecord,
  WhatsAppMessageStatus,
} from "@/lib/whatsapp-inbox";
import type { OnyxDocType } from "@/lib/onyx-templates";

export interface RelatedOracleInvoice {
  id?: string;
  invoice_number: string;
  doc_type: OnyxDocType;
  customer_name: string;
  phone: string;
  invoice_date: string;
  amount: number | string;
  currency: string;
  remaining_balance?: number | string | null;
  payment_method?: string | null;
  attachment_url?: string | null;
  has_onyx_pdf?: boolean;
  details?: string;
  status: string;
  created_at?: string;
}

export type { WhatsAppConversationRecord, WhatsAppMessageRecord };

export function formatInboxDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  let hours = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, "0");
  const suffix = hours >= 12 ? "م" : "ص";
  hours = hours % 12 || 12;
  const hh = String(hours).padStart(2, "0");
  return `${year}/${month}/${day} ${hh}:${mins} ${suffix}`;
}

export function formatRemainingWindow(expiresAtIso: string | null | undefined): string {
  if (!expiresAtIso) return "";
  const diffMs = Date.parse(expiresAtIso) - Date.now();
  if (Number.isNaN(diffMs) || diffMs <= 0) return "";
  const totalMins = Math.floor(diffMs / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0) return `متبقي ${h} س و ${m} د`;
  return `متبقي ${m} دقيقة`;
}

/**
 * Renders text preserving line breaks and converting WhatsApp *bold* markers safely.
 */
export function renderWhatsAppFormattedText(text: string): ReactNode[] {
  const lines = text.split(/\r?\n/);
  return lines.map((line, lineIdx) => {
    const parts = line.split(/(\*[^*\n]{1,160}\*)/g);
    return (
      <span key={lineIdx} className="block min-h-[1.2em]">
        {parts.map((part, partIdx) => {
          if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
            return (
              <strong key={partIdx} className="font-black text-slate-950">
                {part.slice(1, -1)}
              </strong>
            );
          }
          return <span key={partIdx}>{part}</span>;
        })}
      </span>
    );
  });
}

export function StatusTicks({
  status,
  compact = false,
}: {
  status: WhatsAppMessageStatus;
  compact?: boolean;
}) {
  if (status === "failed") {
    return (
      <span
        title="فشل الإرسال"
        className="inline-flex items-center gap-0.5 text-[11px] font-black text-red-600"
      >
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-11.5a.75.75 0 011.5 0v4.25a.75.75 0 01-1.5 0V6.5zm.75 7.75a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
        {!compact && <span>فشل</span>}
      </span>
    );
  }

  if (status === "sent") {
    return (
      <span title="تم الإرسال إلى واتساب" className="inline-flex items-center text-slate-500">
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }

  const isRead = status === "read";
  return (
    <span
      title={isRead ? "تمت القراءة من العميل" : "تم التسليم لجهاز العميل"}
      className={`inline-flex items-center ${
        isRead
          ? "text-emerald-600 drop-shadow-[0_0_4px_rgba(16,185,129,0.55)]"
          : "text-slate-500"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2 13l4 4L15 7" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 13l4 4L22 7" />
      </svg>
    </span>
  );
}

export function DefaultAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const cls =
    size === "sm" ? "h-9 w-9" : size === "lg" ? "h-12 w-12" : "h-11 w-11";
  const iconCls =
    size === "sm" ? "h-5 w-5" : size === "lg" ? "h-6 w-6" : "h-5 w-5";

  return (
    <div
      className={`${cls} shrink-0 rounded-full bg-[#eef2f6] border border-slate-200/80 flex items-center justify-center text-slate-400`}
    >
      <svg viewBox="0 0 24 24" className={`${iconCls} fill-none stroke-current`} strokeWidth={1.8}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 19.5a7.5 7.5 0 0115 0"
        />
      </svg>
    </div>
  );
}

interface MessageBubbleProps {
  msg: WhatsAppMessageRecord;
  customerLabel: string;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onReply: (msg: WhatsAppMessageRecord) => void;
  onOpenImage: (url: string, caption?: string | null) => void;
}

export function MessageBubble({
  msg,
  customerLabel,
  selectionMode,
  isSelected,
  onToggleSelect,
  onReply,
  onOpenImage,
}: MessageBubbleProps) {
  const isOutbound = msg.direction === "out";
  const quoteLabel = isOutbound ? customerLabel : "أنت";

  return (
    <div
      className={`group flex w-full items-start gap-2.5 ${
        isOutbound ? "justify-start" : "justify-end"
      }`}
    >
      {selectionMode && (
        <button
          type="button"
          onClick={() => onToggleSelect(msg.id)}
          className={`mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
            isSelected
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-slate-300 bg-white hover:border-emerald-500"
          }`}
          aria-label="تحديد الرسالة"
        >
          {isSelected && (
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current">
              <path
                fillRule="evenodd"
                d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.414 0l-3.25-3.25a1 1 0 111.414-1.42l2.543 2.543 6.543-6.543a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>
      )}

      <div
        onClick={() => {
          if (selectionMode) onToggleSelect(msg.id);
        }}
        className={`relative max-w-[85%] sm:max-w-[72%] lg:max-w-[60%] rounded-2xl px-4 py-3 transition ${
          selectionMode ? "cursor-pointer" : ""
        } ${
          isSelected ? "ring-2 ring-emerald-500 ring-offset-1" : ""
        } ${
          isOutbound
            ? "bg-[#d6fceb] text-slate-900 border border-[#bde9d5] rounded-tr-xs shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
            : "bg-[#eef2f6] text-slate-900 border border-slate-200/90 rounded-tl-xs shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
        }`}
      >
        {/* Quick Reply Quote Button */}
        {!selectionMode && msg.wa_message_id && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReply(msg);
            }}
            title="الرد على هذه الرسالة"
            className={`absolute top-2 ${
              isOutbound ? "-left-8" : "-right-8"
            } hidden group-hover:flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-xs hover:text-emerald-600`}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
            </svg>
          </button>
        )}

        {/* Quoted Reply Snippet */}
        {(msg.reply_preview || msg.reply_to_wa_id) && (
          <div className="mb-2.5 rounded-xl bg-black/[0.045] px-3 py-2 border-r-[3px] border-emerald-500">
            <p className="text-[11px] font-black text-emerald-700">{quoteLabel}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-600 line-clamp-2">
              {msg.reply_preview || "رسالة سابقة"}
            </p>
          </div>
        )}

        {/* Template Tag Badge */}
        {msg.template_name && (
          <div className="mb-1.5 inline-flex items-center gap-1 rounded-md bg-white/70 px-2 py-0.5 text-[10px] font-black text-emerald-800 border border-emerald-200/70">
            <span>قالب رسمي:</span>
            <span dir="ltr">{msg.template_name}</span>
          </div>
        )}

        {/* Media Attachments */}
        {(msg.msg_type === "image" || msg.msg_type === "sticker") && msg.media_url && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenImage(msg.media_url!, msg.body);
            }}
            className="mb-2 block overflow-hidden rounded-xl border border-black/10 bg-white"
          >
            <img
              src={msg.media_url}
              alt={msg.media_filename || "صورة"}
              className="max-h-72 w-auto max-w-full object-contain"
              loading="lazy"
            />
          </button>
        )}

        {msg.msg_type === "video" && msg.media_url && (
          <div className="mb-2 overflow-hidden rounded-xl border border-black/10 bg-black">
            <video
              controls
              playsInline
              preload="metadata"
              src={msg.media_url}
              className="max-h-72 w-full"
            />
          </div>
        )}

        {msg.msg_type === "audio" && msg.media_url && (
          <div className="mb-2 rounded-xl bg-white/75 p-2.5 border border-black/5">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-emerald-600" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
              <span>رسالة صوتية</span>
            </div>
            <audio controls preload="metadata" src={msg.media_url} className="h-9 w-56 sm:w-64" />
          </div>
        )}

        {msg.msg_type === "document" && (
          <div className="mb-2 flex items-center gap-3 rounded-xl bg-white/80 p-3 border border-black/10">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 border border-red-200/70 font-black text-[11px]">
              PDF
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-slate-900" dir="ltr">
                {msg.media_filename || "مستند مرفق"}
              </p>
              {msg.media_url ? (
                <a
                  href={msg.media_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
                >
                  <span>عرض وتحميل الملف</span>
                  <svg viewBox="0 0 20 20" className="h-3 w-3 fill-current">
                    <path d="M10.75 3.5a.75.75 0 00-1.5 0v7.69L6.72 8.66a.75.75 0 10-1.06 1.06l3.81 3.81a.75.75 0 001.06 0l3.81-3.81a.75.75 0 10-1.06-1.06l-2.53 2.53V3.5z" />
                    <path d="M4 14.5a.5.5 0 01.5-.5h11a.5.5 0 010 1h-11a.5.5 0 01-.5-.5z" />
                  </svg>
                </a>
              ) : (
                <p className="text-[11px] text-slate-500">تم إرفاق مستند</p>
              )}
            </div>
          </div>
        )}

        {/* Fallback notice if media type lacks cached URL */}
        {!msg.media_url &&
          ["image", "video", "audio", "sticker"].includes(msg.msg_type) && (
            <div className="mb-1.5 rounded-lg bg-black/5 px-2.5 py-1.5 text-xs font-bold text-slate-600">
              [{msg.msg_type === "image" ? "صورة" : msg.msg_type === "video" ? "فيديو" : msg.msg_type === "audio" ? "صوتية" : "ملصق"}]
            </div>
          )}

        {/* Message Body Text */}
        {msg.body && (
          <div className="text-[13.5px] leading-relaxed font-medium text-slate-800 break-words">
            {renderWhatsAppFormattedText(msg.body)}
          </div>
        )}

        {/* Error reason if Meta reported failure */}
        {msg.status === "failed" && msg.error_text && (
          <div className="mt-2 rounded-lg bg-red-50 border border-red-200 px-2.5 py-1.5 text-[11px] font-bold text-red-700">
            {msg.error_text}
          </div>
        )}

        {/* Footer: Timestamp + Status Ticks */}
        <div
          className={`mt-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold ${
            isOutbound ? "justify-start text-slate-600/80" : "justify-start text-slate-500"
          }`}
        >
          {isOutbound && <StatusTicks status={msg.status} />}
          <span dir="ltr">{formatInboxDateTime(msg.created_at)}</span>
        </div>
      </div>
    </div>
  );
}
