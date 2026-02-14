/**
 * Environment variable validation.
 * Import this module early (e.g., in instrumentation.ts or layout.tsx)
 * to fail fast with descriptive errors if required vars are missing.
 */

const requiredVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const conditionalVars = {
  // Required when MPESA_ENVIRONMENT is set (payment processing enabled)
  mpesa: [
    "MPESA_CONSUMER_KEY",
    "MPESA_CONSUMER_SECRET",
    "MPESA_PASSKEY",
    "MPESA_SHORTCODE",
  ] as const,
};

const recommendedVars = [
  "MPESA_CALLBACK_SECRET",      // Callback URL protection
  "UPSTASH_REDIS_REST_URL",     // Distributed rate limiting
  "UPSTASH_REDIS_REST_TOKEN",   // Distributed rate limiting
] as const;

export function validateEnv() {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required vars
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  // Check M-Pesa vars if payment processing is configured
  if (process.env.MPESA_ENVIRONMENT || process.env.MPESA_CONSUMER_KEY) {
    for (const varName of conditionalVars.mpesa) {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    }
  }

  // Check recommended vars
  for (const varName of recommendedVars) {
    if (!process.env[varName]) {
      warnings.push(varName);
    }
  }

  // Production-specific checks
  if (process.env.NODE_ENV === "production") {
    if (!process.env.MPESA_CALLBACK_SECRET) {
      console.error(
        "[ENV] CRITICAL: MPESA_CALLBACK_SECRET is not set in production. " +
        "M-Pesa callbacks are vulnerable to forgery."
      );
    }

    if (process.env.MPESA_ENVIRONMENT !== "production") {
      console.warn(
        "[ENV] WARNING: MPESA_ENVIRONMENT is not set to 'production'. " +
        "M-Pesa is running in sandbox mode — IP whitelist is disabled."
      );
    }
  }

  if (warnings.length > 0) {
    console.warn(
      `[ENV] Recommended environment variables not set: ${warnings.join(", ")}. ` +
      "Some security features (rate limiting, callback protection) are degraded."
    );
  }

  if (missing.length > 0) {
    const message = `[ENV] Missing required environment variables: ${missing.join(", ")}`;
    console.error(message);
    throw new Error(message);
  }
}
