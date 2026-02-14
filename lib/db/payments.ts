/**
 * Payment Data Access Layer
 * CRUD operations for the Payment table (M-Pesa transactions)
 * Uses the admin client (service role) to bypass RLS since
 * payment operations are triggered by server-side API routes.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createId } from "@paralleldrive/cuid2";
import { Payment, PaymentStatus } from "./types";

// ============================================================================
// HELPERS
// ============================================================================

function generateCuid(): string {
  return createId();
}

function toPayment(row: Record<string, unknown>): Payment {
  return {
    id: row.id as string,
    invoiceId: row.invoiceId as string,
    userId: row.userId as string | null,
    phoneNumber: row.phoneNumber as string,
    amount: row.amount as number,
    currency: row.currency as string,
    merchantRequestId: row.merchantRequestId as string | null,
    checkoutRequestId: row.checkoutRequestId as string | null,
    mpesaReceiptNumber: row.mpesaReceiptNumber as string | null,
    transactionDate: row.transactionDate
      ? new Date(row.transactionDate as string)
      : null,
    status: row.status as PaymentStatus,
    resultCode: row.resultCode as string | null,
    resultDesc: row.resultDesc as string | null,
    createdAt: new Date(row.createdAt as string),
    updatedAt: new Date(row.updatedAt as string),
    completedAt: row.completedAt
      ? new Date(row.completedAt as string)
      : null,
  };
}

// ============================================================================
// CREATE
// ============================================================================

export type CreatePaymentInput = {
  invoiceId: string;
  userId?: string | null;
  phoneNumber: string;
  amount: number;
  currency?: string;
};

/**
 * Atomically create a payment only if the invoice is unpaid and no
 * other payment is in progress. Uses a Postgres RPC with row-level
 * locking (SELECT ... FOR UPDATE) to prevent double payments.
 */
export async function createPaymentAtomic(
  input: CreatePaymentInput
): Promise<Payment | { error: string }> {
  const supabase = createAdminClient();
  const paymentId = generateCuid();

  const { data, error } = await supabase.rpc("create_payment_if_unpaid", {
    p_id: paymentId,
    p_invoice_id: input.invoiceId,
    p_user_id: input.userId || null,
    p_phone_number: input.phoneNumber,
    p_amount: input.amount,
    p_currency: input.currency || "KES",
  });

  if (error) {
    console.error("createPaymentAtomic RPC error:", error);
    throw error;
  }

  const result = typeof data === "string" ? JSON.parse(data) : data;

  if (result.error) {
    return { error: result.error };
  }

  return toPayment(result);
}

// ============================================================================
// UPDATE BY CHECKOUT REQUEST ID
// ============================================================================

export type UpdatePaymentInput = {
  status?: PaymentStatus;
  merchantRequestId?: string;
  checkoutRequestId?: string;
  mpesaReceiptNumber?: string;
  transactionDate?: string;
  resultCode?: string;
  resultDesc?: string;
  completedAt?: string;
};

export async function updatePaymentById(
  id: string,
  input: UpdatePaymentInput
): Promise<Payment | null> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = { updatedAt: now };

  if (input.status !== undefined) updateData.status = input.status;
  if (input.merchantRequestId !== undefined)
    updateData.merchantRequestId = input.merchantRequestId;
  if (input.checkoutRequestId !== undefined)
    updateData.checkoutRequestId = input.checkoutRequestId;
  if (input.mpesaReceiptNumber !== undefined)
    updateData.mpesaReceiptNumber = input.mpesaReceiptNumber;
  if (input.transactionDate !== undefined)
    updateData.transactionDate = input.transactionDate;
  if (input.resultCode !== undefined) updateData.resultCode = input.resultCode;
  if (input.resultDesc !== undefined) updateData.resultDesc = input.resultDesc;
  if (input.completedAt !== undefined) updateData.completedAt = input.completedAt;

  const { data, error } = await supabase
    .from("Payment")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) return null;
  return toPayment(data);
}

export async function updatePaymentByCheckoutRequestId(
  checkoutRequestId: string,
  input: UpdatePaymentInput
): Promise<Payment | null> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = { updatedAt: now };

  if (input.status !== undefined) updateData.status = input.status;
  if (input.merchantRequestId !== undefined)
    updateData.merchantRequestId = input.merchantRequestId;
  if (input.checkoutRequestId !== undefined)
    updateData.checkoutRequestId = input.checkoutRequestId;
  if (input.mpesaReceiptNumber !== undefined)
    updateData.mpesaReceiptNumber = input.mpesaReceiptNumber;
  if (input.transactionDate !== undefined)
    updateData.transactionDate = input.transactionDate;
  if (input.resultCode !== undefined) updateData.resultCode = input.resultCode;
  if (input.resultDesc !== undefined) updateData.resultDesc = input.resultDesc;
  if (input.completedAt !== undefined) updateData.completedAt = input.completedAt;

  // Conditional update: only update if payment is NOT in a terminal state.
  // This prevents race conditions between callback and query handlers.
  const { data, error } = await supabase
    .from("Payment")
    .update(updateData)
    .eq("checkoutRequestId", checkoutRequestId)
    .not("status", "in", '("COMPLETED","FAILED","CANCELLED")')
    .select()
    .single();

  if (error) return null;
  return toPayment(data);
}

// ============================================================================
// QUERIES
// ============================================================================

export async function getPaymentByCheckoutRequestId(
  checkoutRequestId: string
): Promise<Payment | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("Payment")
    .select("*")
    .eq("checkoutRequestId", checkoutRequestId)
    .single();

  if (error || !data) return null;
  return toPayment(data);
}

export async function getPaymentById(id: string): Promise<Payment | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("Payment")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return toPayment(data);
}

export async function getPaymentsByInvoiceId(
  invoiceId: string
): Promise<Payment[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("Payment")
    .select("*")
    .eq("invoiceId", invoiceId)
    .order("createdAt", { ascending: false });

  if (error || !data) return [];
  return data.map(toPayment);
}

// ============================================================================
// MARK INVOICE AS PAID (bypasses tenant context)
// ============================================================================

/**
 * Mark an invoice as paid using the admin client.
 * Used by the M-Pesa callback where there's no user session.
 */
export async function markInvoicePaidByAdmin(
  invoiceId: string
): Promise<boolean> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("Invoice")
    .update({
      isPaid: true,
      paidAt: now,
      updatedAt: now,
    })
    .eq("id", invoiceId);

  return !error;
}

/**
 * Fetch an invoice by publicId using the admin client (no RLS).
 */
export async function getInvoiceByPublicIdAdmin(publicId: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("Invoice")
    .select("id, publicId, invoiceNumber, total, currency, isPaid, userId")
    .eq("publicId", publicId)
    .single();

  if (error || !data) return null;
  return data as {
    id: string;
    publicId: string;
    invoiceNumber: string;
    total: number;
    currency: string;
    isPaid: boolean;
    userId: string | null;
  };
}
