-- ============================================================================
-- Migration 003: Security hardening & scalability improvements
-- Fixes: FLOAT→NUMERIC for money, RLS policies, missing indexes,
--        constraints, dashboard stats RPC, updated_at trigger
-- ============================================================================

-- ============================================================================
-- 1. FIX MONETARY COLUMNS: FLOAT → NUMERIC(15,2)
-- ============================================================================

-- Invoice
ALTER TABLE "Invoice" ALTER COLUMN "subtotal" TYPE NUMERIC(15,2) USING "subtotal"::NUMERIC(15,2);
ALTER TABLE "Invoice" ALTER COLUMN "taxAmount" TYPE NUMERIC(15,2) USING "taxAmount"::NUMERIC(15,2);
ALTER TABLE "Invoice" ALTER COLUMN "discountAmount" TYPE NUMERIC(15,2) USING "discountAmount"::NUMERIC(15,2);
ALTER TABLE "Invoice" ALTER COLUMN "total" TYPE NUMERIC(15,2) USING "total"::NUMERIC(15,2);
ALTER TABLE "Invoice" ALTER COLUMN "taxRate" TYPE NUMERIC(5,2) USING "taxRate"::NUMERIC(5,2);
ALTER TABLE "Invoice" ALTER COLUMN "discountValue" TYPE NUMERIC(15,2) USING "discountValue"::NUMERIC(15,2);

-- Line items
ALTER TABLE "LineItem" ALTER COLUMN "quantity" TYPE NUMERIC(12,4) USING "quantity"::NUMERIC(12,4);
ALTER TABLE "LineItem" ALTER COLUMN "rate" TYPE NUMERIC(15,2) USING "rate"::NUMERIC(15,2);
ALTER TABLE "LineItem" ALTER COLUMN "amount" TYPE NUMERIC(15,2) USING "amount"::NUMERIC(15,2);

-- Payments
ALTER TABLE "Payment" ALTER COLUMN "amount" TYPE NUMERIC(15,2) USING "amount"::NUMERIC(15,2);

-- ============================================================================
-- 2. ADD MISSING INDEXES FOR 15K+ INVOICES/MONTH
-- ============================================================================

-- Dashboard stats: filter by user + paid status
CREATE INDEX IF NOT EXISTS idx_invoice_user_paid ON "Invoice"("userId", "isPaid");

-- Invoice number lookup (per-user uniqueness)
CREATE INDEX IF NOT EXISTS idx_invoice_user_invoice_number ON "Invoice"("userId", "invoiceNumber");

-- Overdue invoice queries
CREATE INDEX IF NOT EXISTS idx_invoice_user_due_date ON "Invoice"("userId", "dueDate");

-- Payment lookups by invoice + time
CREATE INDEX IF NOT EXISTS idx_payment_invoice_created ON "Payment"("invoiceId", "createdAt" DESC);

-- ============================================================================
-- 3. ADD CONSTRAINTS
-- ============================================================================

-- Ensure every invoice belongs to either a user or guest session
ALTER TABLE "Invoice" ADD CONSTRAINT tenant_required
  CHECK ("userId" IS NOT NULL OR "guestSessionId" IS NOT NULL);

