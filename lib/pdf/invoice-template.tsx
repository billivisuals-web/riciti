/**
 * Server-side PDF invoice template using @react-pdf/renderer.
 *
 * Mirrors the visual layout of InvoicePreview.tsx but uses
 * @react-pdf primitives (Document, Page, View, Text, Image).
 *
 * This runs in Node.js (API route) — no browser needed.
 * The generated PDF contains NO service-fee reference and NO watermark.
 */

import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { InvoiceWithItems } from "@/lib/db/types";
import { calculateInvoiceTotals } from "@/lib/utils/totals";

/* ------------------------------------------------------------------ */
/*  Payment terms labels (server-side copy — no "use client" store)   */
/* ------------------------------------------------------------------ */
const PAYMENT_TERMS_LABELS: Record<string, string> = {
  DUE_ON_RECEIPT: "Due on Receipt",
  NET_7: "Net 7",
  NET_15: "Net 15",
  NET_30: "Net 30",
  NET_60: "Net 60",
  CUSTOM: "Custom",
};

/* ------------------------------------------------------------------ */
/*  Currency formatter (server-side — Intl works in Node 20)          */
/* ------------------------------------------------------------------ */
function formatCurrency(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Lighten a hex colour for use as a very faint row stripe */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/** Return a very light tint of the accent colour for even rows */
function accentTint(hex: string, opacity = 0.06): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#f8fafc"; // slate‑50 fallback
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 40,
    color: "#0f1a24",
  },
  /* Header */
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#0f1a24",
  },
  invoiceNumber: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 4,
  },
  logo: {
    width: 70,
    height: 50,
    objectFit: "contain",
  },
  logoPlaceholder: {
    width: 70,
    height: 50,
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
  },

  /* Parties */
  partiesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  partyBlock: {
    width: "48%",
  },
  partyLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: "#94a3b8",
    marginBottom: 6,
  },
  partyName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#0f1a24",
    marginBottom: 2,
  },
  partyText: {
    fontSize: 9,
    color: "#475569",
    marginBottom: 1,
  },

  /* Dates row */
  datesRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  dateBox: {
    flex: 1,
    border: "1 solid #e2e8f0",
    borderRadius: 6,
    padding: 8,
  },
  dateLabel: {
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#94a3b8",
  },
  dateValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#0f1a24",
    marginTop: 2,
  },

  /* Table */
  table: {
    borderRadius: 8,
    overflow: "hidden",
    border: "1 solid #e2e8f0",
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tableHeaderText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#ffffff",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTop: "0.5 solid #e2e8f0",
  },
  colDescription: { width: "45%" },
  colRate: { width: "20%", textAlign: "right" },
  colQty: { width: "15%", textAlign: "center" },
  colAmount: { width: "20%", textAlign: "right" },
  cellText: { fontSize: 9, color: "#475569" },
  cellBold: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#0f1a24" },
  cellDetail: { fontSize: 8, color: "#94a3b8", marginTop: 2 },

  /* Totals */
  totalsContainer: {
    alignItems: "flex-end",
    marginTop: 4,
  },
  totalsBlock: {
    width: 220,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalsLabel: { fontSize: 9, color: "#64748b" },
  totalsValue: { fontSize: 9, color: "#64748b" },
  totalDueBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  totalDueText: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },

  /* Notes */
  notesBox: {
    marginTop: 18,
    border: "1 solid #e2e8f0",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    padding: 12,
  },
  notesLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#94a3b8",
    marginBottom: 6,
  },
  notesText: {
    fontSize: 9,
    color: "#475569",
    lineHeight: 1.5,
  },

  /* Signature */
  signatureSection: {
    marginTop: 18,
  },
  signatureLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#94a3b8",
    marginBottom: 6,
  },
  signatureImage: {
    height: 50,
    objectFit: "contain",
  },
});

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

type InvoicePDFProps = {
  invoice: InvoiceWithItems;
};

