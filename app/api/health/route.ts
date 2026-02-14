import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/health
 * Health check endpoint for Railway deployment monitoring.
 * Verifies both app and database connectivity.
 */
export async function GET() {
  try {
    // Lightweight DB connectivity check
    const supabase = createAdminClient();
    const { error } = await supabase.from("User").select("id").limit(1);

    if (error) {
      console.error("Health check DB error:", error);
      return NextResponse.json(
        {
          ok: false,
          timestamp: new Date().toISOString(),
          db: "unreachable",
        },
        {
          status: 503,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        timestamp: new Date().toISOString(),
        db: "connected",
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (err) {
    console.error("Health check error:", err);
    return NextResponse.json(
      {
        ok: false,
        timestamp: new Date().toISOString(),
        error: "Internal error",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
