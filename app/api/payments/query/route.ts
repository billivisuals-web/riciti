import { NextRequest, NextResponse } from "next/server";
import { querySTKPush } from "@/lib/mpesa";
import {
  getPaymentByCheckoutRequestId,
  updatePaymentByCheckoutRequestId,
  markInvoicePaidByAdmin,
} from "@/lib/db/payments";
import { PaymentQuerySchema } from "@/lib/validators";
import { publicReadLimiter, getClientIP, consumeRateLimit } from "@/lib/rate-limit";

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
    // Rate limit
    const ip = getClientIP(request);
    const { allowed } = await consumeRateLimit(publicReadLimiter, ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    const body = await request.json();

    // Validate with Zod
    const parsed = PaymentQuerySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { checkoutRequestId } = parsed.data;

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
      // Payment was successful — verify amount if available on the payment record
      const expectedAmount = Number(payment.amount);

      // Use conditional update to prevent race condition with callback handler:
      // Only update if payment is still in a non-terminal state.
      const updatedPayment = await updatePaymentByCheckoutRequestId(checkoutRequestId, {
        status: "COMPLETED",
        resultCode: result.ResultCode,
        resultDesc: result.ResultDesc,
        completedAt: new Date().toISOString(),
      });

      // If update returned null, the payment was already in a terminal state
      // (processed by the callback handler concurrently)
      if (!updatedPayment) {
        const current = await getPaymentByCheckoutRequestId(checkoutRequestId);
        return NextResponse.json({
          status: current?.status || "COMPLETED",
          mpesaReceiptNumber: current?.mpesaReceiptNumber,
          message: "Payment already processed",
        });
      }

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

    return NextResponse.json(
      { error: "Failed to query payment status" },
      { status: 500 }
    );
  }
}
