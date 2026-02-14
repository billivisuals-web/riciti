"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type PaymentModalProps = {
  publicId: string;
  amount: number;
  currency?: string;
  onClose: () => void;
  onPaid?: () => void;
};

type PaymentState =
  | "idle"
  | "submitting"
  | "polling"
  | "success"
  | "failed"
  | "cancelled"
  | "timeout";

export default function PaymentModal({
  publicId,
  amount,
  currency = "KES",
  onClose,
  onPaid,
}: PaymentModalProps) {
  const [phone, setPhone] = useState("+254");
  const [state, setState] = useState<PaymentState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [receiptNumber, setReceiptNumber] = useState<string | null>(null);
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const pollCountRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxPolls = 12; // Fewer polls with exponential backoff (~90s total)

  // Exponential backoff intervals: 5s, 5s, 8s, 8s, 10s, 10s, 13s, 13s, ...
  const getPollInterval = (count: number): number => {
    const base = 5000;
    const step = Math.floor(count / 2);
    return Math.min(base + step * 3000, 20000); // Max 20s between polls
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const pollStatus = useCallback(async () => {
    if (pollCountRef.current >= maxPolls) {
      setState("timeout");
      return;
    }

    pollCountRef.current++;

    try {
      const res = await fetch(
        `/api/invoices/public/${publicId}/status`
      );
      const data = await res.json();

      if (data.isPaid) {
        setState("success");
        setReceiptNumber(
          data.latestPayment?.mpesaReceiptNumber || null
        );
        onPaid?.();
        return;
      }

      // Check if latest payment failed/cancelled
      if (data.latestPayment) {
        if (data.latestPayment.status === "FAILED") {
          setState("failed");
          setError("Payment was not completed. Please try again.");
          return;
        }
        if (data.latestPayment.status === "CANCELLED") {
          setState("cancelled");
          return;
        }
      }
    } catch {
      // Network error — keep polling
    }

    // Schedule next poll with exponential backoff
    pollTimerRef.current = setTimeout(pollStatus, getPollInterval(pollCountRef.current));
  }, [publicId, onPaid]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setState("submitting");

    try {
      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId, phoneNumber: phone }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to initiate payment");
        setState("failed");
        return;
      }

      setCheckoutRequestId(data.checkoutRequestId);
      setState("polling");
      pollCountRef.current = 0;

      // Start polling after a short delay (give user time to see prompt)
      pollTimerRef.current = setTimeout(pollStatus, 5000);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setState("failed");
    }
  };

  const handleRetry = () => {
    setState("idle");
    setError(null);
    setCheckoutRequestId(null);
    pollCountRef.current = 0;
  };

  const handleManualQuery = async () => {
    if (!checkoutRequestId) return;
    setError(null);

    try {
      const res = await fetch("/api/payments/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutRequestId }),
      });

      const data = await res.json();

      if (data.status === "COMPLETED") {
        setState("success");
        setReceiptNumber(data.mpesaReceiptNumber || null);
        onPaid?.();
      } else if (data.status === "CANCELLED") {
        setState("cancelled");
      } else if (data.status === "FAILED") {
        setState("failed");
        setError(data.resultDesc || "Payment failed");
      } else {
        setError("Payment is still being processed. Please wait…");
      }
    } catch {
      setError("Could not check payment status. Try again.");
    }
  };

  const formatAmount = (val: number) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    }).format(val);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4">
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-soft"
        style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
      >
        {/* ---- HEADER ---- */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-ink">
              {state === "success" ? "Payment Complete" : "Pay with M-Pesa"}
            </h2>
            {state === "idle" && (
              <p className="mt-2 text-sm text-slate-500">
                Pay {formatAmount(amount)} via M-Pesa STK Push.
              </p>
            )}
          </div>
          {state !== "polling" && state !== "submitting" && (
            <button
              type="button"
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 active:bg-slate-100"
              onClick={onClose}
            >
              Close
            </button>
          )}
        </div>

        {/* ---- IDLE: Phone input form ---- */}
        {(state === "idle" || state === "submitting") && (
          <form className="mt-5 sm:mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="text-sm font-medium text-slate-600 block">
              M-Pesa phone number
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
                placeholder="e.g. 0712345678"
                disabled={state === "submitting"}
              />
            </label>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-full bg-ink px-4 py-3.5 text-sm font-semibold text-white shadow transition hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
              disabled={state === "submitting"}
            >
              {state === "submitting"
                ? "Sending STK push…"
                : `Pay ${formatAmount(amount)}`}
            </button>
          </form>
        )}

        {/* ---- POLLING: Waiting for payment ---- */}
        {state === "polling" && (
          <div className="mt-6 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-lagoon" />
            </div>
            <p className="text-sm text-slate-600">
              STK Push sent to <strong>{phone}</strong>
            </p>
            <p className="text-xs text-slate-400">
              Enter your M-Pesa PIN on your phone to complete the payment.
            </p>
            <button
              type="button"
              className="text-xs text-slate-400 underline hover:text-slate-600"
              onClick={handleManualQuery}
            >
              Check status manually
            </button>
          </div>
        )}

        {/* ---- SUCCESS ---- */}
        {state === "success" && (
          <div className="mt-6 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-sm font-medium text-ink">
              Payment of {formatAmount(amount)} received!
            </p>
            {receiptNumber && (
              <p className="text-xs text-slate-500">
                M-Pesa Receipt: <strong>{receiptNumber}</strong>
              </p>
            )}
            <button
              type="button"
              className="w-full rounded-full bg-ink px-4 py-3.5 text-sm font-semibold text-white shadow transition hover:-translate-y-0.5 active:translate-y-0"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        )}

        {/* ---- FAILED / CANCELLED / TIMEOUT ---- */}
        {(state === "failed" || state === "cancelled" || state === "timeout") && (
          <div className="mt-6 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-sm font-medium text-ink">
              {state === "cancelled"
                ? "Payment was cancelled"
                : state === "timeout"
                ? "Payment timed out"
                : "Payment failed"}
            </p>
            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}
            {state === "timeout" && (
              <p className="text-xs text-slate-400">
                The payment may still be processing. You can check manually or try again.
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white shadow"
                onClick={handleRetry}
              >
                Try again
              </button>
            </div>
            {checkoutRequestId && state === "timeout" && (
              <button
                type="button"
                className="text-xs text-slate-400 underline hover:text-slate-600"
                onClick={handleManualQuery}
              >
                Check status manually
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
