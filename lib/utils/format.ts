import { Currency } from "@/lib/store/invoiceStore";

export const formatCurrency = (amount: number, currency: Currency) => {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: currency.code,
    maximumFractionDigits: 0
  }).format(amount);
};

export const formatCurrencyKES = (amount: number) => {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0
  }).format(amount);
};
