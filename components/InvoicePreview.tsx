"use client";

import { useMemo } from "react";
import { useInvoiceStore, PAYMENT_TERMS_LABELS } from "@/lib/store/invoiceStore";
import { formatCurrency } from "@/lib/utils/format";
import { calculateInvoiceTotals } from "@/lib/utils/totals";

export default function InvoicePreview() {
  const invoice = useInvoiceStore((state) => state.invoice);

  const totals = useMemo(() => {
    const result = calculateInvoiceTotals({
      items: invoice.items,
      taxRate: Number(invoice.taxRate) || 0,
      discountType: invoice.discountType,
      discountValue: Number(invoice.discountValue) || 0,
    });
    return {
      subtotal: result.subtotal,
      tax: result.taxAmount,
      discount: result.discountAmount,
      total: result.total,
    };
  }, [invoice.items, invoice.taxRate, invoice.discountType, invoice.discountValue]);

  const fmt = (amount: number) => formatCurrency(amount, invoice.currency);

  return (
    <div className="print-area relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
      {!invoice.isPaid ? (
        <div className="watermark">
          <span>Preview only</span>
        </div>
      ) : null}

      {/* Header: Title + Logo */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="order-2 sm:order-1">
          <h2 className="font-display text-xl sm:text-2xl text-ink">{invoice.documentTitle}</h2>
          <p className="mt-1 text-sm text-slate-500">{invoice.invoiceNumber}</p>
        </div>
        <div className="order-1 sm:order-2 flex flex-col items-center sm:items-end gap-2 self-center sm:self-auto">
          {invoice.logoDataUrl ? (
            <img
              src={invoice.logoDataUrl}
              alt="Logo"
              className="h-12 w-16 sm:h-14 sm:w-20 rounded-xl object-contain"
            />
          ) : (
            <div className="flex h-12 w-16 sm:h-14 sm:w-20 items-center justify-center rounded-xl bg-slate-100 text-xs font-semibold text-slate-400 print-hide">
              Logo
            </div>
          )}
        </div>
      </div>

      {/* From / Bill To */}
      <div className="mt-5 sm:mt-6 grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            From
          </p>
          <p className="mt-2 text-base font-semibold text-ink">{invoice.from.name}</p>
          <p>{invoice.from.address}</p>
          <p>
            {invoice.from.city}
            {invoice.from.zipCode ? `, ${invoice.from.zipCode}` : ""}
          </p>
          <p>{invoice.from.email}</p>
          <p>{invoice.from.phone}</p>
          {invoice.from.businessNumber && (
            <p className="text-xs text-slate-400">BN: {invoice.from.businessNumber}</p>
          )}
        </div>
        <div className="pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Bill To
          </p>
          <p className="mt-2 text-base font-semibold text-ink">{invoice.to.name}</p>
          <p>{invoice.to.address}</p>
          <p>
            {invoice.to.city}
            {invoice.to.zipCode ? `, ${invoice.to.zipCode}` : ""}
          </p>
          <p>{invoice.to.email}</p>
          <p>{invoice.to.phone}</p>
          {invoice.to.mobile && <p>Mobile: {invoice.to.mobile}</p>}
        </div>
      </div>

      {/* Dates */}
      <div className="mt-5 sm:mt-6 grid gap-2 sm:gap-3 text-sm text-slate-600 grid-cols-3">
        <div className="rounded-lg sm:rounded-xl border border-slate-200 p-2 sm:p-3">
          <p className="text-[10px] sm:text-xs uppercase tracking-widest text-slate-400">Date</p>
          <p className="mt-0.5 sm:mt-1 font-semibold text-ink text-xs sm:text-sm">{invoice.issueDate}</p>
        </div>
        <div className="rounded-lg sm:rounded-xl border border-slate-200 p-2 sm:p-3">
          <p className="text-[10px] sm:text-xs uppercase tracking-widest text-slate-400">Due</p>
          <p className="mt-0.5 sm:mt-1 font-semibold text-ink text-xs sm:text-sm">{invoice.dueDate}</p>
        </div>
        <div className="rounded-lg sm:rounded-xl border border-slate-200 p-2 sm:p-3">
          <p className="text-[10px] sm:text-xs uppercase tracking-widest text-slate-400">Terms</p>
          <p className="mt-0.5 sm:mt-1 font-semibold text-ink text-xs sm:text-sm truncate">
            {PAYMENT_TERMS_LABELS[invoice.paymentTerms]}
          </p>
        </div>
      </div>

      {/* Line Items Table - Desktop & Print */}
      <div className="mt-5 sm:mt-6 hidden sm:block print-show overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-left text-xs uppercase tracking-widest text-white"
              style={{ backgroundColor: invoice.accentColor }}
            >
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Rate</th>
              <th className="px-4 py-3 text-center">Qty</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr
                key={item.id}
                className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">
                    {item.description || "Line item"}
                  </p>
                  {item.additionalDetails && (
                    <p className="mt-1 text-xs text-slate-400">
                      {item.additionalDetails}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {fmt(item.rate)}
                </td>
                <td className="px-4 py-3 text-center text-slate-600">
                  {item.quantity}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-ink">
                  {fmt(item.quantity * item.rate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Line Items Cards - Mobile (hidden in print) */}
      <div className="mt-5 sm:hidden print-hide space-y-2">
        <div 
          className="rounded-lg px-3 py-2 text-xs uppercase tracking-widest text-white font-semibold"
          style={{ backgroundColor: invoice.accentColor }}
        >
          Items
        </div>
        {invoice.items.map((item, index) => (
          <div
            key={item.id}
            className={`rounded-lg p-3 ${index % 2 === 0 ? "bg-white border border-slate-100" : "bg-slate-50"}`}
          >
            <p className="font-medium text-ink text-sm">
              {item.description || "Line item"}
            </p>
            {item.additionalDetails && (
              <p className="mt-1 text-xs text-slate-400">
                {item.additionalDetails}
              </p>
            )}
            <div className="mt-2 flex justify-between items-center text-xs">
              <span className="text-slate-500">
                {fmt(item.rate)} × {item.quantity}
              </span>
              <span className="font-semibold text-ink">
                {fmt(item.quantity * item.rate)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="mt-4 flex justify-end">
        <div className="w-full sm:w-64 space-y-2 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span>{fmt(totals.subtotal)}</span>
          </div>
          {(Number(invoice.taxRate) || 0) > 0 && (
            <div className="flex justify-between text-slate-500">
              <span>Tax ({invoice.taxRate}%)</span>
              <span>{fmt(totals.tax)}</span>
            </div>
          )}
          {invoice.discountValue > 0 && (
            <div className="flex justify-between text-slate-500">
              <span>
                Discount
                {invoice.discountType === "percentage"
                  ? ` (${invoice.discountValue}%)`
                  : ""}
              </span>
              <span>-{fmt(totals.discount)}</span>
            </div>
          )}
          <div
            className="flex justify-between rounded-lg px-3 py-2 text-sm sm:text-base font-bold text-white"
            style={{ backgroundColor: invoice.accentColor }}
          >
            <span>Balance Due</span>
            <span>{fmt(totals.total)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p className="text-xs uppercase tracking-widest text-slate-400">Notes</p>
          <p className="mt-2 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      {/* Signature */}
      {invoice.signatureDataUrl && (
        <div className="mt-6">
          <p className="text-xs uppercase tracking-widest text-slate-400">Signature</p>
          <img
            src={invoice.signatureDataUrl}
            alt="Signature"
            className="mt-2 h-16 object-contain"
          />
        </div>
      )}

      {/* Photos */}
      {invoice.photoDataUrls.length > 0 && (
        <div className="mt-6">
          <p className="text-xs uppercase tracking-widest text-slate-400">Attachments</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {invoice.photoDataUrls.map((photo, index) => (
              <img
                key={index}
                src={photo}
                alt={`Attachment ${index + 1}`}
                className="h-16 w-16 rounded-lg object-cover"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
