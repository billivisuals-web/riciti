import { NextRequest, NextResponse } from "next/server";
import {
  initiateSTKPush,
  normalizePhoneNumber,
} from "@/lib/mpesa";
import {
  createPaymentAtomic,
  updatePaymentById,
  getInvoiceByPublicIdAdmin,
} from "@/lib/db/payments";
import { PaymentInitiateSchema } from "@/lib/validators";
import { paymentLimiter, getClientIP, consumeRateLimit } from "@/lib/rate-limit";
import { SERVICE_FEE_AMOUNT, SERVICE_FEE_CURRENCY } from "@/lib/pricing";

/**
 * POST /api/payments/initiate
 * Initiate an M-Pesa STK Push for an invoice
 *
 * Body: { publicId: string, phoneNumber: string }
 * Returns: { checkoutRequestId, customerMessage }
 *
 * No auth required — payers access invoices via public sharing links.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit — 5 requests/minute per IP
    const ip = getClientIP(request);
    const { allowed, retryAfterMs } = await consumeRateLimit(paymentLimiter, ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many payment requests. Please wait before trying again." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
        }
      );
    }

    const body = await request.json();

    // Validate with Zod
    const parsed = PaymentInitiateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { publicId, phoneNumber } = parsed.data;

    // Normalize phone number to 254XXXXXXXXX
    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhoneNumber(phoneNumber);
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid phone number. Use format 07XXXXXXXX or 254XXXXXXXXX",
        },
        { status: 400 }
      );
    }

    // ---- Look up invoice ----
    const invoice = await getInvoiceByPublicIdAdmin(publicId);

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    if (invoice.isPaid) {
      return NextResponse.json(
        { error: "This invoice has already been paid" },
        { status: 400 }
      );
    }

    // ---- Atomically create payment record (prevents double payments) ----
    // Charge the fixed platform service fee (KSH 10), NOT the invoice total
    const payment = await createPaymentAtomic({
      invoiceId: invoice.id,
      userId: invoice.userId,
      phoneNumber: normalizedPhone,
      amount: SERVICE_FEE_AMOUNT,
      currency: SERVICE_FEE_CURRENCY,
    });

    if ('error' in payment) {
      return NextResponse.json(
        { error: payment.error },
        { status: 409 }
      );
    }

    // ---- Determine callback URL ----
    const baseCallbackUrl =
      process.env.MPESA_CALLBACK_URL ||
      `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/callback`;
    
    // Append secret token for callback verification (defense-in-depth)
    const callbackSecret = process.env.MPESA_CALLBACK_SECRET;
    const callbackUrl = callbackSecret
      ? `${baseCallbackUrl}?token=${callbackSecret}`
      : baseCallbackUrl;

    // ---- Initiate STK Push ----
    // STK Push charges the fixed service fee, not the invoice total
    const stkResponse = await initiateSTKPush({
      phoneNumber: normalizedPhone,
      amount: SERVICE_FEE_AMOUNT,
      accountReference: invoice.invoiceNumber,
      transactionDesc: "Riciti Service Fee",
      callbackUrl,
    });

    // ---- Update payment with Daraja response (PROCESSING) ----
    await updatePaymentById(payment.id, {
      status: "PROCESSING",
      merchantRequestId: stkResponse.MerchantRequestID,
      checkoutRequestId: stkResponse.CheckoutRequestID,
    });

    return NextResponse.json({
      success: true,
      checkoutRequestId: stkResponse.CheckoutRequestID,
      customerMessage: stkResponse.CustomerMessage,
      paymentId: payment.id,
    });
  } catch (error) {
    console.error("Error initiating M-Pesa payment:", error);

    return NextResponse.json(
      { error: "Failed to initiate payment" },
      { status: 500 }
    );
  }
}
