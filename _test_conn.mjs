const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_ADMIN_TOKEN;
try {
  const r = await fetch(`https://${domain}/admin/api/2025-01/shop.json`, {
    headers: { "X-Shopify-Access-Token": token },
  });
  const t = await r.text();
  console.log("SHOPIFY: HTTP", r.status, t.slice(0, 200));
} catch (e) {
  console.log("SHOPIFY: ERROR", e.message);
}
