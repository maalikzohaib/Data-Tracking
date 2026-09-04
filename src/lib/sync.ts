import { prisma } from "./prisma";
import { fetchShopifyOrders, fetchShopifyProducts, type ShopifyOrder } from "./shopify";
import { fetchMetaInsights } from "./meta";
import { broadcastEvent } from "./events";

function num(v?: string | null): number {
  const n = parseFloat(v ?? "0");
  return isNaN(n) ? 0 : n;
}

function paymentMethod(o: ShopifyOrder): string {
  const gws = o.payment_gateway_names?.join(", ") || o.gateway || "";
  const lower = gws.toLowerCase();
  if (lower.includes("cod") || lower.includes("cash on delivery")) return "COD";
  if (!gws) return "unknown";
  return gws;
}

/** Normalize phone: +923xx → 03xx, 923xx → 03xx */
function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let p = raw.replace(/[\s\-().]/g, "");
  if (p.startsWith("+92")) p = "0" + p.slice(3);
  else if (p.startsWith("92") && p.length >= 12) p = "0" + p.slice(2);
  if (!p.startsWith("0")) p = "0" + p;
  return p;
}

// Pre-fetched product buy prices (filled once per sync for speed)
let _buyPriceCache: Map<string, number> | null = null;

async function getBuyPriceMap(): Promise<Map<string, number>> {
  if (_buyPriceCache) return _buyPriceCache;
  const all = await prisma.product.findMany({ select: { sku: true, buyPrice: true } });
  _buyPriceCache = new Map(all.filter((p) => p.sku).map((p) => [p.sku!, p.buyPrice]));
  return _buyPriceCache;
}

// Upsert a single Shopify order into the DB (used by sync + webhook).
// IMPORTANT: Does NOT overwrite deliveryStatus, labelColor, or user-set fields on update.
export async function upsertOrder(o: ShopifyOrder): Promise<void> {
  const shopifyId = String(o.id);
  const shipping = num(o.total_shipping_price_set?.shop_money?.amount);
  const customerName = o.customer
    ? `${o.customer.first_name ?? ""} ${o.customer.last_name ?? ""}`.trim()
    : null;
  const customerPhone = normalizePhone(
    o.phone ||
    o.customer?.phone ||
    o.shipping_address?.phone ||
    o.billing_address?.phone ||
    null
  );
  function formatLineItemTitle(li: { title: string; variant_title?: string | null; name?: string | null }): string {
    if (li.variant_title && li.variant_title !== "Default Title") {
      return `${li.title} - ${li.variant_title}`;
    }
    return li.name || li.title;
  }

  const lineItems = o.line_items || [];
  const itemNames = lineItems.map(formatLineItemTitle).join(", ");

  // COGS: use cached product prices for speed
  const buyBySku = await getBuyPriceMap();
  let cogs = 0;
  for (const li of lineItems) {
    if (li.sku && buyBySku.has(li.sku)) {
      cogs += (buyBySku.get(li.sku) ?? 0) * (li.quantity || 1);
    }
  }

  const itemCount = lineItems.reduce((s, li) => s + (li.quantity || 1), 0);

  // Extract courier & tracking from fulfillments if present
  let courier: string | null = null;
  let courierProvider: string | null = null;
  let trackingId: string | null = null;
  let trackingUrl: string | null = null;
  let isCourierHanded = false;

  if (o.fulfillments && o.fulfillments.length > 0) {
    const f = o.fulfillments[0];
    trackingId = f.tracking_number || (f.tracking_numbers && f.tracking_numbers[0]) || null;
    trackingUrl = f.tracking_url || null;
    let company = f.tracking_company || "";
    if (trackingUrl && trackingUrl.toLowerCase().includes("runcourier")) {
      company = "Run Courier";
      courierProvider = "run_courier";
    } else if (trackingUrl && trackingUrl.toLowerCase().includes("postex")) {
      company = "PostEx";
      courierProvider = "postex";
    } else if (trackingUrl && trackingUrl.toLowerCase().includes("leopard")) {
      company = "Leopards";
    } else if (trackingId && /^\d{14}$/.test(trackingId)) {
      company = "PostEx";
      courierProvider = "postex";
    } else if (trackingId && /^LE/i.test(trackingId)) {
      company = "Leopards";
    }
    // Detect Run Courier from tracking company name
    if (company.toLowerCase().includes("run courier") || company.toLowerCase().includes("runcourier")) {
      courierProvider = "run_courier";
      company = "Run Courier";
    }
    courier = company || f.tracking_company || null;
  }

  await prisma.order.upsert({
    where: { shopifyId },
    create: {
      shopifyId,
      orderNumber: o.name ?? String(o.order_number),
      customerName,
      customerPhone,
      customerCity: o.shipping_address?.city ?? null,
      itemName: itemNames || null,
      totalPrice: num(o.total_price),
      subtotalPrice: num(o.subtotal_price),
      totalDiscount: num(o.total_discounts),
      totalShipping: shipping,
      currency: o.currency || "PKR",
      financialStatus: o.financial_status,
      fulfillmentStatus: o.fulfillment_status,
      paymentMethod: paymentMethod(o),
      // Auto-populate courier and tracking if available
      courier,
      courierProvider,
      trackingId,
      trackingUrl,
      isCourierHanded: false, // New orders start in Active section
      // NEW orders: default to "pending under ATC" and GREEN color
      deliveryStatus: "pending under ATC",
      labelColor: "#22c55e",
      itemCount,
      cogs,
      cancelled: !!o.cancelled_at,
      shopifyCreatedAt: new Date(o.created_at),
      lineItems: {
        create: lineItems.map((li) => ({
          title: formatLineItemTitle(li),
          sku: li.sku || null,
          quantity: li.quantity || 1,
          price: num(li.price),
          productId: li.product_id ? String(li.product_id) : null,
        })),
      },
    },
    update: {
      // Only update Shopify-sourced data; NEVER change sections (deliveryStatus, isCourierHanded, archived)
      orderNumber: o.name ?? String(o.order_number),
      customerName,
      customerPhone,
      customerCity: o.shipping_address?.city ?? null,
      itemName: itemNames || null,
      totalPrice: num(o.total_price),
      subtotalPrice: num(o.subtotal_price),
      totalDiscount: num(o.total_discounts),
      totalShipping: shipping,
      financialStatus: o.financial_status,
      fulfillmentStatus: o.fulfillment_status,
      paymentMethod: paymentMethod(o),
      itemCount,
      cogs,
      cancelled: !!o.cancelled_at,
      ...(courier ? { courier } : {}),
      ...(courierProvider ? { courierProvider } : {}),
      ...(trackingId ? { trackingId, trackingUrl } : {}),
      lineItems: {
        deleteMany: {},
        create: lineItems.map((li) => ({
          title: formatLineItemTitle(li),
          sku: li.sku || null,
          quantity: li.quantity || 1,
          price: num(li.price),
          productId: li.product_id ? String(li.product_id) : null,
        })),
      },
    },
  });

  // Cash flow: record paid orders as cash-in (avoid duplicates by refId).
  if (o.financial_status === "paid" && !o.cancelled_at) {
    const existing = await prisma.cashFlow.findFirst({
      where: { refId: shopifyId, source: "Sales" },
    });
    if (!existing) {
      await prisma.cashFlow.create({
        data: {
          type: "in",
          source: "Sales",
          amount: num(o.total_price),
          note: `Order ${o.name ?? o.order_number}`,
          refId: shopifyId,
          happenedAt: new Date(o.created_at),
        },
      });
    }
  }
}

