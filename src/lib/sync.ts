import { prisma } from "./prisma";
import { fetchShopifyOrders, fetchShopifyProducts, type ShopifyOrder } from "./shopify";
import { fetchMetaInsights } from "./meta";

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

// Upsert a single Shopify order into the DB (used by sync + webhook).
export async function upsertOrder(o: ShopifyOrder): Promise<void> {
  const shopifyId = String(o.id);
  const shipping = num(o.total_shipping_price_set?.shop_money?.amount);
  const customerName = o.customer
    ? `${o.customer.first_name ?? ""} ${o.customer.last_name ?? ""}`.trim()
    : null;

  // COGS: sum(line item qty * product buyPrice) — matched by SKU.
  const skus = o.line_items.map((li) => li.sku).filter(Boolean) as string[];
  const products = skus.length
    ? await prisma.product.findMany({ where: { sku: { in: skus } } })
    : [];
  const buyBySku = new Map(products.map((p) => [p.sku, p.buyPrice]));
  let cogs = 0;
  for (const li of o.line_items) {
    if (li.sku && buyBySku.has(li.sku)) {
      cogs += (buyBySku.get(li.sku) ?? 0) * li.quantity;
    }
  }

  const itemCount = o.line_items.reduce((s, li) => s + li.quantity, 0);

  await prisma.order.upsert({
    where: { shopifyId },
    create: {
      shopifyId,
      orderNumber: o.name ?? String(o.order_number),
      customerName,
      customerCity: o.shipping_address?.city ?? null,
      totalPrice: num(o.total_price),
      subtotalPrice: num(o.subtotal_price),
      totalDiscount: num(o.total_discounts),
      totalShipping: shipping,
      currency: o.currency || "PKR",
      financialStatus: o.financial_status,
      fulfillmentStatus: o.fulfillment_status,
      paymentMethod: paymentMethod(o),
      itemCount,
      cogs,
      cancelled: !!o.cancelled_at,
      shopifyCreatedAt: new Date(o.created_at),
      lineItems: {
        create: o.line_items.map((li) => ({
          title: li.title,
          sku: li.sku,
          quantity: li.quantity,
          price: num(li.price),
          productId: li.product_id ? String(li.product_id) : null,
        })),
      },
    },
    update: {
      orderNumber: o.name ?? String(o.order_number),
      customerName,
      customerCity: o.shipping_address?.city ?? null,
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

export async function syncShopifyOrders(): Promise<number> {
  // Sync orders updated in the last 60 days (incremental-ish, keeps it fast).
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const orders = await fetchShopifyOrders(since);
  for (const o of orders) {
    await upsertOrder(o);
  }
  await prisma.syncLog.create({
    data: { source: "shopify-orders", status: "success", count: orders.length },
  });
  return orders.length;
}

export async function syncShopifyProducts(): Promise<number> {
  const products = await fetchShopifyProducts();
  let count = 0;
  for (const p of products) {
    for (const v of p.variants) {
      const shopifyVariantId = String(v.id);
      count++;
      await prisma.product.upsert({
        where: { shopifyId: shopifyVariantId },
        create: {
          shopifyId: shopifyVariantId,
          title: p.variants.length > 1 ? `${p.title} — ${v.title}` : p.title,
          sku: v.sku || null,
          sellPrice: num(v.price),
          stock: v.inventory_quantity ?? 0,
          // buyPrice manual rehta hai — sync par overwrite nahi karte.
        },
        update: {
          title: p.variants.length > 1 ? `${p.title} — ${v.title}` : p.title,
          sellPrice: num(v.price),
          stock: v.inventory_quantity ?? 0,
        },
      });
    }
  }
  await prisma.syncLog.create({
    data: { source: "shopify-products", status: "success", count },
  });
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
  return rows.length;
}
