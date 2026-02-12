"use client";

import { create } from "zustand";

export type InvoiceParty = {
  name: string;
  email: string;
  phone: string;
  mobile: string;
  fax: string;
  address: string;
  city: string;
  zipCode: string;
  businessNumber: string;
};

export type InvoiceLineItem = {
  id: string;
  description: string;
  additionalDetails: string;
  quantity: number;
  rate: number;
};

export type Currency = {
  code: string;
  symbol: string;
  flag: string;
};

export type DocumentType = "invoice" | "receipt" | "estimate" | "quote";

export type DiscountType = "percentage" | "fixed";

export type PaymentTerms =
  | "due_on_receipt"
  | "net_7"
  | "net_15"
  | "net_30"
  | "net_60"
  | "custom";

export const CURRENCIES: Currency[] = [
  { code: "KES", symbol: "KSh", flag: "🇰🇪" },
  { code: "USD", symbol: "$", flag: "🇺🇸" },
  { code: "EUR", symbol: "€", flag: "🇪🇺" },
  { code: "GBP", symbol: "£", flag: "🇬🇧" },
  { code: "TZS", symbol: "TSh", flag: "🇹🇿" },
  { code: "UGX", symbol: "USh", flag: "🇺🇬" },
];

export const ACCENT_COLORS = [
  "#1f8ea3",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#64748b",
  "#0f172a",
];

export const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
  due_on_receipt: "Due on Receipt",
  net_7: "Net 7",
  net_15: "Net 15",
  net_30: "Net 30",
  net_60: "Net 60",
  custom: "Custom",
};

export type InvoiceData = {
  documentTitle: string;
  documentType: DocumentType;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  paymentTerms: PaymentTerms;
  from: InvoiceParty;
  to: InvoiceParty;
  notes: string;
  taxRate: number;
  discountType: DiscountType;
  discountValue: number;
  currency: Currency;
  accentColor: string;
  logoDataUrl: string | null;
  signatureDataUrl: string | null;
  photoDataUrls: string[];
  items: InvoiceLineItem[];
  isPaid: boolean;
  showCustomTable: boolean;
};

type InvoiceStore = {
  invoice: InvoiceData;
  setField: (path: string, value: string | number | boolean) => void;
  setLogo: (dataUrl: string | null) => void;
  setSignature: (dataUrl: string | null) => void;
  addPhoto: (dataUrl: string) => void;
  removePhoto: (index: number) => void;
  setCurrency: (currency: Currency) => void;
  addItem: () => void;
  updateItem: (id: string, field: keyof InvoiceLineItem, value: string | number) => void;
  removeItem: (id: string) => void;
  setIsPaid: (paid: boolean) => void;
};

const createId = () => Math.random().toString(36).slice(2, 10);

const today = new Date();
const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const defaultInvoice: InvoiceData = {
  documentTitle: "Invoice",
  documentType: "invoice",
  invoiceNumber: `INV-${today.getFullYear()}-001`,
  issueDate: formatDate(today),
  dueDate: formatDate(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)),
  paymentTerms: "net_7",
  from: {
    name: "",
    email: "",
    phone: "",
    mobile: "",
    fax: "",
    address: "",
    city: "",
    zipCode: "",
    businessNumber: ""
  },
  to: {
    name: "",
    email: "",
    phone: "",
    mobile: "",
    fax: "",
    address: "",
    city: "",
    zipCode: "",
    businessNumber: ""
  },
  notes: "",
  taxRate: 16,
  discountType: "percentage",
  discountValue: 0,
  currency: CURRENCIES[0],
  accentColor: "#1f8ea3",
  logoDataUrl: null,
  signatureDataUrl: null,
  photoDataUrls: [],
  items: [
    {
      id: createId(),
      description: "",
      additionalDetails: "",
      quantity: 1,
      rate: 0
    }
  ],
  isPaid: false,
  showCustomTable: false
};

export const useInvoiceStore = create<InvoiceStore>((set, get) => ({
  invoice: defaultInvoice,
  setField: (path, value) =>
    set((state) => {
      const updated = { ...state.invoice } as InvoiceData;
      const keys = path.split(".");
      let cursor: Record<string, unknown> = updated as unknown as Record<string, unknown>;
      keys.slice(0, -1).forEach((key) => {
        cursor[key] = { ...(cursor[key] as Record<string, unknown>) };
        cursor = cursor[key] as Record<string, unknown>;
      });
      cursor[keys[keys.length - 1]] = value as never;
      return { invoice: updated };
    }),
  setLogo: (dataUrl) =>
    set((state) => ({
      invoice: {
        ...state.invoice,
        logoDataUrl: dataUrl
      }
    })),
  setSignature: (dataUrl) =>
    set((state) => ({
      invoice: {
        ...state.invoice,
        signatureDataUrl: dataUrl
      }
    })),
  addPhoto: (dataUrl) =>
    set((state) => ({
      invoice: {
        ...state.invoice,
        photoDataUrls: [...state.invoice.photoDataUrls, dataUrl]
      }
    })),
  removePhoto: (index) =>
    set((state) => ({
      invoice: {
        ...state.invoice,
        photoDataUrls: state.invoice.photoDataUrls.filter((_, i) => i !== index)
      }
    })),
  setCurrency: (currency) =>
    set((state) => ({
      invoice: {
        ...state.invoice,
        currency
      }
    })),
  addItem: () =>
    set((state) => ({
      invoice: {
        ...state.invoice,
        items: [
          ...state.invoice.items,
          { id: createId(), description: "", additionalDetails: "", quantity: 1, rate: 0 }
        ]
      }
    })),
  updateItem: (id, field, value) =>
    set((state) => ({
      invoice: {
        ...state.invoice,
        items: state.invoice.items.map((item) =>
          item.id === id
            ? {
                ...item,
                [field]: field === "quantity" || field === "rate" ? (Number(value) || 0) : value
              }
            : item
        )
      }
    })),
  removeItem: (id) =>
    set((state) => ({
      invoice: {
        ...state.invoice,
        items: state.invoice.items.filter((item) => item.id !== id)
      }
    })),
  setIsPaid: (paid) =>
    set((state) => ({
      invoice: {
        ...state.invoice,
        isPaid: paid
      }
    }))
}));
