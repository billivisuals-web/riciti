/**
 * Next.js instrumentation hook — runs once at server startup.
 * Used for early environment validation.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env");
    validateEnv();
  }
}