export async function syncShopifyOrders(sinceISO?: string): Promise<number> {
  // Reset COGS cache so we get fresh product prices
  _buyPriceCache = null;

  // Sync orders (default last 180 days for full variant & status coverage).
  const since = sinceISO !== undefined ? sinceISO : new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const orders = await fetchShopifyOrders(since);

  // Pre-warm the buy price cache once (instead of per-order)
  await getBuyPriceMap();

  // Process orders in batches of 5 for speed (avoids overwhelming Neon connection pool)
  const BATCH = 5;
  for (let i = 0; i < orders.length; i += BATCH) {
    const batch = orders.slice(i, i + BATCH);
    await Promise.all(batch.map((o) => upsertOrder(o)));
  }

  await prisma.syncLog.create({
    data: { source: "shopify-orders", status: "success", count: orders.length },
  });

  broadcastEvent("shopify:sync", { count: orders.length });
  return orders.length;
}

export async function syncShopifyProducts(): Promise<number> {
  const products = await fetchShopifyProducts();
  let count = 0;
  for (const p of products) {
    for (const v of p.variants) {
      const shopifyVariantId = String(v.id);
      const cleanSku = v.sku?.trim() || null;
      count++;
      await prisma.product.upsert({
        where: { shopifyId: shopifyVariantId },
        create: {
          shopifyId: shopifyVariantId,
          title: p.variants.length > 1 ? `${p.title} — ${v.title}` : p.title,
          sku: cleanSku,
          sellPrice: num(v.price),
          stock: v.inventory_quantity ?? 0,
          // buyPrice manual rehta hai — sync par overwrite nahi karte.
        },
        update: {
          title: p.variants.length > 1 ? `${p.title} — ${v.title}` : p.title,
          sku: cleanSku,
          sellPrice: num(v.price),
          stock: v.inventory_quantity ?? 0,
        },
      });
    }
  }
  await prisma.syncLog.create({
    data: { source: "shopify-products", status: "success", count },
  });
  broadcastEvent("shopify:products", { count });
  return count;
}

export async function syncMeta(): Promise<number> {
  const rows = await fetchMetaInsights();
  for (const r of rows) {
    const date = new Date(r.date + "T00:00:00.000Z");
    await prisma.metaAdDaily.upsert({
      where: { date },
      create: {
        date,
        spend: r.spend,
        impressions: r.impressions,
        clicks: r.clicks,
        reach: r.reach,
        purchases: r.purchases,
        revenue: r.revenue,
      },
      update: {
        spend: r.spend,
        impressions: r.impressions,
        clicks: r.clicks,
        reach: r.reach,
        purchases: r.purchases,
        revenue: r.revenue,
      },
    });

    // Ad spend ko cash-out ledger mein daalo (per day, dedup by note+date).
    if (r.spend > 0) {
      const existing = await prisma.cashFlow.findFirst({
        where: { source: "Ads", note: `Meta ads ${r.date}` },
      });
      if (existing) {
        await prisma.cashFlow.update({
          where: { id: existing.id },
          data: { amount: r.spend },
        });
      } else {
        await prisma.cashFlow.create({
          data: {
            type: "out",
            source: "Ads",
            amount: r.spend,
            note: `Meta ads ${r.date}`,
            happenedAt: date,
          },
        });
      }
    }
  }
  await prisma.syncLog.create({
    data: { source: "meta", status: "success", count: rows.length },
  });
  broadcastEvent("meta:sync", { count: rows.length });
  return rows.length;
}
