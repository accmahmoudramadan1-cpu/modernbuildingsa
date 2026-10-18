import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET Handler - Webhook Verification for Meta WhatsApp Cloud API
 * Meta sends a GET request with hub.mode, hub.verify_token, and hub.challenge
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken =
    process.env.WHATSAPP_VERIFY_TOKEN || "modern_building_verify_2026";

  // Check the mode and verify token
  if (mode === "subscribe" && token === verifyToken) {
    console.log("[WhatsApp Webhook] Verification successful!");
    // Meta requires returning the challenge directly as plain text with 200 OK
    return new Response(challenge || "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn("[WhatsApp Webhook] Verification failed. Tokens did not match or invalid mode.", {
    receivedToken: token,
    expectedToken: verifyToken,
    mode,
  });

  return new Response("Forbidden: Invalid verification token", {
    status: 403,
  });
}

/**
 * POST Handler - Receives incoming WhatsApp messages & status notifications from Meta
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Log incoming payload for debugging in Vercel logs
    console.log("[WhatsApp Webhook] Received event:", JSON.stringify(body, null, 2));

    if (body.object === "whatsapp_business_account") {
      const entries = body.entry || [];

      for (const entry of entries) {
        const changes = entry.changes || [];

        for (const change of changes) {
          const value = change.value;

          if (!value) continue;

          // 1. Process Incoming Messages
          if (value.messages && Array.isArray(value.messages)) {
            for (const message of value.messages) {
              const from = message.from; // Customer's phone number
              const messageId = message.id;
              const timestamp = message.timestamp;
              const type = message.type;
              const text = message.text?.body;

              console.log(
                `[WhatsApp Webhook] Message from ${from} (${type}):`,
                text || `[${type} payload]`
              );

              // Future extension: You can trigger auto-replies or save to Supabase here
            }
          }

          // 2. Process Message Statuses (sent, delivered, read, failed)
          if (value.statuses && Array.isArray(value.statuses)) {
            for (const status of value.statuses) {
              console.log(
                `[WhatsApp Webhook] Status update for message ${status.id}: ${status.status} (recipient: ${status.recipient_id})`
              );
            }
          }
        }
      }

      // Always acknowledge receipt promptly with a 200 OK so Meta doesn't retry
      return NextResponse.json({ status: "EVENT_RECEIVED" }, { status: 200 });
    }

    return NextResponse.json(
      { error: "Not a valid WhatsApp event" },
      { status: 404 }
    );
  } catch (error) {
    console.error("[WhatsApp Webhook] Error processing event:", error);
    // Return 200 or 500. Meta recommends returning 200 once received to avoid constant retries on parse errors.
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
