import { NextRequest, NextResponse } from "next/server";
import { getTenantContext, generateInvoiceNumber } from "@/lib/session";
import { createInvoice, listInvoices } from "@/lib/db/invoices";
import { DocumentType, PaymentTerms, DiscountType } from "@/lib/db/types";

/**
 * GET /api/invoices
 * List all invoices for the current user/guest
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantContext();
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const orderBy = (searchParams.get("orderBy") || "createdAt") as "createdAt" | "issueDate" | "dueDate";
    const orderDir = (searchParams.get("orderDir") || "desc") as "asc" | "desc";

    const { invoices, total } = await listInvoices(ctx, {
      limit,
      offset,
      orderBy,
      orderDir,
    });

    return NextResponse.json({
      invoices,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error listing invoices:", error);
    return NextResponse.json(
      { error: "Failed to list invoices" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/invoices
 * Create a new invoice
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantContext();
    const body = await request.json();

    // Validate required fields
    if (!body.fromName || !body.toName) {
      return NextResponse.json(
        { error: "fromName and toName are required" },
        { status: 400 }
      );
    }

    // Generate invoice number if not provided
    const invoiceNumber = body.invoiceNumber || generateInvoiceNumber();

    // Calculate due date if not provided (default: 7 days from now)
    const dueDate = body.dueDate
      ? new Date(body.dueDate)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Map string enums to uppercase
    const documentType = body.documentType?.toUpperCase() as DocumentType | undefined;
    const paymentTerms = body.paymentTerms?.toUpperCase().replace(/-/g, "_") as PaymentTerms | undefined;
    const discountType = body.discountType?.toUpperCase() as DiscountType | undefined;

    const invoice = await createInvoice({
      userId: ctx.userId,
      guestSessionId: ctx.guestSessionId,
      invoiceNumber,
      dueDate,
      documentType,
      paymentTerms,
      discountType,
      documentTitle: body.documentTitle,
      issueDate: body.issueDate ? new Date(body.issueDate) : undefined,
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

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    );
  }
}
