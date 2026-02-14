/**
 * M-Pesa Daraja API Client
 * Handles STK Push (Lipa Na M-Pesa Online) via Safaricom's Daraja API
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const MPESA_ENV = process.env.MPESA_ENVIRONMENT || "sandbox";

const BASE_URL =
  MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY!;
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET!;
const PASSKEY = process.env.MPESA_PASSKEY!;
const SHORTCODE = process.env.MPESA_SHORTCODE!;

// ============================================================================
// TYPES
// ============================================================================

export type STKPushRequest = {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc?: string;
  callbackUrl: string;
};

export type STKPushResponse = {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
};

export type STKPushQueryResponse = {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: string;
  ResultDesc: string;
};

export type STKCallbackData = {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value?: string | number;
        }>;
      };
    };
  };
};

export type ParsedCallbackResult = {
  merchantRequestId: string;
  checkoutRequestId: string;
  resultCode: number;
  resultDesc: string;
  mpesaReceiptNumber?: string;
  transactionDate?: string;
  phoneNumber?: string;
  amount?: number;
};

// ============================================================================
// ACCESS TOKEN (cached)
// ============================================================================

let cachedToken: { token: string; expiresAt: number } | null = null;

/** Timeout for all Safaricom API calls (15 seconds) */
const API_TIMEOUT_MS = 15_000;

/** Retry config for access token fetch */
const TOKEN_MAX_RETRIES = 2;
const TOKEN_RETRY_BASE_MS = 500;

export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= TOKEN_MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff: 500ms, 1000ms
        const delay = TOKEN_RETRY_BASE_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        console.log(`[M-Pesa] Retrying access token (attempt ${attempt + 1})`);
      }

      const response = await fetch(
        `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
        {
          method: "GET",
          headers: {
            Authorization: `Basic ${credentials}`,
          },
          signal: AbortSignal.timeout(API_TIMEOUT_MS),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to get M-Pesa access token: ${response.status} ${text}`);
      }

      const data = await response.json();
      const expiresInMs = (parseInt(data.expires_in, 10) || 3599) * 1000;

      cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + expiresInMs,
      };

      return cachedToken.token;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Only retry on network/timeout errors, not auth failures
      if (lastError.message.includes("401") || lastError.message.includes("403")) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("Failed to get M-Pesa access token after retries");
}

// ============================================================================
// STK PUSH (Lipa Na M-Pesa Online)
// ============================================================================

function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function generatePassword(timestamp: string): string {
  return Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString("base64");
}

/**
 * Normalize phone number to 254XXXXXXXXX format
 * Accepts: +254..., 254..., 07..., 01..., 7..., 1...
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove spaces, dashes, parentheses
  let cleaned = phone.replace(/[\s\-()]/g, "");

  // Remove leading +
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }

  // Convert 07XX or 01XX to 2547XX / 2541XX
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "254" + cleaned.substring(1);
  }

  // Handle short format 7XXXXXXXX or 1XXXXXXXX
  if ((cleaned.startsWith("7") || cleaned.startsWith("1")) && cleaned.length === 9) {
    cleaned = "254" + cleaned;
  }

  // Validate final format
  if (!/^254[017]\d{8}$/.test(cleaned)) {
    throw new Error(
      `Invalid phone number format: ${phone}. Expected format: 254XXXXXXXXX (e.g., 254712345678)`
    );
  }

  return cleaned;
}

/**
 * Initiate an STK Push request (Lipa Na M-Pesa Online)
 * This sends a payment prompt to the customer's phone
 */
export async function initiateSTKPush(
  request: STKPushRequest
): Promise<STKPushResponse> {
  const token = await getAccessToken();
  const timestamp = generateTimestamp();
  const password = generatePassword(timestamp);
  const phone = normalizePhoneNumber(request.phoneNumber);

  // Round amount to whole number (M-Pesa doesn't accept decimals)
  const amount = Math.ceil(request.amount);

  const payload = {
    BusinessShortCode: SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: phone,
    PartyB: SHORTCODE,
    PhoneNumber: phone,
    CallBackURL: request.callbackUrl,
    AccountReference: request.accountReference.substring(0, 12), // Max 12 chars
    TransactionDesc: (request.transactionDesc || "Payment").substring(0, 13), // Max 13 chars
  };

  const response = await fetch(
    `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    }
  );

  const data = await response.json();

  if (!response.ok || data.errorCode) {
    throw new Error(
      `STK Push failed: ${data.errorMessage || data.ResponseDescription || JSON.stringify(data)}`
    );
  }

  return data as STKPushResponse;
}

// ============================================================================
// STK PUSH QUERY (check status manually)
// ============================================================================

/**
 * Query the status of an STK Push request
 * Useful as a fallback if the callback doesn't arrive
 */
export async function querySTKPush(
  checkoutRequestId: string
): Promise<STKPushQueryResponse> {
  const token = await getAccessToken();
  const timestamp = generateTimestamp();
  const password = generatePassword(timestamp);

  const payload = {
    BusinessShortCode: SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestId,
  };

  const response = await fetch(
    `${BASE_URL}/mpesa/stkpushquery/v1/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    }
  );

  const data = await response.json();

  if (!response.ok || data.errorCode) {
    throw new Error(
      `STK Query failed: ${data.errorMessage || data.ResponseDescription || JSON.stringify(data)}`
    );
  }

  return data as STKPushQueryResponse;
}

// ============================================================================
// CALLBACK PARSER
// ============================================================================

/**
 * Parse the M-Pesa STK Push callback data into a flat object
 */
export function parseSTKCallback(data: STKCallbackData): ParsedCallbackResult {
  const callback = data.Body.stkCallback;

  const result: ParsedCallbackResult = {
    merchantRequestId: callback.MerchantRequestID,
    checkoutRequestId: callback.CheckoutRequestID,
    resultCode: callback.ResultCode,
    resultDesc: callback.ResultDesc,
  };

  // Extract metadata items only on success (ResultCode === 0)
  if (callback.ResultCode === 0 && callback.CallbackMetadata?.Item) {
    for (const item of callback.CallbackMetadata.Item) {
      switch (item.Name) {
        case "MpesaReceiptNumber":
          result.mpesaReceiptNumber = item.Value as string;
          break;
        case "TransactionDate":
          result.transactionDate = String(item.Value);
          break;
        case "PhoneNumber":
          result.phoneNumber = String(item.Value);
          break;
        case "Amount":
          result.amount = item.Value as number;
          break;
      }
    }
  }

  return result;
}
