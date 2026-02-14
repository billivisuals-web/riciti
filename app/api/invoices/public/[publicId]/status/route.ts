import { NextRequest, NextResponse } from "next/server";
import { getInvoicePaymentStatus } from "@/lib/db/invoices";
import { publicReadLimiter, getClientIP, consumeRateLimit } from "@/lib/rate-limit";

type RouteParams = {
  params: Promise<{ publicId: string }>;
};

/**
 * GET /api/invoices/public/[publicId]/status
 * Check the payment status of an invoice
 * Used for polling after M-Pesa STK push
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limit
    const ip = getClientIP(request);
    const { allowed, retryAfterMs } = await consumeRateLimit(publicReadLimiter, ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
        }
      );
    }

    const { publicId } = await params;

    const status = await getInvoicePaymentStatus(publicId);

    if (!status) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    const response = NextResponse.json({
      invoiceId: status.id,
      isPaid: status.isPaid,
      paidAt: status.paidAt,
      latestPayment: status.payments[0] || null,
    });

    // Never cache payment status — must be fresh for polling
    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error) {
    console.error("Error checking payment status:", error);
    return NextResponse.json(
      { error: "Failed to check payment status" },
      { status: 500 }
    );
  }
}
