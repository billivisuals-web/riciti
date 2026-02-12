import { NextRequest, NextResponse } from "next/server";
import {
  initiateSTKPush,
  normalizePhoneNumber,
} from "@/lib/mpesa";
import {
  createPayment,
  updatePaymentById,
  getInvoiceByPublicIdAdmin,
} from "@/lib/db/payments";

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
    const body = await request.json();
    const { publicId, phoneNumber } = body;

    // ---- Validate input ----
    if (!publicId || !phoneNumber) {
      return NextResponse.json(
        { error: "publicId and phoneNumber are required" },
        { status: 400 }
      );
    }

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

    if (invoice.total <= 0) {
      return NextResponse.json(
        { error: "Invoice total must be greater than 0" },
        { status: 400 }
      );
    }

    // ---- Create payment record (PENDING) ----
    const payment = await createPayment({
      invoiceId: invoice.id,
      userId: invoice.userId,
      phoneNumber: normalizedPhone,
      amount: invoice.total,
      currency: invoice.currency,
    });

    // ---- Determine callback URL ----
    const callbackUrl =
      process.env.MPESA_CALLBACK_URL ||
      `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/callback`;

    // ---- Initiate STK Push ----
    const stkResponse = await initiateSTKPush({
      phoneNumber: normalizedPhone,
      amount: invoice.total,
      accountReference: invoice.invoiceNumber,
      transactionDesc: "Invoice Pay",
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

    const message =
      error instanceof Error ? error.message : "Failed to initiate payment";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
