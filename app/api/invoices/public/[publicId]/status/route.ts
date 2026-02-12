import { NextRequest, NextResponse } from "next/server";
import { getInvoicePaymentStatus } from "@/lib/db/invoices";

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
    const { publicId } = await params;

    const status = await getInvoicePaymentStatus(publicId);

    if (!status) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      invoiceId: status.id,
      isPaid: status.isPaid,
      paidAt: status.paidAt,
      latestPayment: status.payments[0] || null,
    });
  } catch (error) {
    console.error("Error checking payment status:", error);
    return NextResponse.json(
      { error: "Failed to check payment status" },
      { status: 500 }
    );
  }
}
