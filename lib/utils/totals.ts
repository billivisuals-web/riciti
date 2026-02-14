/**
 * Shared invoice totals calculation.
 * Single source of truth used by:
 *   - Server: supabase-db.ts (createInvoice, updateInvoice)
 *   - Client: InvoicePreview.tsx, LineItemsEditor.tsx
 *
 * Handles both uppercase ("PERCENTAGE") and lowercase ("percentage")
 * discount types for compatibility between server and client stores.
 */

export type TotalsInput = {
  items: { quantity: number; rate: number }[];
  taxRate: number;
  discountType: string; // "PERCENTAGE" | "FIXED" | "percentage" | "fixed"
  discountValue: number;
};

export type Totals = {
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
};

export function calculateInvoiceTotals(input: TotalsInput): Totals {
  const safeTaxRate = Number(input.taxRate) || 0;
  const safeDiscountValue = Number(input.discountValue) || 0;

  const subtotal = input.items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.rate) || 0),
    0
  );

  const taxAmount = (subtotal * safeTaxRate) / 100;

  const isPercentage = input.discountType.toUpperCase() === "PERCENTAGE";
  const discountAmount = isPercentage
    ? (subtotal * safeDiscountValue) / 100
    : safeDiscountValue;

  const total = subtotal + taxAmount - discountAmount;

  return { subtotal, taxAmount, discountAmount, total };
}
