import { NextRequest, NextResponse } from "next/server";
import { getInvoiceByPublicId } from "@/lib/db/invoices";
import { publicReadLimiter, getClientIP, consumeRateLimit } from "@/lib/rate-limit";

type RouteParams = {
  params: Promise<{ publicId: string }>;
};

/**
 * GET /api/invoices/public/[publicId]
 * Get an invoice by its public ID (for shareable links)
 * No authentication required - accessible to anyone with the link
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limit
    const ip = getClientIP(request);
    const { allowed } = await consumeRateLimit(publicReadLimiter, ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    const { publicId } = await params;

    const invoice = await getInvoiceByPublicId(publicId);

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Return a sanitized version (remove sensitive data if needed)
    const response = NextResponse.json({
      id: invoice.id,
      publicId: invoice.publicId,
      documentType: invoice.documentType,
      documentTitle: invoice.documentTitle,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      paymentTerms: invoice.paymentTerms,
      fromName: invoice.fromName,
      fromEmail: invoice.fromEmail,
      fromPhone: invoice.fromPhone,
      fromAddress: invoice.fromAddress,
      fromCity: invoice.fromCity,
      fromZipCode: invoice.fromZipCode,
      fromBusinessNumber: invoice.fromBusinessNumber,
      toName: invoice.toName,
      toEmail: invoice.toEmail,
      toPhone: invoice.toPhone,
      toAddress: invoice.toAddress,
      toCity: invoice.toCity,
      toZipCode: invoice.toZipCode,
      currency: invoice.currency,
      taxRate: invoice.taxRate,
      discountType: invoice.discountType,
      discountValue: invoice.discountValue,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      discountAmount: invoice.discountAmount,
      total: invoice.total,
      accentColor: invoice.accentColor,
      logoDataUrl: invoice.logoDataUrl,
      notes: invoice.notes,
      items: invoice.items,
      isPaid: invoice.isPaid,
    });

    // Public invoices change rarely — cache aggressively
    response.headers.set(
      "Cache-Control",
      "public, max-age=60, stale-while-revalidate=300"
    );

    return response;
  } catch (error) {
    console.error("Error fetching public invoice:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
      { status: 500 }
    );
  }
}
