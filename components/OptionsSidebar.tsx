"use client";

import { useInvoiceStore, CURRENCIES, ACCENT_COLORS, Currency } from "@/lib/store/invoiceStore";

type OptionsSidebarProps = {
  onGetLink: () => void;
  onPrint: () => void;
};

export default function OptionsSidebar({ onGetLink, onPrint }: OptionsSidebarProps) {
  const invoice = useInvoiceStore((state) => state.invoice);
  const setField = useInvoiceStore((state) => state.setField);
  const setCurrency = useInvoiceStore((state) => state.setCurrency);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Preview via Email */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Preview via Email
        </h3>
        <input
          type="email"
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 sm:py-2 text-sm"
          placeholder="email@example.com"
        />
        <button
          type="button"
          className="w-full rounded-xl bg-ink px-4 py-2.5 sm:py-2 text-sm font-semibold text-white shadow transition hover:-translate-y-0.5 active:translate-y-0"
        >
          Send
        </button>
      </div>

      {/* Templates (Color Picker) */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Templates
        </h3>
        <div className="flex flex-wrap gap-2">
          {ACCENT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`h-8 w-8 sm:h-7 sm:w-7 rounded-lg shadow transition hover:scale-110 active:scale-100 ${
                invoice.accentColor === color
                  ? "ring-2 ring-lagoon ring-offset-2"
                  : ""
              }`}
              style={{ backgroundColor: color }}
              onClick={() => setField("accentColor", color)}
              title={color}
            />
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 py-1">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            checked={invoice.showCustomTable}
            onChange={(event) => setField("showCustomTable", event.target.checked)}
          />
          Custom Table
        </label>
        <button
          type="button"
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 sm:py-2 text-sm font-medium text-slate-600 transition hover:border-lagoon hover:text-lagoon active:bg-lagoon/5"
        >
          Customize
        </button>
      </div>

      {/* Document Type */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Type
        </h3>
        <select
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:py-2 text-sm"
          value={invoice.documentType}
          onChange={(event) => setField("documentType", event.target.value)}
        >
          <option value="invoice">Invoice</option>
          <option value="receipt">Receipt</option>
          <option value="estimate">Estimate</option>
          <option value="quote">Quote</option>
        </select>
      </div>

      {/* Discount */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Discount
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:py-2 text-sm"
            value={invoice.discountType}
            onChange={(event) => setField("discountType", event.target.value)}
          >
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed Amount</option>
          </select>
          <input
            type="number"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 sm:py-2 text-sm"
            placeholder={invoice.discountType === "percentage" ? "%" : "0"}
            min={0}
            step="0.01"
            value={invoice.discountValue || ""}
            onChange={(event) => setField("discountValue", event.target.value === "" ? 0 : Math.max(0, Number(event.target.value) || 0))}
          />
        </div>
      </div>

      {/* Tax Rate */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Tax Rate
        </h3>
        <div className="relative">
          <input
            type="number"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 sm:py-2 pr-8 text-sm"
            placeholder="16"
            min={0}
            max={100}
            step="0.5"
            value={invoice.taxRate || ""}
            onChange={(event) => setField("taxRate", event.target.value === "" ? 0 : Math.min(100, Math.max(0, Number(event.target.value) || 0)))}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
            %
          </span>
        </div>
      </div>

      {/* Currency */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Currency
        </h3>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
          <span className="text-lg">{invoice.currency.flag}</span>
          <select
            className="flex-1 bg-transparent text-sm outline-none py-0.5"
            value={invoice.currency.code}
            onChange={(event) => {
              const curr = CURRENCIES.find((c) => c.code === event.target.value);
              if (curr) setCurrency(curr);
            }}
          >
            {CURRENCIES.map((curr) => (
              <option key={curr.code} value={curr.code}>
                {curr.code}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Options */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Options
        </h3>
        <button
          type="button"
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 sm:py-2 text-sm font-medium text-slate-600 transition hover:border-lagoon hover:text-lagoon active:bg-lagoon/5"
          onClick={onGetLink}
        >
          Get Link
        </button>
        <button
          type="button"
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 sm:py-2 text-sm font-medium text-slate-600 transition hover:border-lagoon hover:text-lagoon active:bg-lagoon/5"
          onClick={onPrint}
        >
          Print Invoice
        </button>
      </div>
    </div>
  );
}
