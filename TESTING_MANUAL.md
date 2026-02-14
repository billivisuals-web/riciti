# Riciti — Comprehensive Testing Manual

> **Version**: 1.0  
> **Date**: 2026-02-13  
> **System**: Riciti Invoice & Receipt Generator  
> **Stack**: Next.js 14, Supabase, M-Pesa Daraja API, Zustand, Zod, TailwindCSS

---

## Table of Contents

1. [Prerequisites & Environment Setup](#1-prerequisites--environment-setup)
2. [Module 1 — Health Check & Infrastructure](#2-module-1--health-check--infrastructure)
3. [Module 2 — Authentication Flow](#3-module-2--authentication-flow)
4. [Module 3 — Guest Session Management](#4-module-3--guest-session-management)
5. [Module 4 — Invoice Creation (UI)](#5-module-4--invoice-creation-ui)
6. [Module 5 — Invoice CRUD API](#6-module-5--invoice-crud-api)
7. [Module 6 — Public Invoice Sharing](#7-module-6--public-invoice-sharing)
8. [Module 7 — M-Pesa Payment Flow](#8-module-7--mpesa-payment-flow)
9. [Module 8 — Dashboard](#9-module-8--dashboard)
10. [Module 9 — Security Testing](#10-module-9--security-testing)
11. [Module 10 — Rate Limiting](#11-module-10--rate-limiting)
12. [Module 11 — Data Integrity & Edge Cases](#12-module-11--data-integrity--edge-cases)
13. [Module 12 — Print & Export](#13-module-12--print--export)
14. [Module 13 — Responsive Design & Cross-Browser](#14-module-13--responsive-design--cross-browser)
15. [Module 14 — Error Handling & Resilience](#15-module-14--error-handling--resilience)
16. [Module 15 — Deployment & Production Readiness](#16-module-15--deployment--production-readiness)
17. [Quick Reference — API Endpoints](#17-quick-reference--api-endpoints)
18. [Quick Reference — Rate Limits](#18-quick-reference--rate-limits)
19. [Test Result Tracking Template](#19-test-result-tracking-template)

---

## 1. Prerequisites & Environment Setup

### 1.1 Required Environment Variables

Before testing, verify all environment variables are configured:

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Supabase service role key (bypasses RLS) |
| `MPESA_CONSUMER_KEY` | Conditional* | Safaricom Daraja consumer key |
| `MPESA_CONSUMER_SECRET` | Conditional* | Safaricom Daraja consumer secret |
| `MPESA_PASSKEY` | Conditional* | Lipa na M-Pesa passkey |
| `MPESA_SHORTCODE` | Conditional* | M-Pesa business shortcode |
| `MPESA_ENVIRONMENT` | Optional | `sandbox` or `production` |
| `MPESA_CALLBACK_SECRET` | Recommended | Callback URL secret token |
| `UPSTASH_REDIS_REST_URL` | Recommended | Distributed rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Recommended | Distributed rate limiting |

> \* Required when M-Pesa payments are enabled (any M-Pesa env var is set).

### 1.2 Startup Validation

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 1.2.1 | Env validation on startup | Start the app (`npm run dev`) | Console shows validation results; no missing required vars | |
| 1.2.2 | Missing required var | Remove `SUPABASE_SERVICE_ROLE_KEY`, start app | Startup fails with descriptive error listing missing var | |
| 1.2.3 | Missing M-Pesa vars | Set `MPESA_ENVIRONMENT=sandbox` but omit `MPESA_CONSUMER_KEY` | Error lists all missing M-Pesa vars | |
| 1.2.4 | Recommended var warnings | Remove `MPESA_CALLBACK_SECRET` | Console warns but app starts successfully | |

### 1.3 Database Setup

Verify all SQL migrations have been applied in order:

| # | Migration | Verify |
|---|-----------|--------|
| 1.3.1 | `001_initial_schema.sql` | Tables exist: `users`, `invoices`, `line_items`, `invoice_photos`, `payments` |
| 1.3.2 | `002_storage_buckets.sql` | Storage bucket `invoices` exists with 512KB limit |
| 1.3.3 | `003_security_and_scale.sql` | RPC functions exist: `get_dashboard_stats`, `create_payment_if_unpaid` |
| 1.3.4 | `004_security_hardening.sql` | Function `expire_stale_payments` exists; guest RLS policies active |

---

## 2. Module 1 — Health Check & Infrastructure

### Endpoint: `GET /api/health`

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 2.1 | Health check — DB connected | `curl http://localhost:3000/api/health` | `200`: `{ ok: true, timestamp: "...", db: "connected" }` | |
| 2.2 | Health check — DB unreachable | Stop Supabase / use invalid URL, hit health endpoint | `503`: `{ ok: false, timestamp: "...", db: "unreachable" }` | |
| 2.3 | Cache headers | Check response headers | `Cache-Control: no-store` | |
| 2.4 | Railway health check | Deploy to Railway, check health check logs | Successful pings every 30s at `/api/health` | |

---

## 3. Module 2 — Authentication Flow

### 3.1 Google OAuth Login

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 3.1.1 | Login page renders | Navigate to `/login` | Shows Google sign-in button, signup link, "continue without account" link | |
| 3.1.2 | Signup page renders | Navigate to `/signup` | Shows Google sign-in button, feature benefits list, login link | |
| 3.1.3 | Google OAuth redirect | Click "Sign in with Google" | Redirects to Google consent screen with correct redirect URI | |
| 3.1.4 | Successful auth callback | Complete Google sign-in | Redirected to `/dashboard`; user record created in `users` table | |
| 3.1.5 | Returning user login | Sign in with previously used account | User record updated (not duplicated); redirected to `/dashboard` | |
| 3.1.6 | Auth error handling | Cancel Google consent | Redirected to `/login?error=...` with error message | |

### 3.2 Session Management

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 3.2.1 | Session persistence | Login, close browser, reopen `/dashboard` | Session persists; still authenticated | |
| 3.2.2 | Sign out | Click avatar → Sign Out | Redirected to home page; session cleared | |
| 3.2.3 | Protected route (unauthenticated) | Clear cookies, navigate to `/dashboard` | Redirected to `/login` | |
| 3.2.4 | Auth page (authenticated) | While logged in, navigate to `/login` | Redirected to `/dashboard` | |
| 3.2.5 | Auth page (authenticated) | While logged in, navigate to `/signup` | Redirected to `/dashboard` | |

### 3.3 Auth Navigation Component

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 3.3.1 | Anonymous state | Visit home page without logging in | Shows "Login" and "Sign up" links in header | |
| 3.3.2 | Authenticated state | Login, visit home page | Shows avatar/initials dropdown with Dashboard & Sign Out | |
| 3.3.3 | Real-time auth update | Sign in via another tab | AuthNav updates without page refresh (via `onAuthStateChange`) | |

---

## 4. Module 3 — Guest Session Management

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 4.1 | Guest session creation | Visit site anonymously, create invoice | `riciti_guest_session` cookie set (httpOnly, sameSite: lax) | |
| 4.2 | Guest session persistence | Create invoice, refresh page, list invoices | Same guest session; previous invoices visible | |
| 4.3 | Guest session expiry | Check cookie attributes | 30-day expiry | |
| 4.4 | Guest-to-user migration | Create invoices as guest → sign in with Google | All guest invoices now appear in authenticated dashboard | |
| 4.5 | Guest cookie cleanup | After migration, check cookies | `riciti_guest_session` cookie deleted | |
| 4.6 | Multiple guest sessions | Open in incognito → create invoice → open regular browser → create invoice | Each browser has separate guest session; invoices are isolated | |

---

## 5. Module 4 — Invoice Creation (UI)

### 5.1 Invoice Form Fields

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 5.1.1 | Default values | Open home page (new invoice) | Currency: KES, Tax: 16%, Terms: Net 7, Accent: #1f8ea3, 1 empty line item | |
| 5.1.2 | Document title | Change document title | Updates preview header | |
| 5.1.3 | Logo upload | Upload PNG/JPEG image (<500KB) | Logo appears in preview; stored as base64 data URL | |
| 5.1.4 | Logo size limit | Upload image >500KB | Rejected with size error | |
| 5.1.5 | From (Sender) fields | Fill: name, email, phone, mobile, fax, address, city, zip, business number | All fields reflected in preview | |
| 5.1.6 | To (Recipient) fields | Fill all recipient fields | All fields reflected in preview | |
| 5.1.7 | Invoice number | Leave blank | Auto-generated as `INV-YYYY-XXXXXXXXXX` on save | |
| 5.1.8 | Invoice number (custom) | Enter custom number (e.g., `RCT-001`) | Custom number preserved on save | |
| 5.1.9 | Issue date | Change issue date | Reflected in preview | |
| 5.1.10 | Payment terms | Select each option (Due on Receipt, Net 7/15/30/60) | Due date recalculated accordingly | |
| 5.1.11 | Notes field | Enter notes (up to 5000 chars) | Appears in preview footer | |
| 5.1.12 | Signature upload | Upload signature image | Appears in preview; stored as data URL | |
| 5.1.13 | Photo attachments | Upload 1+ photos | Photos displayed; can be removed | |

### 5.2 Line Items

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 5.2.1 | Add line item | Click "Add Item" | New empty row added | |
| 5.2.2 | Edit line item | Fill description, quantity, rate | Amount auto-calculated (qty × rate); subtotal updates | |
| 5.2.3 | Additional details | Expand item, add additional details | Saved and visible in preview | |
| 5.2.4 | Remove line item | Click remove on an item | Item removed; totals recalculated | |
| 5.2.5 | Multiple items | Add 5+ items with different rates/quantities | All items shown; subtotal is sum of all amounts | |
| 5.2.6 | Max items | Add 100 items | Allowed (schema max) | |
| 5.2.7 | Item over 100 | Try to add 101st item | Should be rejected on save (Zod validation: max 100 items) | |
| 5.2.8 | Zero quantity | Set quantity to 0 | Amount = 0; included in subtotal | |
| 5.2.9 | Desktop layout | View on desktop (>768px) | Grid/table layout for line items | |
| 5.2.10 | Mobile layout | View on mobile (<768px) | Card layout for line items | |

### 5.3 Options Sidebar

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 5.3.1 | Accent color picker | Select each of 12 colors | Preview updates accent color immediately | |
| 5.3.2 | Document type | Switch between Invoice, Receipt, Estimate, Quote | Document type label updates in preview | |
| 5.3.3 | Discount — percentage | Set discount type to Percentage, value to 10 | Discount = subtotal × 10%; total recalculated | |
| 5.3.4 | Discount — fixed | Set discount type to Fixed, value to 500 | Discount = 500; total recalculated | |
| 5.3.5 | Tax rate | Change tax rate to 0 | Tax amount = 0; total = subtotal - discount | |
| 5.3.6 | Tax rate | Change tax rate to 16 | Tax = subtotal × 16% | |
| 5.3.7 | Currency selector | Switch between KES, USD, EUR, GBP, TZS, UGX | Currency symbol updates in preview and totals | |
| 5.3.8 | Get Link button | Click "Get Link" | Invoice saved; shareable link generated with publicId | |
| 5.3.9 | Print button | Click "Print" | Switches to preview tab; triggers browser print dialog | |

### 5.4 Totals Calculation (Client-Side)

The formula is: **Total = Subtotal + Tax Amount - Discount Amount**

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 5.4.1 | Basic calculation | 2 items: (qty:2, rate:1000), (qty:1, rate:500). Tax: 16%, Discount: 0 | Subtotal: 2500, Tax: 400, Discount: 0, Total: 2900 | |
| 5.4.2 | With percentage discount | Same as above + 10% discount | Discount: 250, Total: 2650 | |
| 5.4.3 | With fixed discount | Same items + fixed discount of 300 | Discount: 300, Total: 2600 | |
| 5.4.4 | Zero tax | Same items, tax: 0%, no discount | Total: 2500 | |
| 5.4.5 | Client-server consistency | Create invoice via UI, verify API response totals | Client-calculated totals match server-calculated totals | |

---

## 6. Module 5 — Invoice CRUD API

### 6.1 Create Invoice — `POST /api/invoices`

**Required fields**: `fromName`, `toName`

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 6.1.1 | Minimal valid invoice | POST `{ "fromName": "Acme Ltd", "toName": "John Doe" }` | `201`: Invoice created with auto-generated invoiceNumber, dueDate (7 days), defaults | |
| 6.1.2 | Full invoice | POST with all fields + 3 line items | `201`: All fields persisted correctly; totals calculated server-side | |
| 6.1.3 | Missing `fromName` | POST `{ "toName": "John" }` | `400`: Validation error with field: "fromName" | |
| 6.1.4 | Missing `toName` | POST `{ "fromName": "Acme" }` | `400`: Validation error with field: "toName" | |
| 6.1.5 | `fromName` too long | POST with `fromName` = 201 chars | `400`: Validation error | |
| 6.1.6 | Invalid email format | POST with `fromEmail: "not-an-email"` | `400`: Invalid email format | |
| 6.1.7 | Invalid accent color | POST with `accentColor: "red"` | `400`: Must be hex format `#XXXXXX` | |
| 6.1.8 | Items — description too long | Item with description > 500 chars | `400`: Validation error | |
| 6.1.9 | Items — quantity out of range | Item with quantity = -1 or > 1,000,000 | `400`: Validation error | |
| 6.1.10 | Items — rate out of range | Item with rate > 1,000,000,000 | `400`: Validation error | |
| 6.1.11 | Too many items | 101 line items | `400`: Max 100 items | |
| 6.1.12 | Logo base64 too large | Send logo > 500KB base64 | `400`: Image size limit | |
| 6.1.13 | Logo as URL | Send `logoDataUrl: "https://example.com/logo.png"` | Stored as-is (URL passthrough) | |
| 6.1.14 | Document types | Test each: INVOICE, RECEIPT, ESTIMATE, QUOTE | All accepted and stored correctly (uppercased) | |
| 6.1.15 | Payment terms | Test each: DUE_ON_RECEIPT, NET_7, NET_15, NET_30, NET_60, CUSTOM | All accepted | |
| 6.1.16 | Currency values | Test: KES, USD, EUR, GBP | All accepted | |
| 6.1.17 | publicId generated | Check response | `publicId` is a unique non-null string | |
| 6.1.18 | Tenant context — authenticated | Create while logged in | Invoice has `userId` set | |
| 6.1.19 | Tenant context — guest | Create while anonymous | Invoice has `guestSessionId` set | |

### 6.2 List Invoices — `GET /api/invoices`

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 6.2.1 | Default pagination | GET `/api/invoices` | Returns up to 20 invoices, `total` count, `offset: 0` | |
| 6.2.2 | Custom pagination | GET `/api/invoices?limit=5&offset=10` | Returns 5 invoices starting from offset 10 | |
| 6.2.3 | Limit bounds | GET `/api/invoices?limit=0` or `limit=101` | `400`: Invalid limit (must be 1–100) | |
| 6.2.4 | Sort by createdAt | GET `/api/invoices?orderBy=createdAt&orderDir=desc` | Newest first | |
| 6.2.5 | Sort by dueDate | GET `/api/invoices?orderBy=dueDate&orderDir=asc` | Earliest due date first | |
| 6.2.6 | Tenant isolation | Login as User A, list invoices | Only User A's invoices returned (not User B's or guest's) | |
| 6.2.7 | Cache headers | Check response headers | `Cache-Control: private, max-age=10, stale-while-revalidate=30` | |
| 6.2.8 | Empty result | New user with no invoices | `{ invoices: [], total: 0, limit: 20, offset: 0 }` | |

### 6.3 Get Invoice — `GET /api/invoices/[id]`

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 6.3.1 | Valid invoice | GET with valid owned invoice ID | `200`: Full invoice with line items sorted by `sortOrder` | |
| 6.3.2 | Non-existent ID | GET with random ID | `404`: `{ error: "Invoice not found" }` | |
| 6.3.3 | Other user's invoice | GET with ID belonging to another user | `404`: Invoice not found (tenant isolation) | |
| 6.3.4 | Cache headers | Check response headers | `Cache-Control: private, max-age=5, stale-while-revalidate=15` | |

### 6.4 Update Invoice — `PUT /api/invoices/[id]`

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 6.4.1 | Update single field | PUT `{ "notes": "Updated note" }` | `200`: Only notes changed; other fields unchanged | |
| 6.4.2 | Update financials | PUT `{ "taxRate": 8 }` | `200`: Tax recalculated; total updated | |
| 6.4.3 | Replace line items | PUT `{ "items": [{ "description": "New Item", "quantity": 1, "rate": 100 }] }` | `200`: Old items deleted; new items inserted; totals recalculated | |
| 6.4.4 | Update non-owned invoice | PUT to another user's invoice | `404` | |
| 6.4.5 | All validation rules | Same validation as CREATE | Same error responses | |

### 6.5 Delete Invoice — `DELETE /api/invoices/[id]`

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 6.5.1 | Delete own invoice | DELETE valid owned ID | `200`: `{ success: true }` | |
| 6.5.2 | Cascade deletion | After delete, check line_items, invoice_photos, payments tables | All related records deleted | |
| 6.5.3 | Delete non-existent | DELETE random ID | `404` | |
| 6.5.4 | Delete other user's | DELETE another user's invoice ID | `404` | |

---

## 7. Module 6 — Public Invoice Sharing

### 7.1 Get Public Invoice — `GET /api/invoices/public/[publicId]`

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 7.1.1 | Valid publicId | GET with valid publicId | `200`: Invoice data (line items, totals, payment status) | |
| 7.1.2 | Sanitized response | Check response body | No `userId` or `guestSessionId` fields in response | |
| 7.1.3 | Non-existent publicId | GET with random string | `404`: `{ error: "Invoice not found" }` | |
| 7.1.4 | No auth needed | Call without any cookies/auth headers | `200`: Works without authentication | |
| 7.1.5 | Cache headers | Check response headers | `Cache-Control: public, max-age=60, stale-while-revalidate=300` | |

### 7.2 Payment Status — `GET /api/invoices/public/[publicId]/status`

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 7.2.1 | Unpaid invoice | GET status for unpaid invoice | `{ invoiceId, isPaid: false, paidAt: null, latestPayment: null }` | |
| 7.2.2 | Paid invoice | GET status after payment completion | `{ isPaid: true, paidAt: "...", latestPayment: { status: "COMPLETED", mpesaReceiptNumber: "..." } }` | |
| 7.2.3 | Pending payment | GET during active STK push | `{ isPaid: false, latestPayment: { status: "PROCESSING" } }` | |
| 7.2.4 | Cache headers | Check response headers | `Cache-Control: no-store` (for polling freshness) | |

---

## 8. Module 7 — M-Pesa Payment Flow

> **Important**: For sandbox testing, use Safaricom Daraja sandbox credentials and test phone numbers (e.g., `254708374149`).

### 8.1 Payment Initiation — `POST /api/payments/initiate`

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 8.1.1 | Valid payment request | POST `{ "publicId": "valid-id", "phoneNumber": "0712345678" }` | `200`: `{ success: true, checkoutRequestId, customerMessage, paymentId }` | |
| 8.1.2 | Phone normalization — 07XX | POST with `phoneNumber: "0712345678"` | Normalized to `254712345678` | |
| 8.1.3 | Phone normalization — +254 | POST with `phoneNumber: "+254712345678"` | Normalized to `254712345678` | |
| 8.1.4 | Phone normalization — 254 | POST with `phoneNumber: "254712345678"` | Accepted as-is | |
| 8.1.5 | Phone normalization — 7XX | POST with `phoneNumber: "712345678"` | Normalized to `254712345678` | |
| 8.1.6 | Phone normalization — 1XX | POST with `phoneNumber: "110123456"` | Normalized to `254110123456` | |
| 8.1.7 | Invalid phone | POST with `phoneNumber: "1234"` (too short) | `400`: Invalid phone number | |
| 8.1.8 | Missing publicId | POST `{ "phoneNumber": "0712345678" }` | `400`: Validation error | |
| 8.1.9 | Non-existent invoice | POST with random publicId | `404`: Invoice not found | |
| 8.1.10 | Already paid invoice | POST for an invoice already marked as paid | `400`: Invoice already paid | |
| 8.1.11 | Zero total invoice | POST for invoice with total = 0 | `400`: Invalid total | |
| 8.1.12 | Duplicate payment prevention | Send 2 rapid requests for same invoice | Second request gets `409`: Active payment in progress | |
| 8.1.13 | Atomic payment creation | Check DB after initiation | Payment created via `create_payment_if_unpaid` RPC with row lock | |

### 8.2 Payment Callback — `POST /api/payments/callback`

> This endpoint is called by Safaricom's servers after STK push completes.

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 8.2.1 | Successful payment | Simulate callback with ResultCode: 0 | Payment updated to COMPLETED; invoice marked as paid; receipt number stored | |
| 8.2.2 | Cancelled payment | Simulate callback with ResultCode: 1032 | Payment updated to CANCELLED | |
| 8.2.3 | Failed payment | Simulate callback with other ResultCode | Payment updated to FAILED | |
| 8.2.4 | Amount verification | Callback with different amount than invoice total | Payment marked as FAILED (amount mismatch) | |
| 8.2.5 | Idempotency — completed | Send same callback twice for COMPLETED payment | Second call skipped (no state change); still returns `200` | |
| 8.2.6 | Idempotency — failed | Send callback for already FAILED payment | Skipped; returns `200` | |
| 8.2.7 | Unknown checkoutRequestId | Callback with non-existent ID | Logged as warning; returns `200` (never return error to Safaricom) | |
| 8.2.8 | Always returns 200 | Any callback scenario | Always `{ ResultCode: 0, ResultDesc: "Accepted" }` | |
| 8.2.9 | Transaction date parsing | Callback with `TransactionDate: "20260213143052"` | Parsed to ISO date correctly | |
| 8.2.10 | Secret token verification | Send callback without correct `?secret=` param | Logged as warning (defense-in-depth); request still processed | |

### 8.3 Payment Query — `POST /api/payments/query`

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 8.3.1 | Query completed payment | POST `{ "checkoutRequestId": "..." }` for completed tx | `200`: `{ status: "COMPLETED", mpesaReceiptNumber: "..." }` | |
| 8.3.2 | Query pending payment | Query while user hasn't responded to STK | `200`: `{ status: "PROCESSING" }` | |
| 8.3.3 | Query cancelled payment | Query after user cancelled STK | `200`: `{ status: "CANCELLED" }` | |
| 8.3.4 | Race condition prevention | Already COMPLETED payment, query returns different status | DB not updated (conditional update: NOT IN terminal states) | |
| 8.3.5 | Invalid checkoutRequestId | POST with random ID | Error response from Daraja API forwarded | |

### 8.4 Payment Modal (UI)

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 8.4.1 | Modal opens | Click "Request Payment" on invoice | Modal opens with phone input (defaults to +254) | |
| 8.4.2 | Enter phone number | Type phone number | Input accepts and formats number | |
| 8.4.3 | Submit STK push | Enter valid phone, click "Send Payment Request" | State: submitting → polling; shows "Check your phone" message | |
| 8.4.4 | Successful payment | Complete M-Pesa PIN entry on phone | Modal shows success state with receipt number | |
| 8.4.5 | Polling behavior | Monitor network tab during polling | Exponential backoff: starts at 5s, doubles to max 20s, up to 12 polls (~90s) | |
| 8.4.6 | Payment timeout | Don't respond to STK push for 90s | Modal shows timeout state with "Check Status" button | |
| 8.4.7 | Manual status check | Click "Check Status" after timeout | Calls `POST /api/payments/query`; updates modal state | |
| 8.4.8 | Cancel payment | Cancel STK push on phone | Modal shows cancelled state | |
| 8.4.9 | Close modal | Click X or outside modal | Modal closes; state resets | |

### 8.5 Stale Payment Cleanup

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 8.5.1 | Expire stale payments | Create PENDING payment, wait >30 min (or manually invoke `expire_stale_payments()`) | Payment status changed to FAILED with `result_desc: "Payment expired..."` | |
| 8.5.2 | Don't expire completed | COMPLETED payment older than 30 min | Status unchanged | |

---

## 9. Module 8 — Dashboard

### 9.1 Dashboard Access

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 9.1.1 | Authenticated access | Login, navigate to `/dashboard` | Dashboard loads with stats and invoices | |
| 9.1.2 | Unauthenticated access | Clear session, navigate to `/dashboard` | Redirected to `/login` | |
| 9.1.3 | Loading state | Navigate to dashboard (first load) | Shows loading skeleton/spinner | |

### 9.2 Statistics Cards

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 9.2.1 | Total Documents | Create 3 invoices | Shows "3" in Total Documents card | |
| 9.2.2 | Paid count | Mark 1 invoice as paid | Paid card shows "1" | |
| 9.2.3 | Pending count | 2 unpaid invoices | Pending card shows "2" | |
| 9.2.4 | Total Value | Invoices totaling KES 15,000 | Total Value card shows KES 15,000 | |
| 9.2.5 | Empty state | New user, no invoices | Shows empty state with "Create your first document" CTA | |

### 9.3 Recent Documents

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 9.3.1 | Table view (desktop) | View on desktop | Table with columns: document info, type, amount, status, date | |
| 9.3.2 | Card view (mobile) | View on mobile | Card layout for each document | |
| 9.3.3 | Type badges | Create Invoice, Receipt, Estimate | Each shows correct type badge | |
| 9.3.4 | Payment status | Mix of paid/unpaid invoices | Paid shows green indicator; unpaid shows pending indicator | |
| 9.3.5 | Pagination | Create >20 invoices | Only 20 shown (server-side limit) | |

### 9.4 User Navigation

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 9.4.1 | Avatar display | User with Google avatar | Shows Google profile picture | |
| 9.4.2 | Initials fallback | User without avatar | Shows initials | |
| 9.4.3 | Navigation links | Click dropdown | Shows: Dashboard, New Document, Sign Out | |
| 9.4.4 | New Document | Click "New Document" | Navigates to home page (invoice editor) | |

---

## 10. Module 9 — Security Testing

### 10.1 CSRF Protection

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 10.1.1 | Valid Origin | POST `/api/invoices` with matching Origin header | Request succeeds | |
| 10.1.2 | Mismatched Origin | POST with `Origin: https://evil.com` | `403`: CSRF error (production) | |
| 10.1.3 | Missing Origin (dev) | POST without Origin header in dev mode | Request allowed | |
| 10.1.4 | Missing Origin (prod) | POST without Origin header in production | Request blocked | |
| 10.1.5 | Safe methods exempt | GET/HEAD/OPTIONS with any Origin | Not blocked by CSRF | |
| 10.1.6 | Callback exempt | POST `/api/payments/callback` without Origin | Not blocked (Safaricom exemption) | |

### 10.2 Open Redirect Prevention

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 10.2.1 | Valid redirect | Auth callback with `?next=/dashboard` | Redirects to `/dashboard` | |
| 10.2.2 | Absolute URL blocked | Auth callback with `?next=https://evil.com` | Redirects to `/dashboard` (default, not evil.com) | |
| 10.2.3 | Protocol-relative blocked | Auth callback with `?next=//evil.com` | Redirects to `/dashboard` (blocked) | |
| 10.2.4 | No `next` param | Auth callback without `next` | Redirects to `/dashboard` | |

### 10.3 Tenant Isolation

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 10.3.1 | User A can't see User B data | Login as User A → GET User B's invoice ID | `404` (not 403 — no information leak) | |
| 10.3.2 | User can't update other's invoice | PUT to another user's invoice ID | `404` | |
| 10.3.3 | User can't delete other's invoice | DELETE another user's invoice ID | `404` | |
| 10.3.4 | Guest can't see user invoices | As guest, try to access authenticated user's invoice | `404` | |
| 10.3.5 | RLS enforcement | Direct Supabase query (anon key) for another user's data | Blocked by RLS | |

### 10.4 Image Upload Security

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 10.4.1 | Valid image upload | Upload PNG < 500KB as base64 | Uploaded to Supabase Storage; public URL returned | |
| 10.4.2 | Oversized image | Upload >500KB image | Rejected at API level | |
| 10.4.3 | SSRF prevention — http:// | Send `logoDataUrl: "http://internal-server/secret"` | Rejected (only https:// allowed) | |
| 10.4.4 | HTTPS URL passthrough | Send `logoDataUrl: "https://example.com/logo.png"` | Accepted as-is; no server-side fetch | |
| 10.4.5 | Invalid data URL | Send `logoDataUrl: "data:text/html;base64,..."` | Rejected (only image MIME types) | |
| 10.4.6 | Allowed MIME types | Upload PNG, JPEG, GIF, WebP, SVG | All accepted | |

### 10.5 Security Headers

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 10.5.1 | HSTS | Check response headers | `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` | |
| 10.5.2 | Content-Type nosniff | Check response headers | `X-Content-Type-Options: nosniff` | |
| 10.5.3 | Frame denial | Check response headers | `X-Frame-Options: DENY` | |
| 10.5.4 | Referrer Policy | Check response headers | `Referrer-Policy: strict-origin-when-cross-origin` | |
| 10.5.5 | Permissions Policy | Check response headers | Camera, microphone, geolocation disabled | |
| 10.5.6 | CSP | Check Content-Security-Policy | Restricts scripts, connects, frames | |

### 10.6 M-Pesa Callback Security

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 10.6.1 | Valid callback token | POST callback with correct `?secret=` | Processed normally | |
| 10.6.2 | Invalid callback token | POST callback with wrong secret | Logged as warning; still processed (defense-in-depth) | |
| 10.6.3 | IP whitelist (prod) | POST from non-Safaricom IP in production | Blocked (6 whitelisted Safaricom IPs) | |
| 10.6.4 | IP whitelist (dev) | POST from any IP in development | Allowed | |

---

## 11. Module 10 — Rate Limiting

### Rate Limit Configuration

| Limiter | Max Requests | Window | Endpoints |
|---------|-------------|--------|-----------|
| `paymentLimiter` | 5 | 60s | `POST /api/payments/initiate` |
| `invoiceCreateLimiter` | 30 | 60s | `POST /api/invoices` |
| `publicReadLimiter` | 60 | 60s | Public invoice endpoints, payment query |
| `privateCrudLimiter` | 120 | 60s | Authenticated CRUD operations |

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 11.1 | Payment rate limit | Send 6 rapid requests to `POST /api/payments/initiate` | 6th request: `429` with `Retry-After` header | |
| 11.2 | Invoice create limit | Send 31 rapid POST requests to `/api/invoices` | 31st request: `429` | |
| 11.3 | Public read limit | Send 61 rapid GET requests to public endpoint | 61st: `429` | |
| 11.4 | Private CRUD limit | Send 121 rapid GET requests to `/api/invoices` | 121st: `429` | |
| 11.5 | Rate limit recovery | Wait 60s after hitting limit | Requests succeed again | |
| 11.6 | Retry-After header | Check 429 response headers | `Retry-After` header present with seconds | |
| 11.7 | IP-based limiting | Same endpoint from 2 different IPs | Each IP has independent limits | |
| 11.8 | Redis backend (if configured) | With Upstash Redis configured | Rate limiting works across multiple server instances | |
| 11.9 | In-memory fallback | Without Redis | Rate limiting still works (single instance) | |
| 11.10 | Fail-open on Redis error | Redis down but configured | Requests allowed (fail-open policy) | |
| 11.11 | X-Forwarded-For spoofing | Set `X-Forwarded-For: spoofed-ip, real-ip` | Uses rightmost IP (real-ip), not spoofed | |

---

## 12. Module 11 — Data Integrity & Edge Cases

### 12.1 Monetary Precision

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 12.1.1 | Decimal precision | Create invoice with rate 33.33, qty 3 | Uses NUMERIC(15,2); no floating-point errors | |
| 12.1.2 | Large amounts | Invoice with total = 999,999,999.99 | Stored and displayed correctly | |
| 12.1.3 | Zero amount invoice | All items with rate 0 | Total = 0; invoice saved successfully | |
| 12.1.4 | M-Pesa rounding | Amount 1500.50 in STK push | Rounded up to 1501 (M-Pesa doesn't accept decimals) | |

### 12.2 Concurrent Operations

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 12.2.1 | Concurrent payment initiation | 2 simultaneous POST to `/api/payments/initiate` for same invoice | Only 1 succeeds; other gets `409` (FOR UPDATE lock) | |
| 12.2.2 | Callback + query race | Callback and query arrive simultaneously for same payment | Only one updates payment (conditional update: NOT IN terminal states) | |
| 12.2.3 | Concurrent invoice updates | 2 PUT requests for same invoice simultaneously | Both succeed but last-write-wins (no optimistic locking) | |

### 12.3 Invoice Number Uniqueness

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 12.3.1 | Auto-generated uniqueness | Create 10 invoices rapidly | All have unique invoice numbers (CUID2-based) | |
| 12.3.2 | Custom duplicate (same user) | Create 2 invoices with same custom number | Second one rejected (unique per user constraint) | |
| 12.3.3 | Custom same number (diff users) | User A and User B use same invoice number | Both succeed (uniqueness is per-user) | |

### 12.4 Cascade Deletion

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 12.4.1 | Delete invoice with items | Delete invoice that has 5 line items | All 5 line items deleted | |
| 12.4.2 | Delete invoice with photos | Delete invoice that has photos | All photos deleted | |
| 12.4.3 | Delete invoice with payments | Delete invoice that has payment records | All payment records deleted | |
| 12.4.4 | Delete user cascade | Delete user record | All their invoices (and cascading children) deleted | |

### 12.5 Guest-to-User Migration

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 12.5.1 | Migration with invoices | Create 3 invoices as guest → sign in | All 3 invoices appear in dashboard; `userId` updated | |
| 12.5.2 | Migration with empty session | No guest invoices → sign in | Sign in succeeds; no errors | |
| 12.5.3 | Line items preserved | Guest invoice with items → sign in | Line items still attached to migrated invoice | |
| 12.5.4 | publicId preserved | Guest invoice with publicId → sign in | Public link still works after migration | |

---

## 13. Module 12 — Print & Export

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 13.1 | Print trigger | Click "Print" button | Browser print dialog opens | |
| 13.2 | Print layout | Check print preview | Only invoice preview shown (form/sidebar hidden via `print-hide` CSS) | |
| 13.3 | Print area | Check print preview | Invoice fills the page correctly via `print-area` CSS | |
| 13.4 | Preview tab switch | Click Print from Edit tab | Switches to Preview tab first, then triggers print | |
| 13.5 | Accent color in print | Set custom accent color → print | Color preserved in print output | |
| 13.6 | Logo in print | Upload logo → print | Logo visible in printed output | |
| 13.7 | All items printed | Invoice with 20 items → print | All items visible (multi-page if needed) | |

---

## 14. Module 13 — Responsive Design & Cross-Browser

### 14.1 Responsive Breakpoints

| # | Test Case | Viewport | Expected Result | Pass/Fail |
|---|-----------|----------|-----------------|-----------|
| 14.1.1 | Mobile | 375px (iPhone SE) | Single column; bottom bar for options; card layout for items | |
| 14.1.2 | Tablet | 768px (iPad) | Transitional layout; sidebar may collapse | |
| 14.1.3 | Desktop | 1280px+ | Two-column (form + preview); right sidebar for options | |
| 14.1.4 | Dashboard — mobile | 375px | Card layout for invoices; stacked stats | |
| 14.1.5 | Dashboard — desktop | 1280px+ | Table layout for invoices; row of stats cards | |

### 14.2 Tab Navigation (InvoiceEditor)

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 14.2.1 | Edit tab | Click "Edit" tab | Shows InvoiceForm | |
| 14.2.2 | Preview tab | Click "Preview" tab | Shows InvoicePreview | |
| 14.2.3 | Tab state persistence | Switch tabs back and forth | Form data preserved (Zustand state) | |

### 14.3 Cross-Browser Testing

| # | Browser | Key Areas to Verify | Pass/Fail |
|---|---------|-------------------|-----------|
| 14.3.1 | Chrome (latest) | All features, print, file uploads | |
| 14.3.2 | Firefox (latest) | All features, print, file uploads | |
| 14.3.3 | Safari (latest) | All features, date inputs, print | |
| 14.3.4 | Edge (latest) | All features, print | |
| 14.3.5 | Mobile Safari (iOS) | Touch interactions, file uploads, responsive layout | |
| 14.3.6 | Mobile Chrome (Android) | Touch interactions, file uploads, responsive layout | |

---

## 15. Module 14 — Error Handling & Resilience

### 15.1 Error Boundaries

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 15.1.1 | Global error | Trigger unhandled error on home page | Error boundary shows "Something went wrong" with retry button | |
| 15.1.2 | Auth error | Trigger error on login page | Auth error boundary shows error with retry | |
| 15.1.3 | Dashboard error | Trigger error on dashboard | Dashboard error boundary shows error with retry | |
| 15.1.4 | 404 page | Navigate to `/nonexistent-route` | Custom 404 page with link home | |
| 15.1.5 | Retry button | Click "Try again" on error boundary | Page re-renders; error clears if underlying issue resolved | |

### 15.2 Network Error Handling

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 15.2.1 | API timeout | Simulate slow network on invoice save | Appropriate error shown; no data corruption | |
| 15.2.2 | Supabase down | Make Supabase unreachable | Health check returns 503; API calls return 500 with message | |
| 15.2.3 | M-Pesa API down | Safaricom API unreachable | Payment initiation fails gracefully with error message | |
| 15.2.4 | M-Pesa token retry | Token fetch fails once | Retries with exponential backoff (2 retries, 500ms base) | |

### 15.3 Validation Error Display

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 15.3.1 | Missing required field | Submit invoice without `fromName` | Clear error message indicating the missing field | |
| 15.3.2 | Field-level errors | Invalid email format | Error includes `field` property for UI highlighting | |
| 15.3.3 | Multiple errors | Multiple validation failures | First error returned with clear description | |

---

## 16. Module 15 — Deployment & Production Readiness

### 16.1 Docker Build

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 16.1.1 | Docker build | `docker build -t riciti .` | Builds successfully (multi-stage: deps → builder → runner) | |
| 16.1.2 | Docker run | `docker run -p 3000:3000 riciti` | App starts; accessible on port 3000 | |
| 16.1.3 | Non-root user | Check process user inside container | Running as `nextjs` user (not root) | |
| 16.1.4 | Standalone output | Check container image size | ~30MB (not ~200MB) | |
| 16.1.5 | Memory limit | Check Node.js heap | Constrained to 448MB (`--max-old-space-size=448`) | |

### 16.2 Production Checks

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 16.2.1 | Build succeeds | `npm run build` | No build errors | |
| 16.2.2 | Lint passes | `npm run lint` | No lint errors | |
| 16.2.3 | TypeScript | `npx tsc --noEmit` | No type errors | |
| 16.2.4 | Env validation (prod) | Set `NODE_ENV=production`, start | Extra production checks run (callback secret, sandbox warnings) | |
| 16.2.5 | Railway deploy | Push to main branch | Railway auto-deploys; health check passes | |

### 16.3 Railway Configuration

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 16.3.1 | Health check | Deploy to Railway | Health endpoint polled every 30s; deploy marked healthy | |
| 16.3.2 | Restart policy | Kill the process | Restarts automatically (ON_FAILURE, max 5 retries) | |

---

## 17. Quick Reference — API Endpoints

| Method | Endpoint | Auth | Rate Limit | Purpose |
|--------|----------|------|------------|---------|
| GET | `/api/health` | None | None | Health check |
| GET | `/api/invoices` | Tenant | 120/min | List invoices |
| POST | `/api/invoices` | Tenant | 30/min | Create invoice |
| GET | `/api/invoices/[id]` | Tenant | 120/min | Get invoice |
| PUT | `/api/invoices/[id]` | Tenant | 120/min | Update invoice |
| DELETE | `/api/invoices/[id]` | Tenant | 120/min | Delete invoice |
| GET | `/api/invoices/public/[publicId]` | None | 60/min | Get public invoice |
| GET | `/api/invoices/public/[publicId]/status` | None | 60/min | Payment status |
| POST | `/api/payments/initiate` | None | 5/min | Initiate M-Pesa STK |
| POST | `/api/payments/callback` | None* | None | M-Pesa callback |
| POST | `/api/payments/query` | None | 60/min | Query payment status |
| GET | `/auth/callback` | None | None | OAuth callback |

> \* Secured via IP whitelist (production) and secret token.

---

## 18. Quick Reference — Rate Limits

| Limiter | Tokens | Window | Backend |
|---------|--------|--------|---------|
| Payment | 5 | 60s | Redis or in-memory |
| Invoice Create | 30 | 60s | Redis or in-memory |
| Public Read | 60 | 60s | Redis or in-memory |
| Private CRUD | 120 | 60s | Redis or in-memory |

**In-memory cleanup**: GC every 5 minutes; stale after 10 minutes; hard cap 10,000 buckets.  
**IP extraction**: Uses rightmost IP from `X-Forwarded-For` header to prevent spoofing.

---

## 19. Test Result Tracking Template

Use this template to track your testing progress:

```
Date: ___________
Tester: ___________
Environment: [ ] Development  [ ] Staging  [ ] Production
Branch/Commit: ___________

Module                          | Total | Passed | Failed | Blocked | Notes
-------------------------------|-------|--------|--------|---------|------
1. Health Check                |   4   |        |        |         |
2. Authentication              |  11   |        |        |         |
3. Guest Sessions              |   6   |        |        |         |
4. Invoice Creation (UI)       |  30   |        |        |         |
5. Invoice CRUD API            |  30   |        |        |         |
6. Public Invoice Sharing      |   9   |        |        |         |
7. M-Pesa Payment Flow        |  27   |        |        |         |
8. Dashboard                   |  13   |        |        |         |
9. Security Testing            |  20   |        |        |         |
10. Rate Limiting              |  11   |        |        |         |
11. Data Integrity             |  17   |        |        |         |
12. Print & Export             |   7   |        |        |         |
13. Responsive & Cross-Browser |  11   |        |        |         |
14. Error Handling             |   8   |        |        |         |
15. Deployment                 |   8   |        |        |         |
-------------------------------|-------|--------|--------|---------|------
TOTAL                          | 212   |        |        |         |
```

### Severity Definitions

| Severity | Definition | Action |
|----------|-----------|--------|
| **Critical** | System crash, data loss, payment errors, security breach | Must fix before release |
| **High** | Feature broken, major UX issue, incorrect calculations | Must fix before release |
| **Medium** | Minor feature issue, cosmetic bug, edge case | Fix in next sprint |
| **Low** | Enhancement, nice-to-have, trivial cosmetic issue | Backlog |

### Bug Report Template

```
ID: BUG-XXX
Title: [Short description]
Module: [Module number and name]
Test Case: [Test case ID, e.g., 8.1.12]
Severity: [Critical / High / Medium / Low]
Environment: [Dev / Staging / Prod]
Steps to Reproduce:
  1. ...
  2. ...
  3. ...
Expected Result: ...
Actual Result: ...
Screenshots/Logs: [Attach]
```

---

*End of Testing Manual*
