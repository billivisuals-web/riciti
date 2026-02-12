/**
 * Payment Data Access Layer
 * CRUD operations for the Payment table (M-Pesa transactions)
 * Uses the admin client (service role) to bypass RLS since
 * payment operations are triggered by server-side API routes.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { Payment, PaymentStatus } from "./types";

// ============================================================================
// HELPERS
// ============================================================================

function generateCuid(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 12);
  return `c${timestamp}${randomPart}`;
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

export async function createPayment(
  input: CreatePaymentInput
): Promise<Payment> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("Payment")
    .insert({
      id: generateCuid(),
      invoiceId: input.invoiceId,
      userId: input.userId || null,
      phoneNumber: input.phoneNumber,
      amount: input.amount,
      currency: input.currency || "KES",
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single();

  if (error) throw error;
  return toPayment(data);
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

  const { data, error } = await supabase
    .from("Payment")
    .update(updateData)
    .eq("checkoutRequestId", checkoutRequestId)
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
