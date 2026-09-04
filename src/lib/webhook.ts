import crypto from "crypto";

/**
 * Checks if the configured webhook secret is a real value rather than an unset placeholder
 */
export function isConfiguredSecret(secret?: string | null): boolean {
  if (!secret) return false;
  const s = secret.trim();
  if (!s || s.length < 10) return false;
  // Ignore dummy placeholder values like "xxxxxxxxxxxxxxxxxxxxxxxx", "change-me", etc.
  if (/^x+$/i.test(s) || s.toLowerCase().includes("xxxx") || s.includes("your-") || s === "change-me") {
    return false;
  }
  return true;
}

// Verify Shopify webhook HMAC signature.
export function verifyShopifyWebhook(
  rawBody: string,
  hmacHeader: string | null
): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!isConfiguredSecret(secret) || !hmacHeader) return false;
  const digest = crypto
    .createHmac("sha256", secret!)
    .update(rawBody, "utf8")
    .digest("base64");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest),
      Buffer.from(hmacHeader)
    );
  } catch {
    return false;
  }
}

