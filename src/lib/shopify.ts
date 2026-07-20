import { getShopifyConfig } from "./env";

const API_VERSION = "2025-01";

type ShopifyOrder = {
  id: number;
  order_number: number;
  name: string;
  created_at: string;
  currency: string;
  total_price: string;
  subtotal_price: string;
  total_discounts: string;
  total_shipping_price_set?: { shop_money?: { amount?: string } };
  financial_status: string | null;
  fulfillment_status: string | null;
  cancelled_at: string | null;
  gateway?: string | null;
  payment_gateway_names?: string[];
  customer?: { first_name?: string; last_name?: string } | null;
  shipping_address?: { city?: string } | null;
  line_items: {
    id: number;
    title: string;
    sku: string | null;
    quantity: number;
    price: string;
    product_id: number | null;
  }[];
};

type ShopifyProduct = {
  id: number;
  title: string;
  variants: {
    id: number;
    title: string;
    sku: string | null;
    price: string;
    inventory_quantity: number;
  }[];
};

async function shopifyFetch(path: string): Promise<Response> {
  const { domain, token } = getShopifyConfig();
  const url = `https://${domain}/admin/api/${API_VERSION}/${path}`;
  return fetch(url, {
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
}

// Parse Shopify Link header for cursor-based pagination.
function nextPageInfo(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const parts = linkHeader.split(",");
  for (const p of parts) {
    if (p.includes('rel="next"')) {
      const match = p.match(/page_info=([^&>]+)/);
      if (match) return match[1];
    }
  }
  return null;
}

// Fetch orders updated since a date, following pagination.
export async function fetchShopifyOrders(sinceISO?: string): Promise<ShopifyOrder[]> {
  const all: ShopifyOrder[] = [];
  let pageInfo: string | null = null;
  let first = true;

  while (true) {
    let path: string;
    if (pageInfo) {
      path = `orders.json?limit=250&page_info=${pageInfo}`;
    } else {
      const since = sinceISO
        ? `&updated_at_min=${encodeURIComponent(sinceISO)}`
        : "";
      path = `orders.json?limit=250&status=any${since}`;
    }

    const res = await shopifyFetch(path);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Shopify orders fetch failed (${res.status}): ${body}`);
    }
    const data = (await res.json()) as { orders: ShopifyOrder[] };
    all.push(...data.orders);

    pageInfo = nextPageInfo(res.headers.get("link"));
    first = false;
    if (!pageInfo) break;
    // safety cap
    if (all.length > 25000) break;
  }

  return all;
}

export async function fetchShopifyProducts(): Promise<ShopifyProduct[]> {
  const all: ShopifyProduct[] = [];
  let pageInfo: string | null = null;

  while (true) {
    const path = pageInfo
      ? `products.json?limit=250&page_info=${pageInfo}`
      : `products.json?limit=250`;
    const res = await shopifyFetch(path);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Shopify products fetch failed (${res.status}): ${body}`);
    }
    const data = (await res.json()) as { products: ShopifyProduct[] };
    all.push(...data.products);
    pageInfo = nextPageInfo(res.headers.get("link"));
    if (!pageInfo) break;
    if (all.length > 10000) break;
  }
  return all;
}

export type { ShopifyOrder, ShopifyProduct };