-- Unique invoice number per user (NULL userId excluded — guests can collide, that's fine)
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_unique_number_per_user
  ON "Invoice"("userId", "invoiceNumber") WHERE "userId" IS NOT NULL;

-- ============================================================================
-- 4. FIX RLS POLICIES
-- ============================================================================

-- Drop the overly permissive public SELECT policies
DROP POLICY IF EXISTS "Public can read invoices by public_id" ON "Invoice";
DROP POLICY IF EXISTS "Public can read line_items for public invoices" ON "LineItem";

-- Authenticated users can read their own invoices
CREATE POLICY "Users can read own invoices" ON "Invoice"
  FOR SELECT USING (
    "userId" IN (SELECT id FROM "User" WHERE "externalId" = auth.uid()::text)
  );

-- Authenticated users can insert their own invoices
CREATE POLICY "Users can insert own invoices" ON "Invoice"
  FOR INSERT WITH CHECK (
    "userId" IN (SELECT id FROM "User" WHERE "externalId" = auth.uid()::text)
  );

-- Authenticated users can update their own invoices
CREATE POLICY "Users can update own invoices" ON "Invoice"
  FOR UPDATE USING (
    "userId" IN (SELECT id FROM "User" WHERE "externalId" = auth.uid()::text)
  );

-- Authenticated users can delete their own invoices
CREATE POLICY "Users can delete own invoices" ON "Invoice"
  FOR DELETE USING (
    "userId" IN (SELECT id FROM "User" WHERE "externalId" = auth.uid()::text)
  );

-- Line items: users can manage line items on their own invoices
CREATE POLICY "Users can read own line_items" ON "LineItem"
  FOR SELECT USING (
    "invoiceId" IN (
      SELECT id FROM "Invoice" WHERE "userId" IN (
        SELECT id FROM "User" WHERE "externalId" = auth.uid()::text
      )
    )
  );

CREATE POLICY "Users can insert own line_items" ON "LineItem"
  FOR INSERT WITH CHECK (
    "invoiceId" IN (
      SELECT id FROM "Invoice" WHERE "userId" IN (
        SELECT id FROM "User" WHERE "externalId" = auth.uid()::text
      )
    )
  );

CREATE POLICY "Users can update own line_items" ON "LineItem"
  FOR UPDATE USING (
    "invoiceId" IN (
      SELECT id FROM "Invoice" WHERE "userId" IN (
        SELECT id FROM "User" WHERE "externalId" = auth.uid()::text
      )
    )
  );

CREATE POLICY "Users can delete own line_items" ON "LineItem"
  FOR DELETE USING (
    "invoiceId" IN (
      SELECT id FROM "Invoice" WHERE "userId" IN (
        SELECT id FROM "User" WHERE "externalId" = auth.uid()::text
      )
    )
  );

-- Invoice photos: same pattern
CREATE POLICY "Users can manage own photos" ON "InvoicePhoto"
  FOR ALL USING (
    "invoiceId" IN (
      SELECT id FROM "Invoice" WHERE "userId" IN (
        SELECT id FROM "User" WHERE "externalId" = auth.uid()::text
      )
    )
  );

-- ============================================================================
-- 5. DASHBOARD STATS RPC (server-side aggregation)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total', COUNT(*),
    'paid', COUNT(*) FILTER (WHERE "isPaid" = true),
    'pending', COUNT(*) FILTER (WHERE "isPaid" = false),
    'totalValue', COALESCE(SUM("total"), 0)
  ) INTO result
  FROM "Invoice"
  WHERE "userId" = p_user_id;

  RETURN result;
END;
$$;

-- ============================================================================
-- 6. AUTO-UPDATE updatedAt TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_invoice_updated_at') THEN
    CREATE TRIGGER trg_invoice_updated_at
      BEFORE UPDATE ON "Invoice"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_line_item_updated_at') THEN
    CREATE TRIGGER trg_line_item_updated_at
      BEFORE UPDATE ON "LineItem"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payment_updated_at') THEN
    CREATE TRIGGER trg_payment_updated_at
      BEFORE UPDATE ON "Payment"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_updated_at') THEN
    CREATE TRIGGER trg_user_updated_at
      BEFORE UPDATE ON "User"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

-- ============================================================================
-- 7. PAYMENT LOCKING FUNCTION (prevent double payments)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_payment_if_unpaid(
  p_id TEXT,
  p_invoice_id TEXT,
  p_user_id TEXT,
  p_phone_number TEXT,
  p_amount NUMERIC(15,2),
  p_currency TEXT DEFAULT 'KES'
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_paid BOOLEAN;
  v_active_count INT;
  result JSON;
BEGIN
  -- Lock the invoice row to prevent concurrent payment initiation
  SELECT "isPaid" INTO v_is_paid
  FROM "Invoice"
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_is_paid IS NULL THEN
    RETURN json_build_object('error', 'Invoice not found');
  END IF;

  IF v_is_paid THEN
    RETURN json_build_object('error', 'Invoice already paid');
  END IF;

  -- Check for active (non-terminal) payments
  SELECT COUNT(*) INTO v_active_count
  FROM "Payment"
  WHERE "invoiceId" = p_invoice_id
    AND status IN ('PENDING', 'PROCESSING');

  IF v_active_count > 0 THEN
    RETURN json_build_object('error', 'A payment is already in progress for this invoice');
  END IF;

  -- Create the payment record
  INSERT INTO "Payment" (id, "invoiceId", "userId", "phoneNumber", amount, currency, status, "createdAt", "updatedAt")
  VALUES (p_id, p_invoice_id, p_user_id, p_phone_number, p_amount, p_currency, 'PENDING', NOW(), NOW());

  SELECT json_build_object(
    'id', id,
    'invoiceId', "invoiceId",
    'userId', "userId",
    'phoneNumber', "phoneNumber",
    'amount', amount,
    'currency', currency,
    'status', status,
    'createdAt', "createdAt",
    'updatedAt', "updatedAt"
  ) INTO result
  FROM "Payment" WHERE id = p_id;

  RETURN result;
END;
$$;
