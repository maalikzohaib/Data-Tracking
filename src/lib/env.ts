// Central env access with helpful errors.

export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || "PKR";

export function getShopifyConfig() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!domain || !token) {
    throw new Error(
      "Shopify env missing. Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN in .env"
    );
  }
  return { domain, token };
}

export function getMetaConfig() {
  const token = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;
  if (!token || !accountId) {
    throw new Error(
      "Meta env missing. Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID in .env"
    );
  }
  return { token, accountId };
}

export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  // Vercel cron sends: Authorization: Bearer <CRON_SECRET>
  if (header === `Bearer ${secret}`) return true;
  // Allow manual trigger via ?secret= for convenience
  const url = new URL(req.url);
  if (url.searchParams.get("secret") === secret) return true;
  return false;
}
