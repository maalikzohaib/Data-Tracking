import { NextResponse } from "next/server";
import { verifyShopifyWebhook, isConfiguredSecret } from "@/lib/webhook";
import { upsertOrder } from "@/lib/sync";
import type { ShopifyOrder } from "@/lib/shopify";
import { prisma } from "@/lib/prisma";
import { broadcastEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

/**
 * Shopify Webhook Endpoint
 * Listens for:
 *   - orders/create
 *   - orders/updated
 *   - orders/paid
 *   - orders/cancelled
 *   - orders/fulfilled
 *   - orders/delete
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  const topic = req.headers.get("x-shopify-topic") || "orders/create";
  const shopDomain = req.headers.get("x-shopify-shop-domain") || "";
  const webhookId = req.headers.get("x-shopify-webhook-id") || "";

  // Signature verification (only enforced when a valid, non-placeholder SHOPIFY_WEBHOOK_SECRET is configured)
  const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (isConfiguredSecret(webhookSecret)) {
    if (!verifyShopifyWebhook(raw, hmac)) {
      console.error(`[Shopify Webhook] Invalid signature from ${shopDomain || "unknown"}`);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    console.warn(
      `[Shopify Webhook] Signature verification bypassed: SHOPIFY_WEBHOOK_SECRET is unset or has dummy placeholder value.`
    );
  }

  try {
    const payload = JSON.parse(raw);

    // Handle order deletion
    if (topic === "orders/delete" && payload?.id) {
      const shopifyId = String(payload.id);
      await prisma.order.updateMany({
        where: { shopifyId },
        data: { archived: true, cancelled: true },
      });
      broadcastEvent("order:updated", { shopifyId, topic });
      return NextResponse.json({ ok: true, topic, deleted: shopifyId });
    }

    const order = payload as ShopifyOrder;
    if (!order || !order.id) {
      return NextResponse.json({ error: "Invalid order payload (missing ID)" }, { status: 400 });
    }

    // Process & upsert order idempotently
    await upsertOrder(order);

    const rawOrderLabel = order.name ?? String(order.order_number ?? order.id);
    const orderLabel = rawOrderLabel.startsWith("#") ? rawOrderLabel : `#${rawOrderLabel}`;

    // Record sync log for audit trail (visible in Settings > Sync Logs)
    await prisma.syncLog.create({
      data: {
        source: "shopify-webhook",
        status: "success",
        count: 1,
        message: `${topic} — ${orderLabel} (${order.customer ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim() : "Guest"})`,
      },
    }).catch(() => {});

    // Broadcast real-time event to all connected active dashboard tabs
    broadcastEvent("order:created", {
      orderId: String(order.id),
      orderNumber: orderLabel,
      topic,
      webhookId,
      timestamp: Date.now(),
    });

    return NextResponse.json({ ok: true, processed: 1, orderNumber: orderLabel });
  } catch (e: any) {
    const errorMsg = String(e?.message || e);
    console.error("[Shopify Webhook] Processing error:", errorMsg);

    // Log failure in SyncLog for debugging
    await prisma.syncLog.create({
      data: {
        source: "shopify-webhook",
        status: "error",
        count: 0,
        message: `${topic} failed: ${errorMsg.slice(0, 200)}`,
      },
    }).catch(() => {});

    // Return 500 so Shopify retries if this is a temporary DB error
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
