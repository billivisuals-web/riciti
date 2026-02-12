"use client";

import { useState } from "react";
import InvoiceForm from "@/components/InvoiceForm";
import InvoicePreview from "@/components/InvoicePreview";
import OptionsSidebar from "@/components/OptionsSidebar";
import PaymentModal from "@/components/PaymentModal";
import { AuthNav } from "@/components/AuthNav";
import { useInvoiceStore } from "@/lib/store/invoiceStore";

export default function InvoiceEditor() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "edit">("edit");
  const isPaid = useInvoiceStore((state) => state.invoice.isPaid);
  const documentType = useInvoiceStore((state) => state.invoice.documentType);

  const handleGetLink = () => {
    // TODO: Generate shareable link
    alert("Get Link functionality coming soon!");
  };

  const handlePrint = () => {
    // Always switch to preview before printing so the invoice is
    // fully rendered (images loaded, layout calculated) — this is
    // more reliable across browsers than relying on hidden+print:block.
    if (activeTab !== "preview") {
      setActiveTab("preview");
      // Allow React to flush the state update and paint the preview
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.print();
        });
      });
    } else {
      window.print();
    }
  };

  return (
    <div className="min-h-screen pb-24 lg:pb-6 print:pb-0 print:min-h-0">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur print-hide">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-3">
          {/* Left side: Logo and document type */}
          <div className="flex items-center justify-between sm:justify-start gap-4 sm:gap-6">
            <h1 className="text-lg font-semibold text-ink">Riciti</h1>
            <nav className="flex items-center gap-2">
              <span className="rounded-full bg-lagoon/10 px-3 py-1 font-medium text-lagoon text-xs sm:text-sm">
                {documentType.charAt(0).toUpperCase() + documentType.slice(1)}
              </span>
              <div className="badge bg-ember/15 text-ember text-xs">
                {isPaid ? "Paid" : "Preview"}
              </div>
            </nav>
          </div>
          
          {/* Right side: Actions */}
          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
            {/* Edit/Preview Toggle */}
            <div className="flex rounded-full border border-slate-200 p-0.5 sm:p-1">
              <button
                type="button"
                className={`rounded-full px-3 sm:px-4 py-1.5 sm:py-1 text-xs font-semibold transition ${
                  activeTab === "preview"
                    ? "bg-ink text-white"
                    : "text-slate-500 hover:text-ink"
                }`}
                onClick={() => setActiveTab("preview")}
              >
                Preview
              </button>
              <button
                type="button"
                className={`rounded-full px-3 sm:px-4 py-1.5 sm:py-1 text-xs font-semibold transition ${
                  activeTab === "edit"
                    ? "bg-ink text-white"
                    : "text-slate-500 hover:text-ink"
                }`}
                onClick={() => setActiveTab("edit")}
              >
                Edit
              </button>
            </div>
            
            {/* Download PDF */}
            <button
              type="button"
              className="rounded-full bg-lagoon px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
              onClick={() => setIsModalOpen(true)}
            >
              <span className="hidden sm:inline">Download PDF</span>
              <span className="sm:hidden">PDF</span>
            </button>
            
            {/* Auth navigation */}
            <div className="hidden sm:block border-l border-slate-200 h-6 mx-1" />
            <div className="hidden sm:block">
              <AuthNav />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="grid gap-4 sm:gap-6 p-4 sm:p-6 lg:grid-cols-[1fr_280px]">
        {/* Editor / Preview Area */}
        <div className="space-y-4 sm:space-y-6">
          {activeTab === "edit" ? (
            <section className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-soft animate-fadeUp print-hide">
              <InvoiceForm />
            </section>
          ) : null}
          {/* Always render InvoicePreview for print, but visually toggle based on activeTab */}
          <section className={`animate-fadeUp ${activeTab === "preview" ? "" : "hidden"}`}>
            <InvoicePreview />
          </section>
        </div>

        {/* Right Sidebar - Desktop Only */}
        <aside className="hidden lg:block print-hide">
          <div className="sticky top-24 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
            <OptionsSidebar onGetLink={handleGetLink} onPrint={handlePrint} />
          </div>
        </aside>
      </main>

      {/* Mobile Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 px-4 py-3 lg:hidden print-hide" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
          <button
            type="button"
            className="flex-1 rounded-full bg-slate-100 px-4 py-3 text-sm font-semibold text-ink"
            onClick={handlePrint}
          >
            Print
          </button>
          <button
            type="button"
            className="flex-1 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white shadow-lg"
            onClick={() => setActiveTab(activeTab === "edit" ? "preview" : "edit")}
          >
            {activeTab === "edit" ? "Preview" : "Edit"}
          </button>
          <button
            type="button"
            className="flex-1 rounded-full bg-lagoon px-4 py-3 text-sm font-semibold text-white shadow-lg"
            onClick={() => setIsModalOpen(true)}
          >
            Get PDF
          </button>
        </div>
      </div>

      <div className="print-hide">
        {isModalOpen ? (
          <PaymentModal onClose={() => setIsModalOpen(false)} />
        ) : null}
      </div>
    </div>
  );
}
