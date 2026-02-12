import { NextRequest, NextResponse } from "next/server";
import { querySTKPush } from "@/lib/mpesa";
import {
  getPaymentByCheckoutRequestId,
  updatePaymentByCheckoutRequestId,
  markInvoicePaidByAdmin,
} from "@/lib/db/payments";

/**
 * POST /api/payments/query
 * Manually query the status of an STK Push request
 *
 * Body: { checkoutRequestId: string }
 *
 * Useful as a fallback if the callback doesn't arrive
 * (e.g., ngrok tunnel is down during development).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { checkoutRequestId } = body;

    if (!checkoutRequestId) {
      return NextResponse.json(
        { error: "checkoutRequestId is required" },
        { status: 400 }
      );
    }

    // Query Daraja for the transaction status
    const result = await querySTKPush(checkoutRequestId);

    // Find our payment record
    const payment = await getPaymentByCheckoutRequestId(checkoutRequestId);

    if (!payment) {
      return NextResponse.json(
        { error: "Payment record not found" },
        { status: 404 }
      );
    }

    // If already completed, just return current status
    if (payment.status === "COMPLETED") {
      return NextResponse.json({
        status: "COMPLETED",
        mpesaReceiptNumber: payment.mpesaReceiptNumber,
        message: "Payment already completed",
      });
    }

    // Update based on Daraja query response
    if (result.ResultCode === "0") {
      // Payment was successful
      await updatePaymentByCheckoutRequestId(checkoutRequestId, {
        status: "COMPLETED",
        resultCode: result.ResultCode,
        resultDesc: result.ResultDesc,
        completedAt: new Date().toISOString(),
      });

      await markInvoicePaidByAdmin(payment.invoiceId);

      return NextResponse.json({
        status: "COMPLETED",
        resultCode: result.ResultCode,
        resultDesc: result.ResultDesc,
      });
    } else if (result.ResultCode === "1032") {
      // Cancelled by user
      await updatePaymentByCheckoutRequestId(checkoutRequestId, {
        status: "CANCELLED",
        resultCode: result.ResultCode,
        resultDesc: result.ResultDesc,
      });

      return NextResponse.json({
        status: "CANCELLED",
        resultCode: result.ResultCode,
        resultDesc: result.ResultDesc,
      });
    } else if (result.ResultCode === "1037") {
      // Timeout — DS timeout, still processing
      return NextResponse.json({
        status: "PROCESSING",
        resultCode: result.ResultCode,
        resultDesc: result.ResultDesc,
      });
    } else {
      // Other failure
      await updatePaymentByCheckoutRequestId(checkoutRequestId, {
        status: "FAILED",
        resultCode: result.ResultCode,
        resultDesc: result.ResultDesc,
      });

      return NextResponse.json({
        status: "FAILED",
        resultCode: result.ResultCode,
        resultDesc: result.ResultDesc,
      });
    }
  } catch (error) {
    console.error("Error querying M-Pesa payment status:", error);

    const message =
      error instanceof Error ? error.message : "Failed to query payment status";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
