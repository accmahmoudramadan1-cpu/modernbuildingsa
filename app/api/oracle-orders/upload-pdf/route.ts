import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const PDF_BUCKET = "oracle-pdfs";
const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB limit for WhatsApp Document API & free tier protection
const RETENTION_DAYS = 7;

function getStorageSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url.includes("placeholder-url")) {
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function cleanupExpiredPdfFolders(
  supabase: NonNullable<ReturnType<typeof getStorageSupabaseClient>>
) {
  try {
    const { data: rootItems, error } = await supabase.storage
      .from(PDF_BUCKET)
      .list("", { limit: 100 });

    if (error || !Array.isArray(rootItems)) return;

    const cutoffMs = Date.now() - RETENTION_DAYS * 86400 * 1000;
    for (const item of rootItems) {
      if (!item?.name || !/^\d{4}-\d{2}-\d{2}$/.test(item.name)) continue;
      const folderTime = Date.parse(item.name);
      if (Number.isNaN(folderTime) || folderTime >= cutoffMs) continue;

      const { data: nestedFiles } = await supabase.storage
        .from(PDF_BUCKET)
        .list(item.name, { limit: 200 });

      if (Array.isArray(nestedFiles) && nestedFiles.length > 0) {
        const pathsToRemove = nestedFiles
          .filter((f) => f?.name)
          .map((f) => `${item.name}/${f.name}`);
        if (pathsToRemove.length > 0) {
          await supabase.storage.from(PDF_BUCKET).remove(pathsToRemove);
        }
      }
    }
  } catch (err) {
    console.warn("[Upload PDF] Non-fatal retention cleanup warning:", err);
  }
}

/**
 * POST /api/oracle-orders/upload-pdf
 * Uploads an authentic Onyx Pro PDF binary exported on the client server into
 * Supabase Storage (`oracle-pdfs` bucket, 1 GB free file quota) and returns its public HTTPS URL.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const configuredApiKey = process.env.ORACLE_SYNC_API_KEY;

    if (configuredApiKey) {
      const token = authHeader?.replace(/^Bearer\s+/i, "");
      if (token !== configuredApiKey) {
        return NextResponse.json(
          { success: false, error: "Unauthorized: Invalid or missing API key" },
          { status: 401 }
        );
      }
    }

    const body = await request.json();
    const invoiceNumber = String(body?.invoiceNumber || "").trim();
    const contentBase64 = String(body?.contentBase64 || "").trim();

    if (!invoiceNumber || !contentBase64) {
      return NextResponse.json(
        { success: false, error: "invoiceNumber and contentBase64 are required." },
        { status: 400 }
      );
    }

    const cleanBase64 = contentBase64.replace(/^data:application\/pdf;base64,/i, "");
    const pdfBuffer = Buffer.from(cleanBase64, "base64");

    if (pdfBuffer.length === 0 || pdfBuffer.length > MAX_PDF_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `PDF size invalid (${pdfBuffer.length} bytes). Max allowed is 10 MB.`,
        },
        { status: 400 }
      );
    }

    if (!pdfBuffer.subarray(0, 8).toString("ascii").includes("%PDF-")) {
      return NextResponse.json(
        { success: false, error: "Uploaded content is not a valid PDF binary (%PDF- header missing)." },
        { status: 400 }
      );
    }

    const supabase = getStorageSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Supabase Storage is not configured on the server." },
        { status: 500 }
      );
    }

    const dateFolder = new Date().toISOString().slice(0, 10);
    const safeName = invoiceNumber.replace(/[^A-Za-z0-9_-]/g, "_") || `doc_${Date.now()}`;
    const objectPath = `${dateFolder}/${safeName}.pdf`;

    let { error: uploadError } = await supabase.storage
      .from(PDF_BUCKET)
      .upload(objectPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    // If bucket doesn't exist yet and service role is available, attempt to create it automatically
    if (uploadError && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await supabase.storage.createBucket(PDF_BUCKET, { public: true }).catch(() => null);
      const retry = await supabase.storage.from(PDF_BUCKET).upload(objectPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });
      uploadError = retry.error;
    }

    if (uploadError) {
      console.error("[API /api/oracle-orders/upload-pdf] Storage error:", uploadError);
      return NextResponse.json(
        {
          success: false,
          error: `Storage upload failed (${uploadError.message}). Ensure supabase/oracle_pdfs_bucket.sql has been executed in Supabase SQL Editor.`,
        },
        { status: 502 }
      );
    }

    const { data: publicData } = supabase.storage.from(PDF_BUCKET).getPublicUrl(objectPath);

    // Opportunistically purge expired PDF folders (> 7 days) to keep free storage clean
    await cleanupExpiredPdfFolders(supabase);

    return NextResponse.json({
      success: true,
      url: publicData.publicUrl,
      path: objectPath,
      sizeBytes: pdfBuffer.length,
    });
  } catch (error: any) {
    console.error("[API /api/oracle-orders/upload-pdf] Exception:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to upload Onyx PDF" },
      { status: 500 }
    );
  }
}
