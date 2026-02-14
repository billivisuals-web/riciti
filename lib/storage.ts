/**
 * Supabase Storage utilities
 * Handles uploading images (logos, signatures) to Supabase Storage
 * instead of storing base64 data directly in the database.
 *
 * Buckets required in Supabase Storage:
 *   - "invoices" (public read access)
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createId } from "@paralleldrive/cuid2";

const BUCKET = "invoices";

// Max 500KB for base64 data URL uploads
const MAX_BASE64_SIZE = 500 * 1024;

/**
 * Upload a base64 data URL to Supabase Storage.
 * Returns the public URL string.
 *
 * @param folder  – subfolder inside the bucket (e.g. "logos", "signatures")
 * @param base64  – full data URL, e.g. "data:image/png;base64,iVBOR..."
 */
export async function uploadBase64ToStorage(
  folder: string,
  base64: string
): Promise<string> {
  // Validate size (base64 string length ≈ 1.37× the file size)
  if (base64.length > MAX_BASE64_SIZE * 1.37) {
    throw new Error(
      `Image too large. Maximum size is ${MAX_BASE64_SIZE / 1024}KB.`
    );
  }

  // Parse the data URL
  const match = base64.match(/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,(.+)$/i);
  if (!match) {
    throw new Error("Invalid image data URL. Only PNG, JPEG, GIF, WebP, and SVG are supported.");
  }

  const ext = match[1].replace("jpeg", "jpg").replace("svg+xml", "svg");
  const rawBase64 = match[2];
  const buffer = Buffer.from(rawBase64, "base64");
  const fileName = `${folder}/${createId()}.${ext}`;
  const contentType = `image/${match[1]}`;

  const supabase = createAdminClient();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, buffer, {
      contentType,
      cacheControl: "31536000", // 1 year – images are immutable
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

/**
 * Process an image field: if it's a base64 data URL, upload it and
 * return the public URL. If it's already a URL, return as-is.
 * If null/undefined, return null.
 */
export async function processImageField(
  folder: string,
  value: string | null | undefined
): Promise<string | null> {
  if (!value) return null;

  // Already an HTTPS URL — return as-is
  if (value.startsWith("https://")) {
    return value;
  }

  // Reject plain http:// (insecure, SSRF risk)
  if (value.startsWith("http://")) {
    return null;
  }

  // Base64 data URL – upload to storage
  if (value.startsWith("data:image/")) {
    return uploadBase64ToStorage(folder, value);
  }

  // Unknown format – skip
  return null;
}
