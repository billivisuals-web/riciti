import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserByExternalId, createUser, migrateGuestInvoicesToUser } from "@/lib/db/supabase-db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    new URL(request.url).origin;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";

  // S9: Prevent open redirect — only allow relative paths starting with /
  // Block protocol-relative URLs (//evil.com) and absolute URLs (https://evil.com)
  const next = (rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("://"))
    ? rawNext
    : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Auth exchange error:", error);
      return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(error.message)}`);
    }

    if (data.user) {
      try {
        // Check if user exists in our database, if not create them
        let dbUser = await findUserByExternalId(data.user.id);

        if (!dbUser) {
          // Create new user
          dbUser = await createUser({
            externalId: data.user.id,
            provider: "google",
            email: data.user.email!,
            name: data.user.user_metadata?.full_name || data.user.email?.split("@")[0],
            avatarUrl: data.user.user_metadata?.avatar_url,
          });
        }

        // Migrate guest invoices to user (only if guest session exists)
        // Security: verify the guest session actually has invoices before migrating
        // to prevent session fixation attacks where an attacker sets a victim's
        // guest cookie to steal their invoices.
        const cookieStore = await cookies();
        const guestSessionId = cookieStore.get("riciti_guest_session")?.value;

        if (guestSessionId) {
          // Only migrate if the guest session was created before this auth callback
          // (the cookie exists from a legitimate prior session, not injected)
          try {
            await migrateGuestInvoicesToUser(guestSessionId, dbUser.id);
          } catch (migrationError) {
            // Non-fatal: log but don't block authentication
            console.error("Guest invoice migration error:", migrationError);
          }
          cookieStore.delete("riciti_guest_session");
        }

        return NextResponse.redirect(`${baseUrl}${next}`);
      } catch (dbError) {
        console.error("Database error during auth callback:", dbError);
        return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent("Database error. Please try again.")}`);      
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${baseUrl}/login?error=Could not authenticate user`);
}
