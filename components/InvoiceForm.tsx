"use client";

import { ChangeEvent, useState } from "react";
import { useInvoiceStore, PAYMENT_TERMS_LABELS, PaymentTerms } from "@/lib/store/invoiceStore";
import LineItemsEditor from "@/components/LineItemsEditor";

export default function InvoiceForm() {
  const invoice = useInvoiceStore((state) => state.invoice);
  const setField = useInvoiceStore((state) => state.setField);
  const setLogo = useInvoiceStore((state) => state.setLogo);
  const setSignature = useInvoiceStore((state) => state.setSignature);
  const addPhoto = useInvoiceStore((state) => state.addPhoto);
  const removePhoto = useInvoiceStore((state) => state.removePhoto);

  const [showFromExtra, setShowFromExtra] = useState(false);
  const [showToExtra, setShowToExtra] = useState(false);

  const handleLogoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Logo file is too large. Please use an image under 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogo(typeof reader.result === "string" ? reader.result : null);
    };
    reader.onerror = () => {
      alert("Failed to read the image file. Please try again.");
    };
    reader.readAsDataURL(file);
    // Reset the input so the same file can be selected again
    event.target.value = "";
  };

  const handleSignatureUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Signature file is too large. Please use an image under 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSignature(typeof reader.result === "string" ? reader.result : null);
    };
    reader.onerror = () => {
      alert("Failed to read the image file. Please try again.");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handlePhotoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Photo is too large. Please use an image under 10MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        addPhoto(reader.result);
      }
    };
    reader.onerror = () => {
      alert("Failed to read the image file. Please try again.");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Document Title + Logo */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 order-2 sm:order-1">
          <input
            className="w-full border-b-2 border-transparent bg-transparent text-xl sm:text-2xl font-semibold text-ink transition focus:border-lagoon focus:outline-none"
            value={invoice.documentTitle}
            onChange={(event) => setField("documentTitle", event.target.value)}
            placeholder="Invoice"
          />
        </div>
        <div className="order-1 sm:order-2 flex flex-col items-center sm:items-end gap-1 self-center sm:self-auto">
          <label className="group relative flex h-16 sm:h-20 w-24 sm:w-28 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 transition hover:border-lagoon hover:bg-lagoon/5">
            {invoice.logoDataUrl ? (
              <img
                src={invoice.logoDataUrl}
                alt="Logo"
                className="h-full w-full rounded-xl object-contain p-2"
              />
            ) : (
              <div className="text-center text-xs text-slate-400">
                <svg className="mx-auto h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="mt-1 block">+ Logo</span>
              </div>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </label>
          {invoice.logoDataUrl && (
            <button
              type="button"
              className="text-xs text-ember hover:underline"
              onClick={() => setLogo(null)}
            >
              Remove logo
            </button>
          )}
        </div>
      </div>

      {/* From / Bill To */}
      <div className="grid gap-5 sm:gap-6 md:grid-cols-2">
        {/* From */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">From</h3>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 sm:py-2 text-sm"
            placeholder="Name"
            value={invoice.from.name}
            onChange={(event) => setField("from.name", event.target.value)}
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 sm:py-2 text-sm"
            placeholder="Email"
            type="email"
            value={invoice.from.email}
            onChange={(event) => setField("from.email", event.target.value)}
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 sm:py-2 text-sm"
            placeholder="Address"
            value={invoice.from.address}
            onChange={(event) => setField("from.address", event.target.value)}
          />
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 sm:py-2 text-sm"
              placeholder="City, State"
              value={invoice.from.city}
              onChange={(event) => setField("from.city", event.target.value)}
            />
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 sm:py-2 text-sm"
              placeholder="Zip code"
              value={invoice.from.zipCode}
              onChange={(event) => setField("from.zipCode", event.target.value)}
            />
          </div>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 sm:py-2 text-sm"
            placeholder="Phone"
            value={invoice.from.phone}
            onChange={(event) => setField("from.phone", event.target.value)}
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 sm:py-2 text-sm"
            placeholder="Business Number"
            value={invoice.from.businessNumber}
            onChange={(event) => setField("from.businessNumber", event.target.value)}
          />
          {showFromExtra && (
            <>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 sm:py-2 text-sm"
                placeholder="Mobile"
                value={invoice.from.mobile}
                onChange={(event) => setField("from.mobile", event.target.value)}
              />
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 sm:py-2 text-sm"
                placeholder="Fax"
                value={invoice.from.fax}
                onChange={(event) => setField("from.fax", event.target.value)}
              />
            </>
          )}
          <button
            type="button"
            className="text-xs font-medium text-lagoon hover:underline py-1"
            onClick={() => setShowFromExtra(!showFromExtra)}
          >
            {showFromExtra ? "Show less" : "+ Add sender details"}
          </button>
        </div>

        {/* Bill To */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Bill To</h3>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 sm:py-2 text-sm"
            placeholder="Name"
            value={invoice.to.name}
            onChange={(event) => setField("to.name", event.target.value)}
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 sm:py-2 text-sm"
            placeholder="Email"
            type="email"
            value={invoice.to.email}
            onChange={(event) => setField("to.email", event.target.value)}
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 sm:py-2 text-sm"
            placeholder="Address"
            value={invoice.to.address}
            onChange={(event) => setField("to.address", event.target.value)}
          />
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 sm:py-2 text-sm"
              placeholder="City, State"
              value={invoice.to.city}
              onChange={(event) => setField("to.city", event.target.value)}
            />
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 sm:py-2 text-sm"
              placeholder="Zip code"
              value={invoice.to.zipCode}
              onChange={(event) => setField("to.zipCode", event.target.value)}
            />
          </div>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 sm:py-2 text-sm"
            placeholder="Phone"
            value={invoice.to.phone}
            onChange={(event) => setField("to.phone", event.target.value)}
          />
          {showToExtra && (
            <>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 sm:py-2 text-sm"
                placeholder="Mobile"
                value={invoice.to.mobile}
                onChange={(event) => setField("to.mobile", event.target.value)}
              />
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 sm:py-2 text-sm"
                placeholder="Fax"
                value={invoice.to.fax}
                onChange={(event) => setField("to.fax", event.target.value)}
              />
            </>
          )}
          <button
            type="button"
            className="text-xs font-medium text-lagoon hover:underline py-1"
            onClick={() => setShowToExtra(!showToExtra)}
          >
            {showToExtra ? "Show less" : "+ Add recipient details"}
          </button>
        </div>
      </div>

      {/* Invoice Number / Date / Terms */}
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">
        <label className="text-sm font-medium text-slate-600">
          Number
          <div className="relative mt-1.5 sm:mt-2">
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 sm:py-2 pr-10 text-sm"
              value={invoice.invoiceNumber}
              onChange={(event) => setField("invoiceNumber", event.target.value)}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-lagoon p-1"
              onClick={() => navigator.clipboard.writeText(invoice.invoiceNumber)}
              title="Copy"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </label>
        <label className="text-sm font-medium text-slate-600">
          Date
          <input
            type="date"
            className="mt-1.5 sm:mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 sm:py-2 text-sm"
            value={invoice.issueDate}
            onChange={(event) => setField("issueDate", event.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-slate-600">
          Terms
          <select
            className="mt-1.5 sm:mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:py-2 text-sm"
            value={invoice.paymentTerms}
            onChange={(event) => setField("paymentTerms", event.target.value as PaymentTerms)}
          >
            {Object.entries(PAYMENT_TERMS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Line Items */}
      <LineItemsEditor />

      {/* Notes */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Notes</h3>
        <textarea
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 sm:py-2 text-sm resize-none"
          rows={3}
          placeholder="Notes – any relevant information not covered, additional terms and conditions"
          value={invoice.notes}
          onChange={(event) => setField("notes", event.target.value)}
        />
      </div>

      {/* Signature */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Signature</h3>
        <label className="group flex h-16 sm:h-20 w-32 sm:w-40 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 transition hover:border-lagoon hover:bg-lagoon/5">
          {invoice.signatureDataUrl ? (
            <img
              src={invoice.signatureDataUrl}
              alt="Signature"
              className="h-full w-full rounded-xl object-contain p-2"
            />
          ) : (
            <span className="text-xs text-slate-400">+ Add Signature</span>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={handleSignatureUpload} />
        </label>
        {invoice.signatureDataUrl && (
          <button
            type="button"
            className="text-xs text-ember hover:underline"
            onClick={() => setSignature(null)}
          >
            Remove signature
          </button>
        )}
      </div>

      {/* Photos */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Photos</h3>
        <div className="flex flex-wrap gap-3">
          {invoice.photoDataUrls.map((photo, index) => (
            <div key={index} className="relative group">
              <img
                src={photo}
                alt={`Photo ${index + 1}`}
                className="h-16 w-16 rounded-lg object-cover"
              />
              <button
                type="button"
                className="absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full bg-ember text-white group-hover:flex"
                onClick={() => removePhoto(index)}
              >
                ×
              </button>
            </div>
          ))}
          <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 transition hover:border-lagoon hover:bg-lagoon/5 hover:text-lagoon">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </label>
        </div>
      </div>
    </div>
  );
}
