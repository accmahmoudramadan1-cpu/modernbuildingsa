import { NextRequest } from "next/server";
import { getOracleInvoices } from "@/lib/oracle-invoices";

export const dynamic = "force-dynamic";

const DOC_TYPE_ENGLISH_LABELS: Record<string, string> = {
  cash_invoice: "Cash Sales Invoice (SI-CASH)",
  credit_invoice: "Credit Sales Invoice (SI-CREDIT)",
  receipt_voucher: "Receipt Voucher (RV)",
  account_statement: "Customer Account Statement (ALRTT002)",
  price_quotation: "Price Quotation (QT)",
  purchase_order: "Purchase Order (PO)",
  customer_discount_notice: "Customer Discount Notice (ARST045)",
  direct_alert: "Direct Financial Notice (ALRTT002)",
};

function toSafePdfAscii(value: unknown, fallback = "-"): string {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  // Standard PDF Type1 Helvetica supports printable ASCII cleanly; strip unsupported codepoints
  const ascii = raw.replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
  const text = ascii || fallback;
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildInvoicePdfBuffer(fields: {
  invoiceNumber: string;
  docTypeLabel: string;
  invoiceDate: string;
  amount: string;
  remainingBalance: string;
  paymentMethod: string;
  customerCode: string;
  phone: string;
}): Buffer {
  const lines: Array<{ text: string; size: number; bold?: boolean; gapAfter?: number }> = [
    { text: "MODERN BUILDING COMPANY", size: 20, bold: true, gapAfter: 8 },
    { text: "Onyx Pro ERP - Official WhatsApp Document", size: 11, bold: false, gapAfter: 24 },
    { text: "-----------------------------------------------------------------------", size: 10, gapAfter: 18 },
    { text: `Document Type:       ${fields.docTypeLabel}`, size: 12, bold: true, gapAfter: 18 },
    { text: `Document Number:     ${fields.invoiceNumber}`, size: 12, bold: true, gapAfter: 16 },
    { text: `Issue Date:          ${fields.invoiceDate}`, size: 12, gapAfter: 16 },
    { text: `Customer / Ref Code: ${fields.customerCode}`, size: 12, gapAfter: 16 },
    { text: `Registered Mobile:   ${fields.phone}`, size: 12, gapAfter: 16 },
    { text: `Payment Method:      ${fields.paymentMethod}`, size: 12, gapAfter: 22 },
    { text: "-----------------------------------------------------------------------", size: 10, gapAfter: 18 },
    { text: `Total Amount:        ${fields.amount} SAR`, size: 14, bold: true, gapAfter: 16 },
    { text: `Remaining Balance:   ${fields.remainingBalance} SAR`, size: 13, bold: true, gapAfter: 28 },
    { text: "-----------------------------------------------------------------------", size: 10, gapAfter: 22 },
    { text: "Thank you for your business with Modern Building.", size: 11, gapAfter: 14 },
    { text: "Web Portal: https://www.modernbuildingsa.com", size: 10, gapAfter: 10 },
  ];

  const streamOps: string[] = ["BT"];
  let y = 780;
  for (const line of lines) {
    const fontKey = line.bold ? "/F2" : "/F1";
    streamOps.push(`${fontKey} ${line.size} Tf`);
    streamOps.push(`1 0 0 1 52 ${y} Tm`);
    streamOps.push(`(${line.text}) Tj`);
    y -= line.size + (line.gapAfter ?? 12);
  }
  streamOps.push("ET");
  const streamContent = streamOps.join("\n");
  const streamLength = Buffer.byteLength(streamContent, "utf8");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n",
    `6 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
  ];

  const header = "%PDF-1.4\n";
  const parts: string[] = [header];
  const offsets: number[] = [0];
  let currentOffset = Buffer.byteLength(header, "utf8");

  for (const obj of objects) {
    offsets.push(currentOffset);
    parts.push(obj);
    currentOffset += Buffer.byteLength(obj, "utf8");
  }

  const xrefOffset = currentOffset;
  parts.push(`xref\n0 ${objects.length + 1}\n`);
  parts.push("0000000000 65535 f \n");
  for (let i = 1; i < offsets.length; i++) {
    parts.push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  parts.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  return Buffer.from(parts.join(""), "utf8");
}

/**
 * GET /api/whatsapp/invoice-pdf?invoiceNumber=...
 * Generates a valid binary PDF for any Onyx Pro document so Meta WhatsApp Document Headers can attach it.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const invoiceNumber = (searchParams.get("invoiceNumber") || "").trim();

  let matched: any = null;
  if (invoiceNumber) {
    try {
      const all = await getOracleInvoices();
      matched = all.find((inv) => inv.invoice_number === invoiceNumber) || null;
    } catch {
      matched = null;
    }
  }

  const docTypeKey = matched?.doc_type || searchParams.get("docType") || "cash_invoice";
  const docTypeLabel = DOC_TYPE_ENGLISH_LABELS[docTypeKey] || toSafePdfAscii(docTypeKey, "Document");
  const safeDocNo = toSafePdfAscii(matched?.invoice_number || invoiceNumber, "DOC-000");
  const safeDate = toSafePdfAscii(matched?.invoice_date || searchParams.get("date"), new Date().toISOString().split("T")[0]);
  const safeAmount = toSafePdfAscii(matched?.amount ?? searchParams.get("amount"), "0.00");
  const safeRemaining = toSafePdfAscii(
    matched?.remaining_balance !== undefined && matched?.remaining_balance !== null
      ? matched.remaining_balance
      : matched?.amount ?? searchParams.get("amount"),
    "0.00"
  );
  const safeMethodRaw = String(matched?.payment_method || "");
  const paymentMethodAscii =
    safeMethodRaw.includes("آجل")
      ? "Credit"
      : safeMethodRaw.includes("تحويل")
        ? "Bank Transfer"
        : safeMethodRaw.includes("شيك")
          ? "Cheque"
          : safeMethodRaw.includes("نقد")
            ? "Cash"
            : safeMethodRaw.includes("خصم")
              ? "Customer Discount"
              : toSafePdfAscii(safeMethodRaw, docTypeKey === "credit_invoice" ? "Credit" : "Standard");

  const pdfBuffer = buildInvoicePdfBuffer({
    invoiceNumber: safeDocNo,
    docTypeLabel,
    invoiceDate: safeDate,
    amount: safeAmount,
    remainingBalance: safeRemaining,
    paymentMethod: paymentMethodAscii,
    customerCode: toSafePdfAscii(matched?.customer_code, "N/A"),
    phone: toSafePdfAscii(matched?.phone, "N/A"),
  });

  const downloadName = `ModernBuilding_${safeDocNo.replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`;

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${downloadName}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
