"use client";

import { useState } from "react";
import { useInvoiceStore } from "@/lib/store/invoiceStore";
import { formatCurrency } from "@/lib/utils/format";

export default function LineItemsEditor() {
  const invoice = useInvoiceStore((state) => state.invoice);
  const items = invoice.items;
  const currency = invoice.currency;
  const addItem = useInvoiceStore((state) => state.addItem);
  const updateItem = useInvoiceStore((state) => state.updateItem);
  const removeItem = useInvoiceStore((state) => state.removeItem);

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const subtotal = items.reduce((sum, item) => sum + (item.quantity || 0) * (item.rate || 0), 0);
  const taxRate = Number(invoice.taxRate) || 0;
  const discountValue = Number(invoice.discountValue) || 0;
  const tax = (subtotal * taxRate) / 100;
  const discount =
    invoice.discountType === "percentage"
      ? (subtotal * discountValue) / 100
      : discountValue;
  const total = subtotal + tax - discount;

  return (
    <div className="space-y-4">
      {/* Header row - Desktop only */}
      <div className="hidden md:grid grid-cols-[auto_2fr_1fr_1fr_1fr] gap-3 px-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
        <span></span>
        <span>Description</span>
        <span className="text-right">Rate</span>
        <span className="text-center">Qty</span>
        <span className="text-right">Amount</span>
      </div>

      {/* Line items */}
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4"
          >
            {/* Desktop Layout */}
            <div className="hidden md:grid grid-cols-[auto_2fr_1fr_1fr_1fr] items-center gap-3">
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-xs font-semibold text-slate-500 hover:bg-ember hover:text-white"
                onClick={() => removeItem(item.id)}
                title="Remove"
              >
                ×
              </button>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Enter Description"
                value={item.description}
                onChange={(event) => updateItem(item.id, "description", event.target.value)}
              />
              <input
                type="number"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right text-sm"
                placeholder="0.00"
                min={0}
                value={item.rate || ""}
                onChange={(event) => updateItem(item.id, "rate", event.target.value)}
              />
              <input
                type="number"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-center text-sm"
                placeholder="1"
                min={1}
                value={item.quantity}
                onChange={(event) => updateItem(item.id, "quantity", event.target.value)}
              />
              <div className="text-right text-sm font-semibold text-ink">
                {formatCurrency((item.quantity || 0) * (item.rate || 0), currency)}
              </div>
            </div>

            {/* Mobile Layout */}
            <div className="md:hidden space-y-3">
              {/* Header with item number and delete */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Item {index + 1}</span>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-sm text-slate-500 hover:bg-ember hover:text-white active:scale-95"
                  onClick={() => removeItem(item.id)}
                  title="Remove"
                >
                  ×
                </button>
              </div>
              
              {/* Description */}
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                placeholder="Description"
                value={item.description}
                onChange={(event) => updateItem(item.id, "description", event.target.value)}
              />
              
              {/* Rate and Quantity row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Rate</label>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    placeholder="0.00"
                    min={0}
                    value={item.rate || ""}
                    onChange={(event) => updateItem(item.id, "rate", event.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Qty</label>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-center"
                    placeholder="1"
                    min={1}
                    value={item.quantity}
                    onChange={(event) => updateItem(item.id, "quantity", event.target.value)}
                  />
                </div>
              </div>
              
              {/* Amount */}
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-400">Amount</span>
                <span className="text-sm font-semibold text-ink">
                  {formatCurrency((item.quantity || 0) * (item.rate || 0), currency)}
                </span>
              </div>
            </div>

            {/* Additional Details - Both layouts */}
            {expandedItems.has(item.id) && (
              <div className="mt-3 md:pl-9">
                <textarea
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 sm:py-2 text-sm resize-none"
                  rows={2}
                  placeholder="Additional details"
                  value={item.additionalDetails}
                  onChange={(event) => updateItem(item.id, "additionalDetails", event.target.value)}
                />
              </div>
            )}
            <button
              type="button"
              className="mt-2 md:pl-9 text-xs font-medium text-lagoon hover:underline py-1"
              onClick={() => toggleExpand(item.id)}
            >
              {expandedItems.has(item.id) ? "Hide details" : "+ Additional details"}
            </button>
          </div>
        ))}
      </div>

      {/* Add item button */}
      <button
        type="button"
        className="flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-lagoon text-lg font-bold text-white shadow transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow"
        onClick={addItem}
        title="Add line item"
      >
        +
      </button>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-full sm:w-64 space-y-2 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal, currency)}</span>
          </div>
          {taxRate > 0 && (
            <div className="flex justify-between text-slate-500">
              <span>Tax ({invoice.taxRate}%)</span>
              <span>{formatCurrency(tax, currency)}</span>
            </div>
          )}
          {invoice.discountValue > 0 && (
            <div className="flex justify-between text-slate-500">
              <span>
                Discount{" "}
                {invoice.discountType === "percentage"
                  ? `(${invoice.discountValue}%)`
                  : ""}
              </span>
              <span>-{formatCurrency(discount, currency)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-ink">
            <span>Balance Due</span>
            <span>{formatCurrency(total, currency)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

