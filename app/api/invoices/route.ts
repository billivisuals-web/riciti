import { NextRequest, NextResponse } from "next/server";
import { getTenantContext, generateInvoiceNumber } from "@/lib/session";
import { createInvoice, listInvoices } from "@/lib/db/invoices";
import { DocumentType, PaymentTerms, DiscountType } from "@/lib/db/types";
import { CreateInvoiceSchema } from "@/lib/validators";
import { invoiceCreateLimiter, privateCrudLimiter, getClientIP, consumeRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/invoices
 * List all invoices for the current user/guest
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limit reads
    const ip = getClientIP(request);
    const rlResult = await consumeRateLimit(privateCrudLimiter, ip);
    if (!rlResult.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rlResult.retryAfterMs / 1000)) } }
      );
    }

    const ctx = await getTenantContext();
    const { searchParams } = new URL(request.url);
    
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10) || 20, 1), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);
    const rawOrderBy = searchParams.get("orderBy") || "createdAt";
    const orderBy = (["createdAt", "issueDate", "dueDate"] as const).includes(rawOrderBy as any)
      ? (rawOrderBy as "createdAt" | "issueDate" | "dueDate")
      : "createdAt";
    const rawOrderDir = searchParams.get("orderDir") || "desc";
    const orderDir = rawOrderDir === "asc" ? "asc" : "desc";

    const { invoices, total } = await listInvoices(ctx, {
      limit,
      offset,
      orderBy,
      orderDir,
    });

    const response = NextResponse.json({
      invoices,
      total,
      limit,
      offset,
    });

    // Cache for 10s, allow stale for 30s while revalidating
    response.headers.set(
      "Cache-Control",
      "private, max-age=10, stale-while-revalidate=30"
    );

    return response;
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
    // Rate limit
    const ip = getClientIP(request);
    const { allowed, retryAfterMs } = await consumeRateLimit(invoiceCreateLimiter, ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
        }
      );
    }

    const ctx = await getTenantContext();
    const body = await request.json();

    // Validate with Zod
    const parsed = CreateInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstIssue.message, field: firstIssue.path.join(".") },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Generate invoice number if not provided
    const invoiceNumber = data.invoiceNumber || generateInvoiceNumber();

    // Calculate due date if not provided (default: 7 days from now)
    const dueDate = data.dueDate
      ? new Date(data.dueDate)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Map string enums to uppercase
    const documentType = data.documentType?.toUpperCase() as DocumentType | undefined;
    const paymentTerms = data.paymentTerms?.toUpperCase().replace(/-/g, "_") as PaymentTerms | undefined;
    const discountType = data.discountType?.toUpperCase() as DiscountType | undefined;

    const invoice = await createInvoice({
      userId: ctx.userId,
      guestSessionId: ctx.guestSessionId,
      invoiceNumber,
      dueDate,
      documentType,
      paymentTerms,
      discountType,
      documentTitle: data.documentTitle,
      issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
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

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    );
  }
}
