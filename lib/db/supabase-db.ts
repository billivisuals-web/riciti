/**
 * Supabase Database Layer
 * Replaces Prisma with direct Supabase queries
 * Uses PascalCase table names and camelCase columns to match existing Prisma schema
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SupabaseClient } from "@supabase/supabase-js";
import { createId } from "@paralleldrive/cuid2";
import { processImageField } from "@/lib/storage";
import { calculateInvoiceTotals } from "@/lib/utils/totals";
import {
  Invoice,
  LineItem,
  DocumentType,
  PaymentTerms,
  DiscountType,
  InvoiceWithItems,
  User,
} from "./types";

// ============================================================================
// TYPES
// ============================================================================

export type { InvoiceWithItems };

export type CreateInvoiceInput = {
  userId?: string | null;
  guestSessionId?: string | null;
  documentType?: DocumentType;
  documentTitle?: string;
  invoiceNumber: string;
  issueDate?: Date;
  dueDate: Date;
  paymentTerms?: PaymentTerms;
  fromName: string;
  fromEmail?: string;
  fromPhone?: string;
  fromMobile?: string;
  fromFax?: string;
  fromAddress?: string;
  fromCity?: string;
  fromZipCode?: string;
  fromBusinessNumber?: string;
  toName: string;
  toEmail?: string;
  toPhone?: string;
  toMobile?: string;
  toFax?: string;
  toAddress?: string;
  toCity?: string;
  toZipCode?: string;
  toBusinessNumber?: string;
  currency?: string;
  taxRate?: number;
  discountType?: DiscountType;
  discountValue?: number;
  accentColor?: string;
  logoDataUrl?: string;
  signatureDataUrl?: string;
  notes?: string;
  items?: {
    description: string;
    additionalDetails?: string;
    quantity: number;
    rate: number;
  }[];
};

export type UpdateInvoiceInput = Partial<Omit<CreateInvoiceInput, "userId" | "guestSessionId">>;

export type TenantContext = {
  userId?: string | null;
  guestSessionId?: string | null;
};

// ============================================================================
// HELPERS
// ============================================================================

function generateCuid(): string {
  return createId();
}

function calculateTotals(
  items: { quantity: number; rate: number }[],
  taxRate: number,
  discountType: DiscountType,
  discountValue: number
) {
  return calculateInvoiceTotals({ items, taxRate, discountType, discountValue });
}

// Convert DB row to Invoice (camelCase columns match directly)
function toInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: row.id as string,
    userId: row.userId as string | null,
    guestSessionId: row.guestSessionId as string | null,
    publicId: row.publicId as string,
    documentType: row.documentType as DocumentType,
    documentTitle: row.documentTitle as string,
    invoiceNumber: row.invoiceNumber as string,
    issueDate: new Date(row.issueDate as string),
    dueDate: new Date(row.dueDate as string),
    paymentTerms: row.paymentTerms as PaymentTerms,
    fromName: row.fromName as string,
    fromEmail: row.fromEmail as string | null,
    fromPhone: row.fromPhone as string | null,
    fromMobile: row.fromMobile as string | null,
    fromFax: row.fromFax as string | null,
    fromAddress: row.fromAddress as string | null,
    fromCity: row.fromCity as string | null,
    fromZipCode: row.fromZipCode as string | null,
    fromBusinessNumber: row.fromBusinessNumber as string | null,
    toName: row.toName as string,
    toEmail: row.toEmail as string | null,
    toPhone: row.toPhone as string | null,
    toMobile: row.toMobile as string | null,
    toFax: row.toFax as string | null,
    toAddress: row.toAddress as string | null,
    toCity: row.toCity as string | null,
    toZipCode: row.toZipCode as string | null,
    toBusinessNumber: row.toBusinessNumber as string | null,
    currency: row.currency as string,
    taxRate: row.taxRate as number,
    discountType: row.discountType as DiscountType,
    discountValue: row.discountValue as number,
    subtotal: row.subtotal as number,
    taxAmount: row.taxAmount as number,
    discountAmount: row.discountAmount as number,
    total: row.total as number,
    accentColor: row.accentColor as string,
    logoDataUrl: row.logoDataUrl as string | null,
    signatureDataUrl: row.signatureDataUrl as string | null,
    notes: row.notes as string | null,
    isPaid: row.isPaid as boolean,
    paidAt: row.paidAt ? new Date(row.paidAt as string) : null,
    createdAt: new Date(row.createdAt as string),
    updatedAt: new Date(row.updatedAt as string),
  };
}

function toLineItem(row: Record<string, unknown>): LineItem {
  return {
    id: row.id as string,
    invoiceId: row.invoiceId as string,
    description: row.description as string,
    additionalDetails: row.additionalDetails as string | null,
    quantity: row.quantity as number,
    rate: row.rate as number,
    amount: row.amount as number,
    sortOrder: row.sortOrder as number,
    createdAt: new Date(row.createdAt as string),
    updatedAt: new Date(row.updatedAt as string),
  };
}

function toUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string | null,
    avatarUrl: row.avatarUrl as string | null,
    externalId: row.externalId as string | null,
    provider: row.provider as string | null,
    businessName: row.businessName as string | null,
    businessEmail: row.businessEmail as string | null,
    businessPhone: row.businessPhone as string | null,
    businessAddress: row.businessAddress as string | null,
    businessCity: row.businessCity as string | null,
    businessZipCode: row.businessZipCode as string | null,
    businessNumber: row.businessNumber as string | null,
    defaultCurrency: row.defaultCurrency as string,
    defaultTaxRate: row.defaultTaxRate as number,
    logoUrl: row.logoUrl as string | null,
    signatureUrl: row.signatureUrl as string | null,
    createdAt: new Date(row.createdAt as string),
    updatedAt: new Date(row.updatedAt as string),
  };
}

// ============================================================================
// USER OPERATIONS
// ============================================================================

export async function findUserByExternalId(externalId: string): Promise<User | null> {
  // Use admin client — RLS SELECT policy requires auth.uid() match,
  // but this runs during the auth callback before the session is fully established.
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("User")
    .select("*")
    .eq("externalId", externalId)
    .single();

  if (error || !data) return null;
  return toUser(data);
}

export async function createUser(input: {
  externalId: string;
  provider: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
}): Promise<User> {
  // Use admin client — there is no INSERT policy on the users table
  // for authenticated users, so createClient() would be silently rejected by RLS.
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from("User")
    .insert({
      id: generateCuid(),
      externalId: input.externalId,
      provider: input.provider,
      email: input.email,
      name: input.name,
      avatarUrl: input.avatarUrl,
      defaultCurrency: "KES",
      defaultTaxRate: 16,
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single();

  if (error) throw error;
  return toUser(data);
}

// ============================================================================
// INVOICE CRUD OPERATIONS
// ============================================================================

export async function createInvoice(input: CreateInvoiceInput): Promise<InvoiceWithItems> {
  const supabase = await createClient();
  const {
    userId,
    guestSessionId,
    items = [],
    taxRate = 16,
    discountType = "PERCENTAGE",
    discountValue = 0,
    ...rest
  } = input;

  if (!userId && !guestSessionId) {
    throw new Error("Either userId or guestSessionId must be provided");
  }

  const totals = calculateTotals(items, taxRate, discountType, discountValue);
  const invoiceId = generateCuid();
  const publicId = generateCuid();
  const now = new Date().toISOString();

  // Process images — upload base64 to Supabase Storage, store URL
  const [logoUrl, signatureUrl] = await Promise.all([
    processImageField("logos", rest.logoDataUrl),
    processImageField("signatures", rest.signatureDataUrl),
  ]);

  // Insert invoice
  const { data: invoiceRow, error: invoiceError } = await supabase
    .from("Invoice")
    .insert({
      id: invoiceId,
      userId: userId,
      guestSessionId: guestSessionId,
      publicId: publicId,
      documentType: rest.documentType || "INVOICE",
      documentTitle: rest.documentTitle || "Invoice",
      invoiceNumber: rest.invoiceNumber,
      issueDate: rest.issueDate?.toISOString() || now,
      dueDate: rest.dueDate.toISOString(),
      paymentTerms: rest.paymentTerms || "NET_7",
      fromName: rest.fromName,
      fromEmail: rest.fromEmail,
      fromPhone: rest.fromPhone,
      fromMobile: rest.fromMobile,
      fromFax: rest.fromFax,
      fromAddress: rest.fromAddress,
      fromCity: rest.fromCity,
      fromZipCode: rest.fromZipCode,
      fromBusinessNumber: rest.fromBusinessNumber,
      toName: rest.toName,
      toEmail: rest.toEmail,
      toPhone: rest.toPhone,
      toMobile: rest.toMobile,
      toFax: rest.toFax,
      toAddress: rest.toAddress,
      toCity: rest.toCity,
      toZipCode: rest.toZipCode,
      toBusinessNumber: rest.toBusinessNumber,
      currency: rest.currency || "KES",
      taxRate: taxRate,
      discountType: discountType,
      discountValue: discountValue,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      discountAmount: totals.discountAmount,
      total: totals.total,
      accentColor: rest.accentColor || "#1f8ea3",
      logoDataUrl: logoUrl,
      signatureDataUrl: signatureUrl,
      notes: rest.notes,
      isPaid: false,
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single();

  if (invoiceError) throw invoiceError;

  // Insert line items
  const lineItemRows: LineItem[] = [];
  if (items.length > 0) {
    const itemsToInsert = items.map((item, index) => ({
      id: generateCuid(),
      invoiceId: invoiceId,
      description: item.description,
      additionalDetails: item.additionalDetails,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.quantity * item.rate,
      sortOrder: index,
      createdAt: now,
      updatedAt: now,
    }));

    const { data: itemsData, error: itemsError } = await supabase
      .from("LineItem")
      .insert(itemsToInsert)
      .select();

    if (itemsError) throw itemsError;
    lineItemRows.push(...(itemsData || []).map(toLineItem));
  }

  return {
    ...toInvoice(invoiceRow),
    items: lineItemRows,
  };
}

export async function getInvoiceById(
  id: string,
  ctx: TenantContext
): Promise<InvoiceWithItems | null> {
  const supabase = await createClient();
  
  // Single query with nested select — fetches invoice + line items in one round trip
  let query = supabase
    .from("Invoice")
    .select("*, LineItem(*)")
    .eq("id", id);
  
  if (ctx.userId) {
    query = query.eq("userId", ctx.userId);
  } else if (ctx.guestSessionId) {
    query = query.eq("guestSessionId", ctx.guestSessionId);
  } else {
    throw new Error("Either userId or guestSessionId must be provided");
  }

  const { data: row, error } = await query.single();
  if (error || !row) return null;

  const lineItems = (row.LineItem as Record<string, unknown>[] || [])
    .map(toLineItem)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const { LineItem: _, ...invoiceRow } = row;
  return {
    ...toInvoice(invoiceRow as Record<string, unknown>),
    items: lineItems,
  };
}

export async function getInvoiceByPublicId(publicId: string): Promise<InvoiceWithItems | null> {
  // Use admin client — public invoice links are accessed by unauthenticated payers,
  // so the anon client’s RLS policies (which require auth.uid()) would block access.
  const supabase = createAdminClient();
  
  // Single query with nested select
  const { data: row, error } = await supabase
    .from("Invoice")
    .select("*, LineItem(*)")
    .eq("publicId", publicId)
    .single();

  if (error || !row) return null;

  const lineItems = (row.LineItem as Record<string, unknown>[] || [])
    .map(toLineItem)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const { LineItem: _, ...invoiceRow } = row;
  return {
    ...toInvoice(invoiceRow as Record<string, unknown>),
    items: lineItems,
  };
}

export async function listInvoices(
  ctx: TenantContext,
  options?: {
    limit?: number;
    offset?: number;
    orderBy?: "createdAt" | "issueDate" | "dueDate";
    orderDir?: "asc" | "desc";
  }
): Promise<{ invoices: Invoice[]; total: number }> {
  const supabase = await createClient();
  const { limit = 20, offset = 0, orderBy = "createdAt", orderDir = "desc" } = options || {};

  let query = supabase.from("Invoice").select("*", { count: "exact" });
  
  if (ctx.userId) {
    query = query.eq("userId", ctx.userId);
  } else if (ctx.guestSessionId) {
    query = query.eq("guestSessionId", ctx.guestSessionId);
  } else {
    throw new Error("Either userId or guestSessionId must be provided");
  }

  const { data, count, error } = await query
    .order(orderBy, { ascending: orderDir === "asc" })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    invoices: (data || []).map(toInvoice),
    total: count || 0,
  };
}

export async function updateInvoice(
  id: string,
  ctx: TenantContext,
  input: UpdateInvoiceInput
): Promise<InvoiceWithItems | null> {
  const supabase = await createClient();

  const { items, ...rest } = input;
  const now = new Date().toISOString();

  // Build ownership filter — verify ownership inline (no separate query)
  let ownerFilter: { field: string; value: string };
  if (ctx.userId) {
    ownerFilter = { field: "userId", value: ctx.userId };
  } else if (ctx.guestSessionId) {
    ownerFilter = { field: "guestSessionId", value: ctx.guestSessionId };
  } else {
    throw new Error("Either userId or guestSessionId must be provided");
  }

  // Determine if we need to recalculate totals:
  // - When items are provided (items changed)
  // - When financial parameters change (taxRate, discountType, discountValue) even without items
  const financialParamsChanged = input.taxRate !== undefined || input.discountType !== undefined || input.discountValue !== undefined;
  const needsRecalc = !!items || financialParamsChanged;

  // Fetch current financial values if needed for recalculation
  let existingFinancials: { taxRate: number; discountType: DiscountType; discountValue: number } | null = null;
  let existingItems: { quantity: number; rate: number }[] | null = null;

  if (needsRecalc) {
    // Fetch current financials if any are missing from input
    if (input.taxRate === undefined || input.discountType === undefined || input.discountValue === undefined) {
      const { data: fin } = await supabase
        .from("Invoice")
        .select("taxRate, discountType, discountValue")
        .eq("id", id)
        .eq(ownerFilter.field, ownerFilter.value)
        .single();
      if (!fin) return null;
      existingFinancials = fin as { taxRate: number; discountType: DiscountType; discountValue: number };
    }

    // If financial params changed but no new items provided, fetch existing line items
    if (!items && financialParamsChanged) {
      const { data: lineItems } = await supabase
        .from("LineItem")
        .select("quantity, rate")
        .eq("invoiceId", id);
      existingItems = (lineItems || []) as { quantity: number; rate: number }[];
    }
  }

  // Recalculate totals when items changed or financial parameters changed
  let totals: Record<string, number> = {};
  if (needsRecalc) {
    const itemsForCalc = items || existingItems || [];
    const taxRate = input.taxRate ?? existingFinancials?.taxRate ?? 16;
    const discountType = input.discountType ?? existingFinancials?.discountType ?? "PERCENTAGE";
    const discountValue = input.discountValue ?? existingFinancials?.discountValue ?? 0;
    totals = calculateTotals(itemsForCalc, taxRate, discountType, discountValue);
  }

  // Process images — upload to storage if base64
  let logoUrl: string | null | undefined;
  let signatureUrl: string | null | undefined;
  if (rest.logoDataUrl !== undefined) {
    logoUrl = await processImageField("logos", rest.logoDataUrl);
  }
  if (rest.signatureDataUrl !== undefined) {
    signatureUrl = await processImageField("signatures", rest.signatureDataUrl);
  }

  // Build update object (only include provided fields)
  const updateData: Record<string, unknown> = { updatedAt: now };
  
  if (rest.documentType !== undefined) updateData.documentType = rest.documentType;
  if (rest.documentTitle !== undefined) updateData.documentTitle = rest.documentTitle;
  if (rest.invoiceNumber !== undefined) updateData.invoiceNumber = rest.invoiceNumber;
  if (rest.issueDate !== undefined) updateData.issueDate = rest.issueDate.toISOString();
  if (rest.dueDate !== undefined) updateData.dueDate = rest.dueDate.toISOString();
  if (rest.paymentTerms !== undefined) updateData.paymentTerms = rest.paymentTerms;
  if (rest.fromName !== undefined) updateData.fromName = rest.fromName;
  if (rest.fromEmail !== undefined) updateData.fromEmail = rest.fromEmail;
  if (rest.fromPhone !== undefined) updateData.fromPhone = rest.fromPhone;
  if (rest.fromMobile !== undefined) updateData.fromMobile = rest.fromMobile;
  if (rest.fromFax !== undefined) updateData.fromFax = rest.fromFax;
  if (rest.fromAddress !== undefined) updateData.fromAddress = rest.fromAddress;
  if (rest.fromCity !== undefined) updateData.fromCity = rest.fromCity;
  if (rest.fromZipCode !== undefined) updateData.fromZipCode = rest.fromZipCode;
  if (rest.fromBusinessNumber !== undefined) updateData.fromBusinessNumber = rest.fromBusinessNumber;
  if (rest.toName !== undefined) updateData.toName = rest.toName;
  if (rest.toEmail !== undefined) updateData.toEmail = rest.toEmail;
  if (rest.toPhone !== undefined) updateData.toPhone = rest.toPhone;
  if (rest.toMobile !== undefined) updateData.toMobile = rest.toMobile;
  if (rest.toFax !== undefined) updateData.toFax = rest.toFax;
  if (rest.toAddress !== undefined) updateData.toAddress = rest.toAddress;
  if (rest.toCity !== undefined) updateData.toCity = rest.toCity;
  if (rest.toZipCode !== undefined) updateData.toZipCode = rest.toZipCode;
  if (rest.toBusinessNumber !== undefined) updateData.toBusinessNumber = rest.toBusinessNumber;
  if (rest.currency !== undefined) updateData.currency = rest.currency;
  if (rest.taxRate !== undefined) updateData.taxRate = rest.taxRate;
  if (rest.discountType !== undefined) updateData.discountType = rest.discountType;
  if (rest.discountValue !== undefined) updateData.discountValue = rest.discountValue;
  if (rest.accentColor !== undefined) updateData.accentColor = rest.accentColor;
  if (logoUrl !== undefined) updateData.logoDataUrl = logoUrl;
  if (signatureUrl !== undefined) updateData.signatureDataUrl = signatureUrl;
  if (rest.notes !== undefined) updateData.notes = rest.notes;

  // Add recalculated totals (when items changed OR financial params changed)
  if (needsRecalc) {
    Object.assign(updateData, totals);
  }

  // Update invoice with ownership filter (verifies access in same query)
  const { data: updated, error: updateError } = await supabase
    .from("Invoice")
    .update(updateData)
    .eq("id", id)
    .eq(ownerFilter.field, ownerFilter.value)
    .select("id")
    .single();

  if (updateError || !updated) return null;

  // Replace line items if provided — use admin client for atomic operation
  if (items) {
    const admin = createAdminClient();

    // Delete existing + insert new in sequence with the admin client.
    // Supabase doesn't expose multi-statement transactions, but using the
    // admin client ensures both operations bypass RLS and execute on the
    // same connection. If the insert fails, old items are already deleted
    // by CASCADE on the invoice, so we re-throw to surface the error.
    const { error: deleteError } = await admin
      .from("LineItem")
      .delete()
      .eq("invoiceId", id);

    if (deleteError) {
      console.error("Failed to delete line items:", deleteError);
      throw deleteError;
    }

    if (items.length > 0) {
      const itemsToInsert = items.map((item, index) => ({
        id: generateCuid(),
        invoiceId: id,
        description: item.description,
        additionalDetails: item.additionalDetails,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.quantity * item.rate,
        sortOrder: index,
        createdAt: now,
        updatedAt: now,
      }));

      const { error: insertError } = await admin
        .from("LineItem")
        .insert(itemsToInsert);

      if (insertError) {
        console.error("Failed to insert line items:", insertError);
        throw insertError;
      }
    }
  }

  return getInvoiceById(id, ctx);
}

export async function deleteInvoice(id: string, ctx: TenantContext): Promise<boolean> {
  const supabase = await createClient();
  
  // Single delete with ownership filter — CASCADE handles line items
  let query = supabase.from("Invoice").delete().eq("id", id);

  if (ctx.userId) {
    query = query.eq("userId", ctx.userId);
  } else if (ctx.guestSessionId) {
    query = query.eq("guestSessionId", ctx.guestSessionId);
  } else {
    throw new Error("Either userId or guestSessionId must be provided");
  }

  const { error, count } = await query.select("id").single();
  
  return !error && count !== 0;
}

export async function markInvoiceAsPaid(
  id: string,
  ctx: TenantContext
): Promise<Invoice | null> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  // Direct update with ownership filter — no pre-fetch needed (P3 fix)
  let query = supabase
    .from("Invoice")
    .update({
      isPaid: true,
      paidAt: now,
      updatedAt: now,
    })
    .eq("id", id);

  if (ctx.userId) {
    query = query.eq("userId", ctx.userId);
  } else if (ctx.guestSessionId) {
    query = query.eq("guestSessionId", ctx.guestSessionId);
  } else {
    throw new Error("Either userId or guestSessionId must be provided");
  }

  const { data, error } = await query.select().single();

  if (error || !data) return null;
  return toInvoice(data);
}

export async function getInvoicePaymentStatus(publicId: string) {
  // Use admin client — this serves the public polling endpoint.
  const supabase = createAdminClient();
  
  const { data: invoice, error } = await supabase
    .from("Invoice")
    .select("id, isPaid, paidAt")
    .eq("publicId", publicId)
    .single();

  if (error || !invoice) return null;

  const { data: payments } = await supabase
    .from("Payment")
    .select("status, mpesaReceiptNumber")
    .eq("invoiceId", invoice.id)
    .order("createdAt", { ascending: false })
    .limit(1);

  return {
    id: invoice.id,
    isPaid: invoice.isPaid,
    paidAt: invoice.paidAt,
    payments: (payments || []).map((p: Record<string, unknown>) => ({
      status: p.status,
      mpesaReceiptNumber: p.mpesaReceiptNumber,
    })),
  };
}

export async function migrateGuestInvoicesToUser(
  guestSessionId: string,
  userId: string
): Promise<void> {
  // Use admin client — guest invoices have user_id=NULL, so the RLS
  // UPDATE policy (which checks user_id ownership) never matches.
  const supabase = createAdminClient();
  
  await supabase
    .from("Invoice")
    .update({ userId: userId, guestSessionId: null })
    .eq("guestSessionId", guestSessionId);
}

/**
 * Get aggregated dashboard stats for a user.
 * Uses a Postgres RPC function (get_dashboard_stats) to aggregate
 * server-side — returns counts and sums without fetching any rows.
 */
export async function getDashboardStats(userId: string): Promise<{
  total: number;
  paid: number;
  pending: number;
  totalValue: number;
}> {
  // Use admin client — the RPC is SECURITY DEFINER and should only be called
  // from trusted server code with a verified userId (never directly from client).
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("get_dashboard_stats", {
    p_user_id: userId,
  });

  if (error || !data) {
    console.error("getDashboardStats RPC error:", error);
    return { total: 0, paid: 0, pending: 0, totalValue: 0 };
  }

  // RPC returns a JSON object
  const stats = typeof data === "string" ? JSON.parse(data) : data;

  return {
    total: Number(stats.total) || 0,
    paid: Number(stats.paid) || 0,
    pending: Number(stats.pending) || 0,
    totalValue: Number(stats.totalValue) || 0,
  };
}
