import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { getInvoiceByPublicId } from "@/lib/db/invoices";
import { InvoicePDF } from "@/lib/pdf/invoice-template";
import { publicReadLimiter, getClientIP, consumeRateLimit } from "@/lib/rate-limit";

type RouteParams = {
  params: Promise<{ publicId: string }>;
};

/**
 * GET /api/invoices/public/[publicId]/pdf
 *
 * Generate and stream a PDF for a paid invoice.
 * Returns 402 Payment Required if the invoice hasn't been paid.
 * The PDF contains the full invoice with no service fee and no watermark.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limit — prevent PDF generation abuse
    const ip = getClientIP(request);
    const { allowed, retryAfterMs } = await consumeRateLimit(publicReadLimiter, ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before trying again." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
        }
      );
    }

    const { publicId } = await params;

    // Fetch the full invoice with line items
    const invoice = await getInvoiceByPublicId(publicId);

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Gate download behind payment
    if (!invoice.isPaid) {
      return NextResponse.json(
        { error: "Payment required to download this invoice" },
        { status: 402 }
      );
    }

    // Generate the PDF buffer
    const pdfBuffer = await renderToBuffer(
      React.createElement(InvoicePDF, { invoice }) as React.ReactElement
    );

    // Build a safe filename
    const safeNumber = (invoice.invoiceNumber || "invoice")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 60);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeNumber}.pdf"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("Error generating invoice PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
