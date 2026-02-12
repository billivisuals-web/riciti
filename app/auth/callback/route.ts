import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserByExternalId, createUser, migrateGuestInvoicesToUser } from "@/lib/db/supabase-db";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Auth exchange error:", error);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
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

        // Migrate guest invoices to user
        const cookieStore = await cookies();
        const guestSessionId = cookieStore.get("riciti_guest_session")?.value;

        if (guestSessionId) {
          await migrateGuestInvoicesToUser(guestSessionId, dbUser.id);
          cookieStore.delete("riciti_guest_session");
        }

        return NextResponse.redirect(`${origin}${next}`);
      } catch (dbError) {
        console.error("Database error during auth callback:", dbError);
        return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Database error. Please try again.")}`);
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`);
}
