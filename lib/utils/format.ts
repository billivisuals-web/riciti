import { Currency } from "@/lib/store/invoiceStore";

export const formatCurrency = (amount: number, currency: Currency) => {
  try {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: currency.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    // Fallback if Intl fails for any reason
    return `${currency.symbol} ${amount.toFixed(2)}`;
  }
};

export const formatCurrencyKES = (amount: number) => {
  try {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `KSh ${amount.toFixed(2)}`;
  }
};
