/**
 * Zod Validation Schemas for Riciti API
 *
 * Validates all inputs before they reach the database layer.
 */

import { z } from "zod";

// ============================================================================
// ENUMS
// ============================================================================

export const DocumentTypeSchema = z.enum([
  "INVOICE",
  "RECEIPT",
  "ESTIMATE",
  "QUOTE",
]);

export const PaymentTermsSchema = z.enum([
  "DUE_ON_RECEIPT",
  "NET_7",
  "NET_15",
  "NET_30",
  "NET_60",
  "CUSTOM",
]);

export const DiscountTypeSchema = z.enum(["PERCENTAGE", "FIXED"]);

// ============================================================================
// LINE ITEM
// ============================================================================

const LineItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(500),
  additionalDetails: z.string().max(1000).optional(),
  quantity: z.number().min(0).max(1_000_000),
  rate: z.number().min(0).max(1_000_000_000),
});

// ============================================================================
// IMAGE FIELD (accepts data URL up to ~500KB or an https URL)
// ============================================================================

const ImageFieldSchema = z
  .string()
  .max(700_000) // ~500KB base64 + overhead
  .refine(
    (val) =>
      val.startsWith("data:image/") ||
      val.startsWith("https://"),
    { message: "Must be a data URL or an HTTPS URL" }
  )
  .nullable()
  .optional();

// ============================================================================
// CREATE INVOICE
// ============================================================================

export const CreateInvoiceSchema = z.object({
  documentTitle: z.string().max(200).optional(),
  documentType: DocumentTypeSchema.optional(),
  invoiceNumber: z.string().max(50).optional(),
  issueDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Invalid date format for issueDate" }
  ).optional(),
  dueDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Invalid date format for dueDate" }
  ).optional(),
  paymentTerms: PaymentTermsSchema.optional(),

  fromName: z.string().min(1, "Sender name is required").max(200),
  fromEmail: z.string().email().max(254).optional().or(z.literal("")),
  fromPhone: z.string().max(30).optional().or(z.literal("")),
  fromMobile: z.string().max(30).optional().or(z.literal("")),
  fromFax: z.string().max(30).optional().or(z.literal("")),
  fromAddress: z.string().max(500).optional().or(z.literal("")),
  fromCity: z.string().max(200).optional().or(z.literal("")),
  fromZipCode: z.string().max(20).optional().or(z.literal("")),
  fromBusinessNumber: z.string().max(50).optional().or(z.literal("")),

  toName: z.string().min(1, "Recipient name is required").max(200),
  toEmail: z.string().email().max(254).optional().or(z.literal("")),
  toPhone: z.string().max(30).optional().or(z.literal("")),
  toMobile: z.string().max(30).optional().or(z.literal("")),
  toFax: z.string().max(30).optional().or(z.literal("")),
  toAddress: z.string().max(500).optional().or(z.literal("")),
  toCity: z.string().max(200).optional().or(z.literal("")),
  toZipCode: z.string().max(20).optional().or(z.literal("")),
  toBusinessNumber: z.string().max(50).optional().or(z.literal("")),

  currency: z.string().length(3).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  discountType: DiscountTypeSchema.optional(),
  discountValue: z.number().min(0).max(1_000_000_000).optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),

  logoDataUrl: ImageFieldSchema,
  signatureDataUrl: ImageFieldSchema,
  notes: z.string().max(5000).optional().or(z.literal("")),

  items: z.array(LineItemSchema).max(100).optional(),
});

// ============================================================================
// UPDATE INVOICE (everything optional)
// ============================================================================

export const UpdateInvoiceSchema = CreateInvoiceSchema.partial();

// ============================================================================
// PAYMENT INITIATE
// ============================================================================

export const PaymentInitiateSchema = z.object({
  publicId: z.string().min(1, "publicId is required"),
  phoneNumber: z.string().min(9).max(15),
});

// ============================================================================
// PAYMENT QUERY
// ============================================================================

export const PaymentQuerySchema = z.object({
  checkoutRequestId: z.string().min(1, "checkoutRequestId is required"),
});
