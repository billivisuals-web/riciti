/**
 * Database types for Riciti Invoice Generator
 * Using snake_case naming for Supabase compatibility
 */

export type DocumentType = "INVOICE" | "RECEIPT" | "ESTIMATE" | "QUOTE";

export type PaymentTerms =
  | "DUE_ON_RECEIPT"
  | "NET_7"
  | "NET_15"
  | "NET_30"
  | "NET_60"
  | "CUSTOM";

export type DiscountType = "PERCENTAGE" | "FIXED";

export type PaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type User = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  externalId: string | null;
  provider: string | null;
  businessName: string | null;
  businessEmail: string | null;
  businessPhone: string | null;
  businessAddress: string | null;
  businessCity: string | null;
  businessZipCode: string | null;
  businessNumber: string | null;
  defaultCurrency: string;
  defaultTaxRate: number;
  logoUrl: string | null;
  signatureUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Invoice = {
  id: string;
  userId: string | null;
  guestSessionId: string | null;
  publicId: string;
  documentType: DocumentType;
  documentTitle: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  paymentTerms: PaymentTerms;
  fromName: string;
  fromEmail: string | null;
  fromPhone: string | null;
  fromMobile: string | null;
  fromFax: string | null;
  fromAddress: string | null;
  fromCity: string | null;
  fromZipCode: string | null;
  fromBusinessNumber: string | null;
  toName: string;
  toEmail: string | null;
  toPhone: string | null;
  toMobile: string | null;
  toFax: string | null;
  toAddress: string | null;
  toCity: string | null;
  toZipCode: string | null;
  toBusinessNumber: string | null;
  currency: string;
  taxRate: number;
  discountType: DiscountType;
  discountValue: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  accentColor: string;
  logoDataUrl: string | null;
  signatureDataUrl: string | null;
  notes: string | null;
  isPaid: boolean;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LineItem = {
  id: string;
  invoiceId: string;
  description: string;
  additionalDetails: string | null;
  quantity: number;
  rate: number;
  amount: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type InvoicePhoto = {
  id: string;
  invoiceId: string;
  dataUrl: string;
  filename: string | null;
  sortOrder: number;
  createdAt: Date;
};

export type Payment = {
  id: string;
  invoiceId: string;
  userId: string | null;
  phoneNumber: string;
  amount: number;
  currency: string;
  merchantRequestId: string | null;
  checkoutRequestId: string | null;
  mpesaReceiptNumber: string | null;
  transactionDate: Date | null;
  status: PaymentStatus;
  resultCode: string | null;
  resultDesc: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

export type InvoiceWithItems = Invoice & {
  items: LineItem[];
  photos?: InvoicePhoto[];
};
