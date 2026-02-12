"use client";

import { useState } from "react";

type PaymentModalProps = {
  onClose: () => void;
};

export default function PaymentModal({ onClose }: PaymentModalProps) {
  const [phone, setPhone] = useState("+254");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4">
      <div 
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-soft"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-ink">Unlock your PDF</h2>
            <p className="mt-2 text-sm text-slate-500">
              Enter your M-Pesa number and confirm the STK push on your phone.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 active:bg-slate-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <form className="mt-5 sm:mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="text-sm font-medium text-slate-600 block">
            Phone number
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
              autoComplete="tel"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-full bg-ink px-4 py-3.5 text-sm font-semibold text-white shadow transition hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Sending STK push..." : "Send STK push"}
          </button>
        </form>
      </div>
    </div>
  );
}
