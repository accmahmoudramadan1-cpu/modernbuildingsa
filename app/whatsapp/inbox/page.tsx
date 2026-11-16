"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import WhatsAppLoginForm from "@/components/WhatsAppLoginForm";
import WhatsAppInboxTemplateModal from "@/components/WhatsAppInboxTemplateModal";
import {
  DefaultAvatar,
  MessageBubble,
  StatusTicks,
  formatInboxDateTime,
  formatRemainingWindow,
  type RelatedOracleInvoice,
  type WhatsAppConversationRecord,
  type WhatsAppMessageRecord,
} from "@/components/WhatsAppInboxHelpers";

const QUICK_EMOJIS = [
  "👍",
  "❤️",
  "🙏",
  "✅",
  "👋",
  "😊",
  "😂",
  "🔥",
  "📦",
  "🧾",
  "💰",
  "📞",
  "📍",
  "⏳",
  "✨",
  "🎉",
];

function formatTimer(seconds: number): string {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export default function WhatsAppInboxPage() {
  const [authStatus, setAuthStatus] = useState<"checking" | "authenticated" | "unauthenticated">(
    "checking"
  );
  const [authUser, setAuthUser] = useState("");

  // Conversations & Active Chat
  const [conversations, setConversations] = useState<WhatsAppConversationRecord[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] =
    useState<WhatsAppConversationRecord | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessageRecord[]>([]);
  const [relatedInvoices, setRelatedInvoices] = useState<RelatedOracleInvoice[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);

  // Selection / Delete / Reply / Lightbox
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<string[]>([]);
  const [replyToMsg, setReplyToMsg] = useState<WhatsAppMessageRecord | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    caption?: string | null;
  } | null>(null);
  const [confirmDeletePhone, setConfirmDeletePhone] = useState<string | null>(null);

  // Composer & Voice Recording
  const [draftText, setDraftText] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [showEmojis, setShowEmojis] = useState(false);
  const [sending, setSending] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingCancelledRef = useRef(false);

  // Modals: New Chat & Meta Template
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState("");
  const [newChatName, setNewChatName] = useState("");
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToBottomRef = useRef(false);
  const prevMsgCountRef = useRef(0);

  // Scroll helper
  const scrollToBottom = useCallback((smooth = false) => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  // Cleanup pending file object URL
  useEffect(() => {
    if (!pendingFile) {
      setPendingPreviewUrl(null);
      return;
    }
    if (pendingFile.type.startsWith("image/")) {
      const url = URL.createObjectURL(pendingFile);
      setPendingPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPendingPreviewUrl(null);
  }, [pendingFile]);

  // Fetch conversations list
  const fetchConversations = useCallback(
    async (query = searchQuery, silent = false) => {
      if (!silent) setLoadingList(true);
      try {
        const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
        const res = await fetch(`/api/whatsapp/inbox${qs}`, { cache: "no-store" });
        if (res.status === 401) {
          setAuthStatus("unauthenticated");
          return;
        }
        const data = await res.json();
        if (data.success && Array.isArray(data.conversations)) {
          setConversations(data.conversations);
        }
      } catch {
        // Keep last state on transient network glitch during background poll
      } finally {
        if (!silent) setLoadingList(false);
      }
    },
    [searchQuery]
  );

  // Fetch active chat detail
  const fetchChatDetail = useCallback(
    async (phone: string, silent = false) => {
      if (!silent) setLoadingChat(true);
      try {
        const res = await fetch(
          `/api/whatsapp/inbox?phone=${encodeURIComponent(phone)}`,
          { cache: "no-store" }
        );
        if (res.status === 401) {
          setAuthStatus("unauthenticated");
          return;
        }
        const data = await res.json();
        if (data.success) {
          setActiveConversation(data.conversation || null);
          const nextMsgs: WhatsAppMessageRecord[] = Array.isArray(data.messages)
            ? data.messages
            : [];
          setMessages(nextMsgs);
          setRelatedInvoices(
            Array.isArray(data.relatedInvoices) ? data.relatedInvoices : []
          );

          if (!silent || nextMsgs.length > prevMsgCountRef.current) {
            shouldScrollToBottomRef.current = true;
          }
          prevMsgCountRef.current = nextMsgs.length;
        }
      } catch {
        // Ignore transient poll errors
      } finally {
        if (!silent) setLoadingChat(false);
      }
    },
    []
  );

  // Auth check on mount + optional ?phone= query param
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const initialPhone = params.get("phone");
    if (initialPhone) {
      setSelectedPhone(initialPhone);
      shouldScrollToBottomRef.current = true;
    }

    (async () => {
      try {
        const res = await fetch("/api/whatsapp/auth", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && data.authenticated) {
          setAuthUser(data.username || "modernbuilding");
          setAuthStatus("authenticated");
        } else {
          setAuthStatus("unauthenticated");
          setLoadingList(false);
        }
      } catch {
        if (!active) return;
        setAuthStatus("unauthenticated");
        setLoadingList(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  // Load initial data after authentication and debounce search
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const timer = setTimeout(() => {
      fetchConversations(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [authStatus, searchQuery, fetchConversations]);

  // Load selected conversation details on change
  useEffect(() => {
    if (authStatus !== "authenticated" || !selectedPhone) {
      setActiveConversation(null);
      setMessages([]);
      setRelatedInvoices([]);
      prevMsgCountRef.current = 0;
      return;
    }
    setSelectionMode(false);
    setSelectedMsgIds([]);
    setReplyToMsg(null);
    setComposerError(null);
    shouldScrollToBottomRef.current = true;
    fetchChatDetail(selectedPhone);
  }, [authStatus, selectedPhone, fetchChatDetail]);

  // Scroll cleanly after messages update
  useEffect(() => {
    if (shouldScrollToBottomRef.current) {
      shouldScrollToBottomRef.current = false;
      requestAnimationFrame(() => scrollToBottom(false));
    }
  }, [messages, scrollToBottom]);

  // Visibility-aware 4s polling for live updates
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetchConversations(searchQuery, true);
      if (selectedPhone) {
        fetchChatDetail(selectedPhone, true);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [authStatus, searchQuery, selectedPhone, fetchConversations, fetchChatDetail]);

  // Recording elapsed timer
  useEffect(() => {
    if (!isRecording) {
      setRecordingSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isRecording]);

  // Cleanup microphone stream on unmount
  useEffect(() => {
    return () => {
      recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function handleLogout() {
    await fetch("/api/whatsapp/auth", { method: "DELETE" }).catch(() => {});
    setAuthStatus("unauthenticated");
    setSelectedPhone(null);
    setConversations([]);
    setMessages([]);
  }

  async function uploadAndSendFile(file: File, caption: string, isVoice: boolean) {
    if (!selectedPhone) return;
    setSending(true);
    setComposerError(null);

    try {
      const form = new FormData();
      form.append("phone", selectedPhone);
      form.append("file", file);
      if (caption.trim()) form.append("caption", caption.trim());
      if (activeConversation?.customer_name) {
        form.append("customerName", activeConversation.customer_name);
      }
      if (replyToMsg?.wa_message_id) {
        form.append("replyToWaId", replyToMsg.wa_message_id);
      }
      form.append("isVoice", isVoice ? "true" : "false");

      const res = await fetch("/api/whatsapp/send-reply", {
        method: "POST",
        body: form,
      });

      if (res.status === 401) {
        setAuthStatus("unauthenticated");
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        setComposerError(data.error || "تعذر إرسال المرفق عبر واتساب.");
        return;
      }

      setPendingFile(null);
      if (caption) setDraftText("");
      setReplyToMsg(null);
      shouldScrollToBottomRef.current = true;
      await Promise.all([
        fetchChatDetail(selectedPhone, true),
        fetchConversations(searchQuery, true),
      ]);
    } catch {
      setComposerError("حدث خطأ أثناء رفع وإرسال الملف.");
    } finally {
      setSending(false);
    }
  }

  async function handleSendTextOrFile() {
    if (!selectedPhone || sending) return;
    setComposerError(null);

    if (pendingFile) {
      await uploadAndSendFile(pendingFile, draftText, false);
      return;
    }

    const text = draftText.trim();
    if (!text) return;

    setSending(true);
    try {
      const res = await fetch("/api/whatsapp/send-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: selectedPhone,
          text,
          customerName: activeConversation?.customer_name || undefined,
          replyToWaId: replyToMsg?.wa_message_id || undefined,
        }),
      });

      if (res.status === 401) {
        setAuthStatus("unauthenticated");
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        setComposerError(data.error || "تعذر إرسال الرسالة.");
        return;
      }

      setDraftText("");
      setReplyToMsg(null);
      setShowEmojis(false);
      shouldScrollToBottomRef.current = true;
      await Promise.all([
        fetchChatDetail(selectedPhone, true),
        fetchConversations(searchQuery, true),
      ]);
    } catch {
      setComposerError("تعذر الاتصال بالخادم أثناء إرسال الرسالة.");
    } finally {
      setSending(false);
    }
  }

  async function startVoiceRecording() {
    if (!selectedPhone || sending || isRecording) return;
    setComposerError(null);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setComposerError("متصفحك الحالي لا يدعم تسجيل الصوت المباشر. يمكنك إرفاق ملف صوتي بالمشبك.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;

      const mimeCandidates = [
        "audio/ogg;codecs=opus",
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ];
      const chosenMime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";

      const recorder = chosenMime
        ? new MediaRecorder(stream, { mimeType: chosenMime })
        : new MediaRecorder(stream);

      recordingChunksRef.current = [];
      recordingCancelledRef.current = false;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordingChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        recordingStreamRef.current = null;
        setIsRecording(false);

        if (recordingCancelledRef.current) return;

        const mime = (recorder.mimeType || chosenMime || "audio/webm").split(";")[0];
        const blob = new Blob(recordingChunksRef.current, { type: mime });
        if (blob.size < 200) {
          setComposerError("التسجيل الصوتي قصير جداً أو فارغ.");
          return;
        }

        const ext = mime.includes("ogg")
          ? "ogg"
          : mime.includes("mp4") || mime.includes("m4a")
            ? "m4a"
            : "webm";
        const voiceFile = new File([blob], `voice-${Date.now()}.${ext}`, { type: mime });
        await uploadAndSendFile(voiceFile, "", true);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);
    } catch {
      setComposerError("لم يتم السماح بالوصول للميكروفون. فعّل إذن الميكروفون ثم أعد المحاولة.");
    }
  }

  function stopVoiceRecording(cancel = false) {
    recordingCancelledRef.current = cancel;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    } else {
      recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
      recordingStreamRef.current = null;
      setIsRecording(false);
    }
  }

  async function handleDeleteConversation(phone: string) {
    try {
      const res = await fetch(
        `/api/whatsapp/inbox?phone=${encodeURIComponent(phone)}`,
        { method: "DELETE" }
      );
      if (res.status === 401) {
        setAuthStatus("unauthenticated");
        return;
      }
      setConfirmDeletePhone(null);
      if (selectedPhone === phone) {
        setSelectedPhone(null);
      }
      await fetchConversations(searchQuery, true);
    } catch {
      setConfirmDeletePhone(null);
    }
  }

  async function handleDeleteSelectedMessages() {
    if (!selectedPhone || selectedMsgIds.length === 0) return;
    try {
      const res = await fetch("/api/whatsapp/inbox", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: selectedPhone,
          messageIds: selectedMsgIds,
        }),
      });
      if (res.status === 401) {
        setAuthStatus("unauthenticated");
        return;
      }
      setSelectionMode(false);
      setSelectedMsgIds([]);
      await Promise.all([
        fetchChatDetail(selectedPhone, true),
        fetchConversations(searchQuery, true),
      ]);
    } catch {
      setComposerError("تعذر حذف الرسائل المحددة.");
    }
  }

  function handleStartNewChat(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = newChatPhone.replace(/[^\d]/g, "");
    if (cleaned.length < 8) return;
    let formatted = cleaned;
    if (formatted.startsWith("05") && formatted.length === 10) {
      formatted = `966${formatted.slice(1)}`;
    } else if (formatted.startsWith("01") && formatted.length === 11) {
      formatted = `20${formatted.slice(1)}`;
    }
    setShowNewChatModal(false);
    setSelectedPhone(formatted);
    if (newChatName.trim()) {
      setActiveConversation({
        phone: formatted,
        customer_name: newChatName.trim(),
        last_message_text: null,
        last_message_type: "text",
        last_message_direction: "out",
        last_message_status: "sent",
        last_message_at: new Date().toISOString(),
        last_inbound_at: null,
        unread_count: 0,
        is_window_open: false,
        window_expires_at: null,
      });
    }
    setNewChatPhone("");
    setNewChatName("");
  }

  if (authStatus === "checking") {
    return (
      <main dir="rtl" className="flex h-[100dvh] items-center justify-center bg-[#f6f9fb] px-4">
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-white p-8 shadow-lg border border-slate-200">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-sm font-bold text-slate-600">جاري فتح تطبيق Modern Building...</p>
        </div>
      </main>
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <WhatsAppLoginForm
        title="Modern Building — صندوق الوارد"
        subtitle="سجّل الدخول بحساب بوابة الواتساب لعرض المحادثات والرد على العملاء"
        onSuccess={(u) => {
          setAuthUser(u);
          setAuthStatus("authenticated");
        }}
      />
    );
  }

  const activeName =
    activeConversation?.customer_name || selectedPhone || "محادثة";
  const isWindowOpen = Boolean(activeConversation?.is_window_open);
  const remainingText = formatRemainingWindow(activeConversation?.window_expires_at);

  return (
    <div
      dir="rtl"
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(148, 163, 184, 0.11) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.11) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
      className="h-[100dvh] w-full overflow-hidden bg-[#f6f9fb] md:p-3 lg:p-4"
    >
      <div className="mx-auto flex h-full max-w-[1440px] flex-col md:flex-row-reverse overflow-hidden bg-white md:rounded-2xl md:border md:border-slate-200/90 md:shadow-sm">
        {/* LEFT PANE ON DESKTOP (Conversations List) / FULL SCREEN ON MOBILE WHEN NO CHAT SELECTED */}
        <aside
          className={`${
            selectedPhone ? "hidden md:flex" : "flex"
          } h-full w-full flex-col bg-white md:w-[345px] lg:w-[375px] shrink-0 md:border-r md:border-slate-200/80`}
        >
          {/* Compact App Header Strip */}
          <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2.5">
            <div className="flex items-center gap-2.5">
              <img
                src="/pwa-icon-192.png"
                alt="Modern Building"
                className="h-7 w-7 object-contain"
              />
              <div>
                <p className="text-sm font-black text-slate-900 leading-none">Modern Building</p>
                <p className="mt-0.5 text-[10px] font-bold text-emerald-700">
                  صندوق وارد الواتساب
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowNewChatModal(true)}
                title="محادثة جديدة / رقم جديد"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>

              <Link
                href="/whatsapp?view=invoices"
                title="العودة لبوابة فواتير أونكس"
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-black text-slate-700 transition hover:bg-slate-100"
              >
                الفواتير
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                title={`تسجيل الخروج (${authUser || "modernbuilding"})`}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
              </button>
            </div>
          </div>

          {/* Search Pill Bar */}
          <div className="border-b border-slate-100 px-3.5 py-3">
            <div className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-[#f7f9fb] px-4 py-2.5 transition focus-within:border-emerald-500 focus-within:bg-white">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث برقم الهاتف أو الرسالة..."
                className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-800 placeholder:text-slate-400 outline-none"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-xs font-black text-slate-400 hover:text-slate-700"
                >
                  ✕
                </button>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 shrink-0 fill-none stroke-slate-400" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.64 5.64a7.5 7.5 0 0011.01 11.01z" />
                </svg>
              )}
            </div>
          </div>

          {/* Conversation Rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loadingList && conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-xs font-bold text-slate-400">
                <div className="mb-3 h-7 w-7 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent" />
                <span>جاري تحميل المحادثات...</span>
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="text-sm font-black text-slate-700">لا توجد محادثات بعد</p>
                <p className="mt-1.5 text-xs font-medium text-slate-500 leading-5">
                  تظهر هنا تلقائياً جميع الفواتير المرسلة ورسائل العملاء الواردة عبر واتساب.
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(true)}
                  className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-xs hover:bg-emerald-700"
                >
                  + بدء محادثة جديدة
                </button>
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = selectedPhone === conv.phone;
                return (
                  <div
                    key={conv.phone}
                    onClick={() => setSelectedPhone(conv.phone)}
                    className={`group relative flex cursor-pointer items-center gap-3 px-3.5 py-3.5 transition ${
                      isActive
                        ? "bg-[#effdf6] border-r-[3px] border-r-emerald-500"
                        : "hover:bg-slate-50/90"
                    }`}
                  >
                    <DefaultAvatar />

                    <div className="min-w-0 flex-1 text-right">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[13.5px] font-black text-slate-900">
                          {conv.customer_name || conv.phone}
                        </p>
                        {conv.unread_count > 0 && (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-black text-white">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>

                      <p
                        dir="ltr"
                        className="mt-0.5 text-right font-mono text-[11px] font-semibold text-slate-500"
                      >
                        {conv.phone}
                      </p>

                      <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                        {conv.last_message_direction === "out" && (
                          <span className="shrink-0">
                            <StatusTicks status={conv.last_message_status} compact />
                          </span>
                        )}
                        <p className="truncate text-[12px] font-medium text-slate-600">
                          {conv.last_message_text || "رسالة"}
                        </p>
                      </div>
                    </div>

                    {/* Left Side in RTL: Timestamp & Dark Trash Circle */}
                    <div className="flex shrink-0 flex-col items-end justify-between gap-2 self-stretch py-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          dir="ltr"
                          className="text-[10px] font-semibold text-slate-400 whitespace-nowrap"
                        >
                          {formatInboxDateTime(conv.last_message_at)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeletePhone(conv.phone);
                          }}
                          title="حذف المحادثة"
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1e293b] text-red-400 shadow-xs transition hover:bg-red-600 hover:text-white md:opacity-0 md:group-hover:opacity-100"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                      <span
                        className={`text-[9.5px] font-bold ${
                          conv.is_window_open ? "text-emerald-600" : "text-slate-400"
                        }`}
                      >
                        {conv.is_window_open ? "● 24س مفتوحة" : "قوالب فقط"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* RIGHT PANE ON DESKTOP (Active Chat) / FULL SCREEN ON MOBILE WHEN SELECTED */}
        <section
          className={`${
            selectedPhone ? "flex" : "hidden md:flex"
          } h-full flex-1 flex-col bg-white overflow-hidden`}
        >
          {!selectedPhone ? (
            <div className="flex h-full flex-col items-center justify-center bg-[#fbfcfd] px-6 text-center">
              <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-white p-4 shadow-sm border border-slate-200/80">
                <img
                  src="/pwa-icon-192.png"
                  alt="Modern Building"
                  className="h-full w-full object-contain"
                />
              </div>
              <h1 className="text-xl font-black text-slate-900">
                صندوق الوارد الرسمي — Modern Building
              </h1>
              <p className="mt-2 max-w-md text-xs sm:text-sm font-semibold leading-6 text-slate-500">
                اختر أي عميل من القائمة الجانبية لعرض الفواتير والرسائل والوسائط المرسلة والمستقبلة، أو ابدأ محادثة جديدة برقم العميل.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(true)}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700"
                >
                  + بدء محادثة برقم هاتف
                </button>
                <Link
                  href="/whatsapp?view=invoices"
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50"
                >
                  بوابة فواتير أونكس
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Active Chat Header */}
              <header className="flex items-center justify-between gap-2 border-b border-slate-100 bg-white px-3.5 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  {/* Mobile Back Button (>) */}
                  <button
                    type="button"
                    onClick={() => setSelectedPhone(null)}
                    aria-label="العودة لقائمة المحادثات"
                    className="flex md:hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-[#f6f8fa] text-slate-700 hover:bg-slate-100"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>

                  <DefaultAvatar size="md" />

                  <div className="min-w-0">
                    <h2 className="truncate text-sm sm:text-base font-black text-slate-900">
                      {activeName}
                    </h2>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-bold">
                      <span dir="ltr" className="font-mono text-slate-500">
                        {selectedPhone}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 ${
                          isWindowOpen ? "text-emerald-600" : "text-amber-600"
                        }`}
                      >
                        <span>●</span>
                        <span>
                          {isWindowOpen
                            ? `محادثة نشطة${remainingText ? ` (${remainingText})` : ""}`
                            : "نافذة 24س مغلقة"}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Header Left Actions */}
                <div className="flex shrink-0 items-center gap-2">
                  {selectionMode ? (
                    <>
                      <button
                        type="button"
                        disabled={selectedMsgIds.length === 0}
                        onClick={handleDeleteSelectedMessages}
                        className="rounded-xl bg-red-600 px-3.5 py-2 text-xs font-black text-white shadow-xs transition hover:bg-red-700 disabled:opacity-40"
                      >
                        حذف ({selectedMsgIds.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectionMode(false);
                          setSelectedMsgIds([]);
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        إلغاء
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowTemplateModal(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 transition hover:bg-emerald-100"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <span className="hidden sm:inline">إرسال قالب رسمي</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectionMode(true);
                          setSelectedMsgIds([]);
                        }}
                        title="تحديد رسائل"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="hidden sm:inline">تحديد رسائل</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPhone(null)}
                        title="إغلاق المحادثة"
                        className="hidden md:flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-[#f6f8fa] text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </header>

              {/* Messages Feed */}
              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto bg-[#fbfcfd] px-3.5 py-5 sm:px-6 space-y-3"
              >
                {loadingChat && messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs font-bold text-slate-400">
                    جاري تحميل سجل الرسائل...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center px-4">
                    <p className="text-sm font-black text-slate-700">
                      لا توجد رسائل مسجلة مع هذا الرقم حتى الآن
                    </p>
                    <p className="mt-1.5 max-w-sm text-xs font-medium text-slate-500 leading-5">
                      يمكنك إرسال قالب رسمي (فاتورة / سند / عرض سعر) أو الرد إذا راسلك العميل خلال آخر 24 ساعة.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowTemplateModal(true)}
                      className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700"
                    >
                      إرسال قالب رسمي للعميل
                    </button>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      customerLabel={activeName}
                      selectionMode={selectionMode}
                      isSelected={selectedMsgIds.includes(msg.id)}
                      onToggleSelect={(id) =>
                        setSelectedMsgIds((prev) =>
                          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                        )
                      }
                      onReply={(target) => {
                        setReplyToMsg(target);
                        setSelectionMode(false);
                      }}
                      onOpenImage={(url, caption) => setLightboxImage({ url, caption })}
                    />
                  ))
                )}
              </div>

              {/* Banners Above Composer: 24h Window / Quoted Reply / Pending File / Error */}
              <div className="border-t border-slate-100 bg-white">
                {!isWindowOpen && (
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-50/90 border-b border-amber-200/70 px-4 py-2 text-xs font-bold text-amber-900">
                    <span>
                      نافذة الـ 24 ساعة منتهية أو لم يراسل العميل بعد — لفتح المحادثة استخدم القوالب الرسمية.
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowTemplateModal(true)}
                      className="rounded-lg bg-amber-600 px-3 py-1 text-[11px] font-black text-white hover:bg-amber-700"
                    >
                      إرسال قالب رسمي
                    </button>
                  </div>
                )}

                {replyToMsg && (
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-[#f8fafc] px-4 py-2">
                    <div className="min-w-0 flex-1 border-r-[3px] border-emerald-500 pr-2.5">
                      <p className="text-[11px] font-black text-emerald-700">
                        الرد على: {replyToMsg.direction === "out" ? "أنت" : activeName}
                      </p>
                      <p className="truncate text-xs font-medium text-slate-600">
                        {replyToMsg.body || `[${replyToMsg.msg_type}]`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyToMsg(null)}
                      className="text-xs font-black text-slate-400 hover:text-slate-700"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {pendingFile && (
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-emerald-50/60 px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-3">
                      {pendingPreviewUrl ? (
                        <img
                          src={pendingPreviewUrl}
                          alt="preview"
                          className="h-11 w-11 rounded-xl border border-emerald-200 object-cover"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-emerald-200 text-xs font-black text-emerald-700">
                          ملف
                        </div>
                      )}
                      <div className="min-w-0">
                        <p dir="ltr" className="truncate text-xs font-black text-slate-800">
                          {pendingFile.name}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-500">
                          {(pendingFile.size / 1024).toFixed(1)} KB — أضف وصفاً اختيارياً أو اضغط إرسال
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingFile(null)}
                      className="rounded-lg bg-white px-2.5 py-1 text-xs font-black text-red-600 border border-red-200 hover:bg-red-50"
                    >
                      إلغاء
                    </button>
                  </div>
                )}

                {composerError && (
                  <div className="flex items-center justify-between gap-2 bg-red-50 border-b border-red-200 px-4 py-2 text-xs font-bold text-red-700">
                    <span>{composerError}</span>
                    <button
                      type="button"
                      onClick={() => setComposerError(null)}
                      className="font-black"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Composer Input Row (Matches Screenshots 2 & 4) */}
                <div className="relative px-3 py-3 sm:px-5">
                  {showEmojis && (
                    <div className="absolute bottom-20 right-4 z-30 grid grid-cols-8 gap-1.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                      {QUICK_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setDraftText((prev) => prev + emoji)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-lg transition hover:bg-slate-100"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {isRecording ? (
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50/70 px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="h-3 w-3 animate-pulse rounded-full bg-red-600" />
                        <span className="text-xs font-black text-red-800">
                          جاري تسجيل رسالة صوتية...
                        </span>
                        <span dir="ltr" className="font-mono text-xs font-black text-red-700">
                          {formatTimer(recordingSeconds)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => stopVoiceRecording(true)}
                          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-600 hover:bg-slate-100"
                        >
                          إلغاء
                        </button>
                        <button
                          type="button"
                          onClick={() => stopVoiceRecording(false)}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-xs hover:bg-emerald-700"
                        >
                          إرسال الصوتية
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-end gap-2">
                      {/* Emoji Button */}
                      <button
                        type="button"
                        onClick={() => setShowEmojis((v) => !v)}
                        title="إيموجي"
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition ${
                          showEmojis
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-[#f7f9fb] text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                        </svg>
                      </button>

                      {/* Attachment Paperclip Button */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        title="إرفاق صورة أو فيديو أو ملف PDF"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-[#f7f9fb] text-slate-600 transition hover:bg-slate-100"
                      >
                        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                        </svg>
                      </button>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setPendingFile(file);
                            setComposerError(null);
                          }
                          e.target.value = "";
                        }}
                      />

                      {/* Message Textarea */}
                      <textarea
                        rows={1}
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendTextOrFile();
                          }
                        }}
                        placeholder={
                          pendingFile
                            ? "أضف تعليقاً للمرفق (اختياري)..."
                            : "اكتب رسالة للرد على العميل..."
                        }
                        className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-slate-200 bg-[#f7f9fb] px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:bg-white"
                      />

                      {/* Mic or Send Button */}
                      {draftText.trim() || pendingFile ? (
                        <button
                          type="button"
                          disabled={sending}
                          onClick={handleSendTextOrFile}
                          title="إرسال"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {sending ? (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current -rotate-90 sm:rotate-0">
                              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                            </svg>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={sending}
                          onClick={startVoiceRecording}
                          title="تسجيل رسالة صوتية"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-[#f7f9fb] text-slate-700 transition hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700"
                        >
                          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth={1.9}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div
          dir="rtl"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <form
            onSubmit={handleStartNewChat}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">بدء محادثة جديدة</h3>
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-black text-slate-700">
                رقم الجوال بالصيغة الدولية (مثال: 9665xxxxxxxx)
              </label>
              <input
                type="tel"
                dir="ltr"
                required
                value={newChatPhone}
                onChange={(e) => setNewChatPhone(e.target.value)}
                placeholder="966501234567"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-mono font-bold outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-black text-slate-700">
                اسم العميل (اختياري)
              </label>
              <input
                type="text"
                value={newChatName}
                onChange={(e) => setNewChatName(e.target.value)}
                placeholder="مثال: شركة البناء"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-emerald-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-black text-white hover:bg-emerald-700"
              >
                فتح المحادثة
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Conversation Confirm Modal */}
      {confirmDeletePhone && (
        <div
          dir="rtl"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-black text-slate-900">تأكيد حذف المحادثة</h3>
            <p className="text-xs font-semibold leading-5 text-slate-600">
              هل تريد حذف هذه المحادثة وجميع رسائلها مع الرقم{" "}
              <span dir="ltr" className="font-mono font-bold text-slate-900">
                {confirmDeletePhone}
              </span>
              ؟ لن يمكن التراجع عن الحذف من صندوق الوارد.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeletePhone(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => handleDeleteConversation(confirmDeletePhone)}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white hover:bg-red-700"
              >
                نعم، حذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Lightbox */}
      {lightboxImage && (
        <div
          dir="rtl"
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] max-w-4xl flex-col items-center gap-3"
          >
            <div className="flex w-full items-center justify-between text-white">
              <a
                href={lightboxImage.url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-white/15 px-3.5 py-1.5 text-xs font-black hover:bg-white/25"
              >
                تحميل الصورة
              </a>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
              >
                ✕
              </button>
            </div>
            <img
              src={lightboxImage.url}
              alt="عرض الصورة"
              className="max-h-[78vh] w-auto rounded-2xl object-contain shadow-2xl"
            />
            {lightboxImage.caption && (
              <p className="rounded-xl bg-black/60 px-4 py-2 text-xs font-semibold text-white">
                {lightboxImage.caption}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Official Meta Template Modal */}
      {selectedPhone && (
        <WhatsAppInboxTemplateModal
          isOpen={showTemplateModal}
          phone={selectedPhone}
          customerName={activeName}
          relatedInvoices={relatedInvoices}
          onClose={() => setShowTemplateModal(false)}
          onUnauthorized={() => setAuthStatus("unauthenticated")}
          onSent={() => {
            shouldScrollToBottomRef.current = true;
            fetchChatDetail(selectedPhone, true);
            fetchConversations(searchQuery, true);
          }}
        />
      )}
    </div>
  );
}
