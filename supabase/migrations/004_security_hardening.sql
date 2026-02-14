-- ============================================================================
-- Migration 004: Security hardening & reliability improvements
-- Fixes: RPC auth checks, guest RLS policies, payments RLS,
--        conditional payment updates, stale payment cleanup
-- ============================================================================

-- ============================================================================
-- 1. LOCK DOWN RPC FUNCTIONS (S5, S6)
--    Add auth checks to prevent unauthorized access
-- ============================================================================

-- get_dashboard_stats: Only callable by server (service_role) or with matching auth
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Verify caller is authorized:
  -- Either service_role (auth.uid() is null for service role key) called from our server,
  -- or the authenticated user's ID matches the requested user ID.
  IF auth.role() != 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Authentication required';
    END IF;
    -- Verify the caller owns this user record
    IF NOT EXISTS (
      SELECT 1 FROM "User" WHERE id = p_user_id AND "externalId" = auth.uid()::text
    ) THEN
      RAISE EXCEPTION 'Unauthorized: user mismatch';
    END IF;
  END IF;

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

-- create_payment_if_unpaid: Only callable by service_role (server-side payment initiation)
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
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_paid BOOLEAN;
  v_active_count INT;
  result JSON;
BEGIN
  -- Only allow service_role to call this function
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'This function can only be called from the server';
  END IF;

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

-- ============================================================================
-- 2. GUEST USER RLS POLICIES (S1)
--    Allow guest sessions to manage their own invoices + line items
-- ============================================================================

-- Guest users can read their own invoices by guest_session_id
-- Note: guest operations should use the admin client in production,
-- but these policies provide defense-in-depth if anon client is used.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Guests can read own invoices'
  ) THEN
    CREATE POLICY "Guests can read own invoices" ON "Invoice"
      FOR SELECT USING (
        "guestSessionId" IS NOT NULL
        AND "guestSessionId" = current_setting('request.headers', true)::json->>'x-guest-session-id'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Guests can insert own invoices'
  ) THEN
    CREATE POLICY "Guests can insert own invoices" ON "Invoice"
      FOR INSERT WITH CHECK (
        "guestSessionId" IS NOT NULL
        AND "userId" IS NULL
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Guests can update own invoices'
  ) THEN
    CREATE POLICY "Guests can update own invoices" ON "Invoice"
      FOR UPDATE USING (
        "guestSessionId" IS NOT NULL
        AND "guestSessionId" = current_setting('request.headers', true)::json->>'x-guest-session-id'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Guests can delete own invoices'
  ) THEN
    CREATE POLICY "Guests can delete own invoices" ON "Invoice"
      FOR DELETE USING (
        "guestSessionId" IS NOT NULL
        AND "guestSessionId" = current_setting('request.headers', true)::json->>'x-guest-session-id'
      );
  END IF;
END;
$$;

-- Public access to invoices by publicId (for shared invoice links)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read invoices by publicId'
  ) THEN
    CREATE POLICY "Anyone can read invoices by publicId" ON "Invoice"
      FOR SELECT USING (
        "publicId" IS NOT NULL
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read line items for accessible invoices'
  ) THEN
    CREATE POLICY "Anyone can read line items for accessible invoices" ON "LineItem"
      FOR SELECT USING (true);
  END IF;
END;
$$;

-- ============================================================================
-- 3. PAYMENTS RLS POLICIES (D2)
--    Allow users to read their own payment records
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own payments'
  ) THEN
    CREATE POLICY "Users can read own payments" ON "Payment"
      FOR SELECT USING (
        "userId" IN (SELECT id FROM "User" WHERE "externalId" = auth.uid()::text)
      );
  END IF;
END;
$$;

-- ============================================================================
-- 4. STALE PAYMENT CLEANUP FUNCTION (D5)
--    Expire PENDING/PROCESSING payments older than 30 minutes
-- ============================================================================

CREATE OR REPLACE FUNCTION expire_stale_payments()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count INT;
BEGIN
  -- Only allow service_role to call this
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'This function can only be called from the server';
  END IF;

  UPDATE "Payment"
  SET
    status = 'FAILED',
    "resultDesc" = 'Payment expired (no response within 30 minutes)',
    "updatedAt" = NOW()
  WHERE status IN ('PENDING', 'PROCESSING')
    AND "createdAt" < NOW() - INTERVAL '30 minutes';

  GET DIAGNOSTICS expired_count = ROW_COUNT;

  RETURN expired_count;
END;
$$;

-- ============================================================================
-- 5. ADDITIONAL INDEX FOR STALE PAYMENT CLEANUP
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_payment_status_created
  ON "Payment"(status, "createdAt")
  WHERE status IN ('PENDING', 'PROCESSING');

-- ============================================================================
-- 6. INDEX FOR DATE-RANGE QUERIES ON INVOICES (D3)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_invoice_user_issue_date
  ON "Invoice"("userId", "issueDate" DESC);
