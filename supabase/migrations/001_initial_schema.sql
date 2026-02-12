-- Riciti Invoice Generator - Supabase SQL Migration
-- Run this in your Supabase SQL Editor to create all tables

-- ============================================================================
-- ENUMS (using text with check constraints for better Supabase compatibility)
-- ============================================================================

-- ============================================================================
-- USERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  
  -- Auth provider info
  external_id TEXT UNIQUE,
  provider TEXT,
  
  -- Business defaults
  business_name TEXT,
  business_email TEXT,
  business_phone TEXT,
  business_address TEXT,
  business_city TEXT,
  business_zip_code TEXT,
  business_number TEXT,
  default_currency TEXT DEFAULT 'KES',
  default_tax_rate FLOAT DEFAULT 16,
  logo_url TEXT,
  signature_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_external_id ON users(external_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  
  -- Multi-tenancy
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  guest_session_id TEXT,
  
  -- Access control
  public_id TEXT UNIQUE NOT NULL,
  
  -- Document metadata
  document_type TEXT DEFAULT 'INVOICE' CHECK (document_type IN ('INVOICE', 'RECEIPT', 'ESTIMATE', 'QUOTE')),
  document_title TEXT DEFAULT 'Invoice',
  invoice_number TEXT NOT NULL,
  issue_date TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ NOT NULL,
  payment_terms TEXT DEFAULT 'NET_7' CHECK (payment_terms IN ('DUE_ON_RECEIPT', 'NET_7', 'NET_15', 'NET_30', 'NET_60', 'CUSTOM')),
  
  -- Sender (From)
  from_name TEXT NOT NULL,
  from_email TEXT,
  from_phone TEXT,
  from_mobile TEXT,
  from_fax TEXT,
  from_address TEXT,
  from_city TEXT,
  from_zip_code TEXT,
  from_business_number TEXT,
  
  -- Recipient (Bill To)
  to_name TEXT NOT NULL,
  to_email TEXT,
  to_phone TEXT,
  to_mobile TEXT,
  to_fax TEXT,
  to_address TEXT,
  to_city TEXT,
  to_zip_code TEXT,
  to_business_number TEXT,
  
  -- Financials
  currency TEXT DEFAULT 'KES',
  tax_rate FLOAT DEFAULT 16,
  discount_type TEXT DEFAULT 'PERCENTAGE' CHECK (discount_type IN ('PERCENTAGE', 'FIXED')),
  discount_value FLOAT DEFAULT 0,
  subtotal FLOAT DEFAULT 0,
  tax_amount FLOAT DEFAULT 0,
  discount_amount FLOAT DEFAULT 0,
  total FLOAT DEFAULT 0,
  
  -- Customization
  accent_color TEXT DEFAULT '#1f8ea3',
  logo_data_url TEXT,
  signature_data_url TEXT,
  notes TEXT,
  
  -- Payment status
  is_paid BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_guest_session_id ON invoices(guest_session_id);
CREATE INDEX IF NOT EXISTS idx_invoices_public_id ON invoices(public_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_created ON invoices(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_guest_created ON invoices(guest_session_id, created_at DESC);

-- ============================================================================
-- LINE ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS line_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  
  description TEXT NOT NULL,
  additional_details TEXT,
  quantity FLOAT DEFAULT 1,
  rate FLOAT DEFAULT 0,
  amount FLOAT DEFAULT 0,
  
  sort_order INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_line_items_invoice_id ON line_items(invoice_id);

-- ============================================================================
-- INVOICE PHOTOS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoice_photos (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  
  data_url TEXT NOT NULL,
  filename TEXT,
  
  sort_order INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_photos_invoice_id ON invoice_photos(invoice_id);

-- ============================================================================
-- PAYMENTS TABLE (M-Pesa transactions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  
  -- M-Pesa specific fields
  phone_number TEXT NOT NULL,
  amount FLOAT NOT NULL,
  currency TEXT DEFAULT 'KES',
  
  -- Daraja API fields
  merchant_request_id TEXT,
  checkout_request_id TEXT UNIQUE,
  mpesa_receipt_number TEXT,
  transaction_date TIMESTAMPTZ,
  
  -- Status tracking
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  result_code TEXT,
  result_desc TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_checkout_request_id ON payments(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_phone_number ON payments(phone_number);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - Enable for production
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (external_id = auth.uid()::text);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (external_id = auth.uid()::text);

-- Service role can do everything (for server-side operations)
CREATE POLICY "Service role full access to users" ON users
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to invoices" ON invoices
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to line_items" ON line_items
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to invoice_photos" ON invoice_photos
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to payments" ON payments
  FOR ALL USING (auth.role() = 'service_role');

-- Public access for shared invoices (via public_id)
CREATE POLICY "Public can read invoices by public_id" ON invoices
  FOR SELECT USING (public_id IS NOT NULL);

CREATE POLICY "Public can read line_items for public invoices" ON line_items
  FOR SELECT USING (
    invoice_id IN (SELECT id FROM invoices WHERE public_id IS NOT NULL)
  );
