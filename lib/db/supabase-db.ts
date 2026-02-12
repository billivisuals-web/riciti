/**
 * Supabase Database Layer
 * Replaces Prisma with direct Supabase queries
 * Uses PascalCase table names and camelCase columns to match existing Prisma schema
 */

import { createClient } from "@/lib/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";
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
  // Simple cuid-like ID generator
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 12);
  return `c${timestamp}${randomPart}`;
}

function calculateTotals(
  items: { quantity: number; rate: number }[],
  taxRate: number,
  discountType: DiscountType,
  discountValue: number
) {
  const safeTaxRate = Number(taxRate) || 0;
  const safeDiscountValue = Number(discountValue) || 0;
  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.rate) || 0), 0);
  const taxAmount = (subtotal * safeTaxRate) / 100;
  const discountAmount =
    discountType === "PERCENTAGE"
      ? (subtotal * safeDiscountValue) / 100
      : safeDiscountValue;
  const total = subtotal + taxAmount - discountAmount;

  return { subtotal, taxAmount, discountAmount, total };
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
  const supabase = await createClient();
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
  const supabase = await createClient();
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
      logoDataUrl: rest.logoDataUrl,
      signatureDataUrl: rest.signatureDataUrl,
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
  
  let query = supabase.from("Invoice").select("*").eq("id", id);
  
  if (ctx.userId) {
    query = query.eq("userId", ctx.userId);
  } else if (ctx.guestSessionId) {
    query = query.eq("guestSessionId", ctx.guestSessionId);
  } else {
    throw new Error("Either userId or guestSessionId must be provided");
  }

  const { data: invoiceRow, error } = await query.single();
  if (error || !invoiceRow) return null;

  const { data: itemsData } = await supabase
    .from("LineItem")
    .select("*")
    .eq("invoiceId", id)
    .order("sortOrder", { ascending: true });

  return {
    ...toInvoice(invoiceRow),
    items: (itemsData || []).map(toLineItem),
  };
}

export async function getInvoiceByPublicId(publicId: string): Promise<InvoiceWithItems | null> {
  const supabase = await createClient();
  
  const { data: invoiceRow, error } = await supabase
    .from("Invoice")
    .select("*")
    .eq("publicId", publicId)
    .single();

  if (error || !invoiceRow) return null;

  const { data: itemsData } = await supabase
    .from("LineItem")
    .select("*")
    .eq("invoiceId", invoiceRow.id)
    .order("sortOrder", { ascending: true });

  return {
    ...toInvoice(invoiceRow),
    items: (itemsData || []).map(toLineItem),
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

  // First verify ownership
  const existing = await getInvoiceById(id, ctx);
  if (!existing) return null;

  const { items, ...rest } = input;
  const now = new Date().toISOString();

  // Recalculate totals if items changed
  let totals = {};
  if (items) {
    const taxRate = input.taxRate ?? existing.taxRate;
    const discountType = input.discountType ?? existing.discountType;
    const discountValue = input.discountValue ?? existing.discountValue;
    totals = calculateTotals(items, taxRate, discountType, discountValue);
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
  if (rest.logoDataUrl !== undefined) updateData.logoDataUrl = rest.logoDataUrl;
  if (rest.signatureDataUrl !== undefined) updateData.signatureDataUrl = rest.signatureDataUrl;
  if (rest.notes !== undefined) updateData.notes = rest.notes;

  // Add recalculated totals
  if (items) {
    Object.assign(updateData, {
      subtotal: (totals as Record<string, number>).subtotal,
      taxAmount: (totals as Record<string, number>).taxAmount,
      discountAmount: (totals as Record<string, number>).discountAmount,
      total: (totals as Record<string, number>).total,
    });
  }

  // Update invoice
  const { error: updateError } = await supabase
    .from("Invoice")
    .update(updateData)
    .eq("id", id);

  if (updateError) throw updateError;

  // Replace line items if provided
  if (items) {
    await supabase.from("LineItem").delete().eq("invoiceId", id);
    
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

      await supabase.from("LineItem").insert(itemsToInsert);
    }
  }

  return getInvoiceById(id, ctx);
}

export async function deleteInvoice(id: string, ctx: TenantContext): Promise<boolean> {
  const supabase = await createClient();
  
  const existing = await getInvoiceById(id, ctx);
  if (!existing) return false;

  // Delete line items first (cascade should handle this, but being explicit)
  await supabase.from("LineItem").delete().eq("invoiceId", id);
  
  const { error } = await supabase.from("Invoice").delete().eq("id", id);
  
  return !error;
}

export async function markInvoiceAsPaid(
  id: string,
  ctx: TenantContext
): Promise<Invoice | null> {
  const supabase = await createClient();
  
  const existing = await getInvoiceById(id, ctx);
  if (!existing) return null;

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("Invoice")
    .update({
      isPaid: true,
      paidAt: now,
      updatedAt: now,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return toInvoice(data);
}

export async function getInvoicePaymentStatus(publicId: string) {
  const supabase = await createClient();
  
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
  const supabase = await createClient();
  
  await supabase
    .from("Invoice")
    .update({ userId: userId, guestSessionId: null })
    .eq("guestSessionId", guestSessionId);
}
