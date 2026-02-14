import { createClient } from "@/lib/supabase/server";
import { findUserByExternalId, listInvoices, getDashboardStats } from "@/lib/db/supabase-db";
import Link from "next/link";
import type { Invoice } from "@/lib/db/types";

type DocumentType = "INVOICE" | "RECEIPT" | "ESTIMATE" | "QUOTE";

const documentTypeLabels: Record<DocumentType, string> = {
  INVOICE: "Invoice",
  RECEIPT: "Receipt",
  ESTIMATE: "Estimate",
  QUOTE: "Quote",
};

const documentTypeColors: Record<DocumentType, string> = {
  INVOICE: "bg-blue-100 text-blue-800",
  RECEIPT: "bg-green-100 text-green-800",
  ESTIMATE: "bg-yellow-100 text-yellow-800",
  QUOTE: "bg-purple-100 text-purple-800",
};

function formatCurrency(amount: number, currency: string) {
  const symbols: Record<string, string> = {
    KES: "KSh",
    USD: "$",
    EUR: "€",
    GBP: "£",
    TZS: "TSh",
    UGX: "USh",
  };
  return `${symbols[currency] || currency} ${amount.toLocaleString()}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get user from our database
  const dbUser = await findUserByExternalId(user!.id);

  if (!dbUser) {
    return (
      <div className="text-center py-12">
        <p className="text-ink/60">Account not found. Please sign in again.</p>
      </div>
    );
  }

  // Fetch stats via efficient aggregate query + paginated recent invoices in parallel
  const [stats, { invoices }] = await Promise.all([
    getDashboardStats(dbUser.id),
    listInvoices({ userId: dbUser.id }, { limit: 20, offset: 0 }),
  ]);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink">
            Welcome back, {user?.user_metadata?.full_name?.split(" ")[0] || "there"}!
          </h1>
          <p className="text-ink/60 mt-1 text-sm sm:text-base">
            Manage your invoices and track payments
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 bg-lagoon hover:bg-lagoon/90 active:bg-lagoon/80 text-white font-medium py-3 sm:py-2.5 px-5 rounded-xl transition-colors w-full sm:w-auto"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create New Document
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100">
          <p className="text-xs sm:text-sm text-ink/60">Total Documents</p>
          <p className="text-xl sm:text-2xl font-bold text-ink mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100">
          <p className="text-xs sm:text-sm text-ink/60">Paid</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600 mt-1">{stats.paid}</p>
        </div>
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100">
          <p className="text-xs sm:text-sm text-ink/60">Pending</p>
          <p className="text-xl sm:text-2xl font-bold text-amber-600 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100">
          <p className="text-xs sm:text-sm text-ink/60">Total Value</p>
          <p className="text-lg sm:text-2xl font-bold text-ink mt-1">
            {formatCurrency(stats.totalValue, "KES")}
          </p>
        </div>
      </div>

      {/* Documents Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-ink">Recent Documents</h2>
        </div>

        {invoices.length === 0 ? (
          <div className="px-4 sm:px-6 py-12 text-center">
            <div className="w-16 h-16 bg-mist rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-ink/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="font-medium text-ink mb-1">No documents yet</h3>
            <p className="text-ink/60 text-sm mb-4">
              Create your first invoice to get started
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-lagoon hover:text-lagoon/80 font-medium text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Document
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-ink/60 border-b border-gray-100">
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">Number</th>
                    <th className="px-6 py-3 font-medium">Client</th>
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 font-medium text-right">Amount</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invoices.map((invoice: Invoice) => (
                    <tr
                      key={invoice.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                            documentTypeColors[invoice.documentType as DocumentType]
                          }`}
                        >
                          {documentTypeLabels[invoice.documentType as DocumentType]}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-ink">
                        {invoice.invoiceNumber}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-ink font-medium">{invoice.toName}</p>
                        {invoice.toEmail && (
                          <p className="text-ink/60 text-sm">{invoice.toEmail}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-ink/80 text-sm">
                        {formatDate(invoice.issueDate)}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-ink">
                        {formatCurrency(invoice.total, invoice.currency)}
                      </td>
                      <td className="px-6 py-4">
                        {invoice.isPaid ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {invoices.map((invoice: Invoice) => (
                <div key={invoice.id} className="p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            documentTypeColors[invoice.documentType as DocumentType]
                          }`}
                        >
                          {documentTypeLabels[invoice.documentType as DocumentType]}
                        </span>
                        {invoice.isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <span className="w-1 h-1 bg-green-500 rounded-full"></span>
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            <span className="w-1 h-1 bg-amber-500 rounded-full"></span>
                            Pending
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-ink font-medium truncate">{invoice.toName}</p>
                      <p className="text-xs text-ink/50 font-mono mt-0.5">{invoice.invoiceNumber}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-ink">
                        {formatCurrency(invoice.total, invoice.currency)}
                      </p>
                      <p className="text-xs text-ink/50 mt-1">
                        {formatDate(invoice.issueDate)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
