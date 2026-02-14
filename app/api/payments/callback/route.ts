import { NextRequest, NextResponse } from "next/server";
import {
  parseSTKCallback,
  type STKCallbackData,
} from "@/lib/mpesa";
import {
  getPaymentByCheckoutRequestId,
  updatePaymentByCheckoutRequestId,
  markInvoicePaidByAdmin,
  getInvoiceByPublicIdAdmin,
} from "@/lib/db/payments";
import { getClientIP } from "@/lib/rate-limit";

/**
 * Safaricom M-Pesa production IPs (for callback verification).
 * In sandbox mode, allow all IPs.
 */
const SAFARICOM_IPS = new Set([
  "196.201.214.200",
  "196.201.214.206",
  "196.201.213.114",
  "196.201.214.207",
  "196.201.214.208",
]);

const IS_PRODUCTION = process.env.MPESA_ENVIRONMENT === "production";

/**
 * Secret token appended to the callback URL path.
 * Prevents forged callbacks even if IP whitelist is bypassed.
 */
const CALLBACK_SECRET = process.env.MPESA_CALLBACK_SECRET || "";

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
    // Callback secret token check (defense-in-depth alongside IP whitelist)
    if (CALLBACK_SECRET) {
      const url = new URL(request.url);
      const token = url.searchParams.get("token");
      if (token !== CALLBACK_SECRET) {
        console.warn(`[M-Pesa Callback] Rejected: invalid callback token`);
        return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
      }
    }

    // IP whitelist check in production
    if (IS_PRODUCTION) {
      const ip = getClientIP(request);
      if (!SAFARICOM_IPS.has(ip)) {
        console.warn(`[M-Pesa Callback] Rejected request from non-Safaricom IP: ${ip}`);
        return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
      }
    }

    const body = (await request.json()) as STKCallbackData;

    // Log only non-sensitive metadata (no phone numbers or full payload)
    const stkCb = body?.Body?.stkCallback;
    console.log(
      `[M-Pesa Callback] CheckoutRequestID=${stkCb?.CheckoutRequestID}, ResultCode=${stkCb?.ResultCode}`
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

    // Idempotency check — don't re-process already completed payments
    if (payment.status === "COMPLETED" || payment.status === "FAILED" || payment.status === "CANCELLED") {
      console.log(
        `[M-Pesa Callback] Payment ${payment.id} already in terminal state: ${payment.status}. Skipping.`
      );
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    if (result.resultCode === 0) {
      // ---- PAYMENT SUCCESSFUL ----
      console.log(
        `[M-Pesa Callback] Payment successful. Receipt: ${result.mpesaReceiptNumber}`
      );

      // Verify paid amount matches the payment record amount
      if (result.amount !== undefined && result.amount !== null) {
        const expectedAmount = Number(payment.amount);
        const paidAmount = Number(result.amount);
        if (Math.abs(paidAmount - expectedAmount) > 0.01) {
          console.error(
            `[M-Pesa Callback] Amount mismatch! Expected ${expectedAmount}, got ${paidAmount}. ` +
            `CheckoutRequestID: ${result.checkoutRequestId}`
          );
          // Still record the payment but flag it — do NOT mark invoice as paid
          await updatePaymentByCheckoutRequestId(result.checkoutRequestId, {
            status: "FAILED",
            mpesaReceiptNumber: result.mpesaReceiptNumber,
            resultCode: String(result.resultCode),
            resultDesc: `Amount mismatch: expected ${expectedAmount}, received ${paidAmount}`,
          });
          return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
        }
      }

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
