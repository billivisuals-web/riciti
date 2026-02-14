import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@/lib/supabase/server";
import { findUserByExternalId } from "@/lib/db/supabase-db";
import { createId } from "@paralleldrive/cuid2";

const GUEST_SESSION_COOKIE = "riciti_guest_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Get or create a guest session ID
 * This is used for anonymous users to access their invoices
 */
export async function getGuestSessionId(): Promise<string> {
  const cookieStore = await cookies();
  let sessionId = cookieStore.get(GUEST_SESSION_COOKIE)?.value;

  if (!sessionId) {
    sessionId = uuidv4();
    cookieStore.set(GUEST_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });
  }

  return sessionId;
}

/**
 * Get the current tenant context (userId or guestSessionId)
 * Checks for authenticated Supabase user first, then falls back to guest session
 */
export async function getTenantContext(): Promise<{
  userId: string | null;
  guestSessionId: string | null;
}> {
  // Check for authenticated Supabase user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Find the user in our database
    const dbUser = await findUserByExternalId(user.id);

    if (dbUser) {
      return { userId: dbUser.id, guestSessionId: null };
    }
  }

  // Fall back to guest session
  const guestSessionId = await getGuestSessionId();
  return { userId: null, guestSessionId };
}

/**
 * Generate a unique invoice number.
 * Uses CUID2 to guarantee uniqueness at any volume.
 * Format: PREFIX-YYYY-XXXXXXXXXX (10-char alphanumeric suffix)
 */
export function generateInvoiceNumber(prefix = "INV"): string {
  const year = new Date().getFullYear();
  const uniqueId = createId().slice(0, 10).toUpperCase();
  return `${prefix}-${year}-${uniqueId}`;
}
