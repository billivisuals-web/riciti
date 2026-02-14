/**
 * Invoice Data Access Layer
 * 
 * Re-exports from Supabase database layer
 */

export {
  createInvoice,
  getInvoiceById,
  getInvoiceByPublicId,
  listInvoices,
  updateInvoice,
  deleteInvoice,
  markInvoiceAsPaid,
  getInvoicePaymentStatus,
  getDashboardStats,
  type CreateInvoiceInput,
  type UpdateInvoiceInput,
  type TenantContext,
  type InvoiceWithItems,
} from "./supabase-db";

