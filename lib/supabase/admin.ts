/**
 * Supabase Admin Client (Service Role)
 * Used for server-side operations that bypass RLS,
 * such as M-Pesa callback processing where there's no user session.
 */

import { createServerClient } from "@supabase/ssr";

let adminClient: ReturnType<typeof createServerClient> | null = null;

export function createAdminClient() {
  if (adminClient) return adminClient;

  // Use the service role key to bypass RLS.
  // No cookie handling needed — this client runs server-side only.
  adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // No-op: admin client doesn't need cookies
        },
      },
    }
  );

  return adminClient;
}
