import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/session";
import {
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
} from "@/lib/db/invoices";
import { DocumentType, PaymentTerms, DiscountType } from "@/lib/db/types";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/invoices/[id]
 * Get a single invoice by ID (with tenant isolation)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await getTenantContext();

    const invoice = await getInvoiceById(id, ctx);

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(invoice);
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
    const { id } = await params;
    const ctx = await getTenantContext();
    const body = await request.json();

    // Map string enums if provided
    const documentType = body.documentType?.toUpperCase() as DocumentType | undefined;
    const paymentTerms = body.paymentTerms?.toUpperCase().replace(/-/g, "_") as PaymentTerms | undefined;
    const discountType = body.discountType?.toUpperCase() as DiscountType | undefined;

    const invoice = await updateInvoice(id, ctx, {
      documentType,
      paymentTerms,
      discountType,
      documentTitle: body.documentTitle,
      invoiceNumber: body.invoiceNumber,
      issueDate: body.issueDate ? new Date(body.issueDate) : undefined,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      fromName: body.fromName,
      fromEmail: body.fromEmail,
      fromPhone: body.fromPhone,
      fromMobile: body.fromMobile,
      fromFax: body.fromFax,
      fromAddress: body.fromAddress,
      fromCity: body.fromCity,
      fromZipCode: body.fromZipCode,
      fromBusinessNumber: body.fromBusinessNumber,
      toName: body.toName,
      toEmail: body.toEmail,
      toPhone: body.toPhone,
      toMobile: body.toMobile,
      toFax: body.toFax,
      toAddress: body.toAddress,
      toCity: body.toCity,
      toZipCode: body.toZipCode,
      toBusinessNumber: body.toBusinessNumber,
      currency: body.currency,
      taxRate: body.taxRate,
      discountValue: body.discountValue,
      accentColor: body.accentColor,
      logoDataUrl: body.logoDataUrl,
      signatureDataUrl: body.signatureDataUrl,
      notes: body.notes,
      items: body.items,
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
