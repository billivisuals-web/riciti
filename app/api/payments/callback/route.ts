import { NextRequest, NextResponse } from "next/server";
import {
  parseSTKCallback,
  type STKCallbackData,
} from "@/lib/mpesa";
import {
  getPaymentByCheckoutRequestId,
  updatePaymentByCheckoutRequestId,
  markInvoicePaidByAdmin,
} from "@/lib/db/payments";

/**
 * POST /api/payments/callback
 * M-Pesa Daraja STK Push callback endpoint
 *
 * Called by Safaricom's servers after the user completes or cancels
 * the STK Push prompt on their phone. No authentication — Safaricom
 * doesn't send cookies or auth headers.
 *
 * IMPORTANT: Always return 200 OK to Safaricom, otherwise they retry.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as STKCallbackData;

    console.log(
      "[M-Pesa Callback] Received:",
      JSON.stringify(body, null, 2)
    );

    // Parse the callback data
    const result = parseSTKCallback(body);

    // Find the payment record
    const payment = await getPaymentByCheckoutRequestId(
      result.checkoutRequestId
    );

    if (!payment) {
      console.error(
        `[M-Pesa Callback] No payment found for CheckoutRequestID: ${result.checkoutRequestId}`
      );
      // Still return 200 to Safaricom
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    if (result.resultCode === 0) {
      // ---- PAYMENT SUCCESSFUL ----
      console.log(
        `[M-Pesa Callback] Payment successful. Receipt: ${result.mpesaReceiptNumber}`
      );

      // Parse the transaction date from Daraja format (YYYYMMDDHHmmss)
      let transactionDate: string | undefined;
      if (result.transactionDate) {
        const raw = result.transactionDate;
        if (raw.length >= 14) {
          const year = raw.substring(0, 4);
          const month = raw.substring(4, 6);
          const day = raw.substring(6, 8);
          const hours = raw.substring(8, 10);
          const minutes = raw.substring(10, 12);
          const seconds = raw.substring(12, 14);
          transactionDate = new Date(
            `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+03:00`
          ).toISOString();
        }
      }

      // Update payment to COMPLETED
      await updatePaymentByCheckoutRequestId(result.checkoutRequestId, {
        status: "COMPLETED",
        mpesaReceiptNumber: result.mpesaReceiptNumber,
        transactionDate,
        resultCode: String(result.resultCode),
        resultDesc: result.resultDesc,
        completedAt: new Date().toISOString(),
      });

      // Mark the invoice as paid
      await markInvoicePaidByAdmin(payment.invoiceId);
    } else {
      // ---- PAYMENT FAILED / CANCELLED ----
      // ResultCode 1032 = cancelled by user
      const status = result.resultCode === 1032 ? "CANCELLED" : "FAILED";

      console.log(
        `[M-Pesa Callback] Payment ${status}. Code: ${result.resultCode}, Desc: ${result.resultDesc}`
      );

      await updatePaymentByCheckoutRequestId(result.checkoutRequestId, {
        status,
        resultCode: String(result.resultCode),
        resultDesc: result.resultDesc,
      });
    }

    // Always respond with 200 to Safaricom
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("[M-Pesa Callback] Error processing callback:", error);
    // Still return 200 to prevent Safaricom retries
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