export function InvoicePDF({ invoice }: InvoicePDFProps) {
  const accent = invoice.accentColor || "#1f8ea3";
  const curr = invoice.currency || "KES";

  const totals = calculateInvoiceTotals({
    items: invoice.items,
    taxRate: Number(invoice.taxRate) || 0,
    discountType: invoice.discountType,
    discountValue: Number(invoice.discountValue) || 0,
  });

  const fmt = (amount: number) => formatCurrency(amount, curr);

  const formatDate = (d: Date | string | null) => {
    if (!d) return "—";
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toISOString().slice(0, 10);
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ---- Header ---- */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>
              {invoice.documentTitle || "Invoice"}
            </Text>
            <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
          </View>
          {invoice.logoDataUrl ? (
            <Image src={invoice.logoDataUrl} style={styles.logo} />
          ) : (
            <View style={styles.logoPlaceholder} />
          )}
        </View>

        {/* ---- From / Bill To ---- */}
        <View style={styles.partiesRow}>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>From</Text>
            <Text style={styles.partyName}>{invoice.fromName}</Text>
            {invoice.fromAddress ? (
              <Text style={styles.partyText}>{invoice.fromAddress}</Text>
            ) : null}
            {(invoice.fromCity || invoice.fromZipCode) ? (
              <Text style={styles.partyText}>
                {invoice.fromCity}
                {invoice.fromZipCode ? `, ${invoice.fromZipCode}` : ""}
              </Text>
            ) : null}
            {invoice.fromEmail ? (
              <Text style={styles.partyText}>{invoice.fromEmail}</Text>
            ) : null}
            {invoice.fromPhone ? (
              <Text style={styles.partyText}>{invoice.fromPhone}</Text>
            ) : null}
            {invoice.fromBusinessNumber ? (
              <Text style={[styles.partyText, { fontSize: 8, color: "#94a3b8" }]}>
                BN: {invoice.fromBusinessNumber}
              </Text>
            ) : null}
          </View>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Bill To</Text>
            <Text style={styles.partyName}>{invoice.toName}</Text>
            {invoice.toAddress ? (
              <Text style={styles.partyText}>{invoice.toAddress}</Text>
            ) : null}
            {(invoice.toCity || invoice.toZipCode) ? (
              <Text style={styles.partyText}>
                {invoice.toCity}
                {invoice.toZipCode ? `, ${invoice.toZipCode}` : ""}
              </Text>
            ) : null}
            {invoice.toEmail ? (
              <Text style={styles.partyText}>{invoice.toEmail}</Text>
            ) : null}
            {invoice.toPhone ? (
              <Text style={styles.partyText}>{invoice.toPhone}</Text>
            ) : null}
            {invoice.toMobile ? (
              <Text style={styles.partyText}>Mobile: {invoice.toMobile}</Text>
            ) : null}
          </View>
        </View>

        {/* ---- Dates ---- */}
        <View style={styles.datesRow}>
          <View style={styles.dateBox}>
            <Text style={styles.dateLabel}>Date</Text>
            <Text style={styles.dateValue}>{formatDate(invoice.issueDate)}</Text>
          </View>
          <View style={styles.dateBox}>
            <Text style={styles.dateLabel}>Due</Text>
            <Text style={styles.dateValue}>{formatDate(invoice.dueDate)}</Text>
          </View>
          <View style={styles.dateBox}>
            <Text style={styles.dateLabel}>Terms</Text>
            <Text style={styles.dateValue}>
              {PAYMENT_TERMS_LABELS[invoice.paymentTerms] || invoice.paymentTerms}
            </Text>
          </View>
        </View>

        {/* ---- Line Items Table ---- */}
        <View style={styles.table}>
          {/* Header */}
          <View style={[styles.tableHeader, { backgroundColor: accent }]}>
            <Text style={[styles.tableHeaderText, styles.colDescription]}>
              Description
            </Text>
            <Text style={[styles.tableHeaderText, styles.colRate]}>Rate</Text>
            <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderText, styles.colAmount]}>Amount</Text>
          </View>

          {/* Rows */}
          {invoice.items.map((item, idx) => (
            <View
              key={item.id}
              style={[
                styles.tableRow,
                { backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc" },
              ]}
            >
              <View style={styles.colDescription}>
                <Text style={styles.cellBold}>
                  {item.description || "Line item"}
                </Text>
                {item.additionalDetails ? (
                  <Text style={styles.cellDetail}>{item.additionalDetails}</Text>
                ) : null}
              </View>
              <Text style={[styles.cellText, styles.colRate]}>{fmt(item.rate)}</Text>
              <Text style={[styles.cellText, styles.colQty]}>{String(item.quantity)}</Text>
              <Text style={[styles.cellBold, styles.colAmount]}>
                {fmt(item.quantity * item.rate)}
              </Text>
            </View>
          ))}
        </View>

        {/* ---- Totals ---- */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalsBlock}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{fmt(totals.subtotal)}</Text>
            </View>

            {(Number(invoice.taxRate) || 0) > 0 ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Tax ({invoice.taxRate}%)</Text>
                <Text style={styles.totalsValue}>{fmt(totals.taxAmount)}</Text>
              </View>
            ) : null}

            {Number(invoice.discountValue) > 0 ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>
                  Discount
                  {invoice.discountType === "PERCENTAGE"
                    ? ` (${invoice.discountValue}%)`
                    : ""}
                </Text>
                <Text style={styles.totalsValue}>
                  -{fmt(totals.discountAmount)}
                </Text>
              </View>
            ) : null}

            <View style={[styles.totalDueBar, { backgroundColor: accent }]}>
              <Text style={styles.totalDueText}>Balance Due</Text>
              <Text style={styles.totalDueText}>{fmt(totals.total)}</Text>
            </View>
          </View>
        </View>

        {/* ---- Notes ---- */}
        {invoice.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* ---- Signature ---- */}
        {invoice.signatureDataUrl ? (
          <View style={styles.signatureSection}>
            <Text style={styles.signatureLabel}>Signature</Text>
            <Image src={invoice.signatureDataUrl} style={styles.signatureImage} />
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
