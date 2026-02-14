import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/session";
import {
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
} from "@/lib/db/invoices";
import { DocumentType, PaymentTerms, DiscountType } from "@/lib/db/types";
import { UpdateInvoiceSchema } from "@/lib/validators";
import { privateCrudLimiter, getClientIP, consumeRateLimit } from "@/lib/rate-limit";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/invoices/[id]
 * Get a single invoice by ID (with tenant isolation)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const ip = getClientIP(request);
    const rl = await consumeRateLimit(privateCrudLimiter, ip);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { id } = await params;
    const ctx = await getTenantContext();

    const invoice = await getInvoiceById(id, ctx);

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    const response = NextResponse.json(invoice);
    response.headers.set(
      "Cache-Control",
      "private, max-age=5, stale-while-revalidate=15"
    );
    return response;
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/invoices/[id]
 * Update an invoice (with tenant isolation)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const ip = getClientIP(request);
    const rl = await consumeRateLimit(privateCrudLimiter, ip);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { id } = await params;
    const ctx = await getTenantContext();
    const body = await request.json();

    // Validate with Zod
    const parsed = UpdateInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstIssue.message, field: firstIssue.path.join(".") },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Map string enums if provided
    const documentType = data.documentType?.toUpperCase() as DocumentType | undefined;
    const paymentTerms = data.paymentTerms?.toUpperCase().replace(/-/g, "_") as PaymentTerms | undefined;
    const discountType = data.discountType?.toUpperCase() as DiscountType | undefined;

    const invoice = await updateInvoice(id, ctx, {
      documentType,
      paymentTerms,
      discountType,
      documentTitle: data.documentTitle,
      invoiceNumber: data.invoiceNumber,
      issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      fromName: data.fromName,
      fromEmail: data.fromEmail,
      fromPhone: data.fromPhone,
      fromMobile: data.fromMobile,
      fromFax: data.fromFax,
      fromAddress: data.fromAddress,
      fromCity: data.fromCity,
      fromZipCode: data.fromZipCode,
      fromBusinessNumber: data.fromBusinessNumber,
      toName: data.toName,
      toEmail: data.toEmail,
      toPhone: data.toPhone,
      toMobile: data.toMobile,
      toFax: data.toFax,
      toAddress: data.toAddress,
      toCity: data.toCity,
      toZipCode: data.toZipCode,
      toBusinessNumber: data.toBusinessNumber,
      currency: data.currency,
      taxRate: data.taxRate,
      discountValue: data.discountValue,
      accentColor: data.accentColor,
      logoDataUrl: data.logoDataUrl ?? undefined,
      signatureDataUrl: data.signatureDataUrl ?? undefined,
      notes: data.notes,
      items: data.items,
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Error updating invoice:", error);
    return NextResponse.json(
      { error: "Failed to update invoice" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/invoices/[id]
 * Delete an invoice (with tenant isolation)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const ip = getClientIP(request);
    const rl = await consumeRateLimit(privateCrudLimiter, ip);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { id } = await params;
    const ctx = await getTenantContext();

    const deleted = await deleteInvoice(id, ctx);

    if (!deleted) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    return NextResponse.json(
      { error: "Failed to delete invoice" },
      { status: 500 }
    );
  }
}
